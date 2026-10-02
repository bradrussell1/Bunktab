-- QA round 1 follow-ups (docs/qa/qa-report-A/B-2026-10-01.md), user decisions
-- 2026-10-01:
--  1. Settlement re-plan with paid payments untouched (A-3/B-06/B-07):
--     generate_settlements subtracts marked/confirmed payments from the nets,
--     replaces only the pending rows; unmark reopens a settled trip; a new
--     expense on a settled trip reopens it (Done resets as usual).
--  2. Currencies limited to USD, EUR, GBP, MXN.
--  3. Only the creator or the trip owner deletes an expense; save_expense
--     recomputes every base amount server-side (B-08/A-4) and pins the payer
--     to the creator unless the owner is acting (A-5).
--  5. trips bookkeeping columns only change through RPCs/triggers (A-14).
--  6. set_done from a non-member → 42501 (A-17); hot RLS policies use a
--     set-returning membership function instead of a per-row call (B-13).
--  7. request_password_reset returns a masked phone + one-shot ticket, rate
--     limited (B-09).  8. Deleting a trip purges its media (B-18).

-- ---------------------------------------------------------------------------
-- 5. internal-write flag + trips column guard
-- ---------------------------------------------------------------------------
create or replace function private.mark_internal()
returns void language sql as $$ select set_config('checkm8.internal', '1', true); $$;

create or replace function public.guard_trip_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('checkm8.internal', true) is distinct from '1' and (
       new.status is distinct from old.status
    or new.settled_at is distinct from old.settled_at
    or new.closeout_override_by is distinct from old.closeout_override_by
    or new.closeout_override_at is distinct from old.closeout_override_at
    or new.last_activity_at is distinct from old.last_activity_at
    or new.created_by is distinct from old.created_by) then
    raise exception 'trip status and bookkeeping change only through the app actions' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trips_guard_columns on public.trips;
create trigger trips_guard_columns before update on public.trips for each row execute function public.guard_trip_columns();

-- touch_trip_activity: same body, flagged as internal
create or replace function public.touch_trip_activity()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  j jsonb := to_jsonb(new);
  v_trip uuid;
  v_actor uuid;
begin
  perform private.mark_internal();
  if tg_table_name = 'comments' then
    select trip_id into v_trip from public.expenses where id = (j->>'expense_id')::uuid;
    v_actor := (j->>'user_id')::uuid;
  else
    v_trip := (j->>'trip_id')::uuid;
    v_actor := (j->>'created_by')::uuid;
  end if;
  update public.trips
     set last_activity_at = now(),
         status = case when status = 'archived' then 'open' else status end
   where id = v_trip;
  if v_actor is not null then
    update public.trip_members set last_active_at = now() where trip_id = v_trip and user_id = v_actor;
  end if;
  return new;
end $$;

create or replace function public.run_auto_archive()
returns integer language plpgsql security definer set search_path = public, private as $$
declare n int;
begin
  perform private.mark_internal();
  with a as (
    update public.trips set status = 'archived'
     where status = 'open' and last_activity_at < now() - interval '14 days'
    returning id
  ) select count(*) into n from a;
  return n;
end $$;
revoke execute on function public.run_auto_archive() from public, anon, authenticated;

create or replace function public.owner_closeout(p_trip uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_title text;
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the trip owner can close out early' using errcode = '42501'; end if;
  perform private.mark_internal();
  update public.trips set closeout_override_by = auth.uid(), closeout_override_at = now() where id = p_trip and closeout_override_at is null;
  if found then
    select title into v_title from public.trips where id = p_trip;
    perform public.notify_trip(p_trip, 'closeout.override', v_title, public.first_name(auth.uid()) || ' closed out the trip before everyone tapped Done. Expenses already logged still count.', '{}'::jsonb);
  end if;
end $$;

-- set_settled_up: flagged (it settles / reopens the trip)
create or replace function public.set_settled_up(p_trip uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_title text; v_cur text; s record; v_undo jsonb; v_changed jsonb := '[]'::jsonb; v_settled boolean := false;
begin
  if not public.is_trip_member(p_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  perform private.mark_internal();
  select title, base_currency into v_title, v_cur from public.trips where id = p_trip;

  if p_on then
    for s in select * from public.settlements where trip_id = p_trip and from_user = auth.uid() and status = 'pending' loop
      update public.settlements set status = 'marked_paid', marked_at = now() where id = s.id;
      v_changed := v_changed || jsonb_build_object('id', s.id, 'was', s.status);
      perform public.notify(s.to_user, 'payment.marked', v_title, public.first_name(s.from_user) || ' marked ' || public.fmt_cents(s.amount_cents, v_cur) || ' as paid to you.', jsonb_build_object('settlement_id', s.id), p_trip);
    end loop;
    for s in select * from public.settlements where trip_id = p_trip and to_user = auth.uid() and status <> 'confirmed' loop
      update public.settlements set status = 'confirmed', confirmed_at = now(), marked_at = coalesce(marked_at, now()) where id = s.id;
      v_changed := v_changed || jsonb_build_object('id', s.id, 'was', s.status);
    end loop;
    update public.trips t set status = 'settled', settled_at = now()
     where t.id = p_trip and t.status = 'open'
       and not exists (select 1 from public.settlements x where x.trip_id = t.id and x.status = 'pending');
    v_settled := found;
    update public.trip_members set settled_up_at = now(), settled_up_undo = jsonb_build_object('changed', v_changed, 'settled', v_settled), last_active_at = now()
     where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
  else
    select settled_up_undo into v_undo from public.trip_members where trip_id = p_trip and user_id = auth.uid();
    for s in select (c->>'id')::uuid as id, (c->>'was')::public.settlement_status as was from jsonb_array_elements(coalesce(v_undo->'changed', '[]'::jsonb)) c loop
      update public.settlements set status = s.was,
        marked_at = case when s.was = 'pending' then null else marked_at end,
        confirmed_at = case when s.was = 'confirmed' then confirmed_at else null end
       where id = s.id;
    end loop;
    if coalesce((v_undo->>'settled')::boolean, false) then
      update public.trips set status = 'open', settled_at = null where id = p_trip and status = 'settled';
    end if;
    update public.trip_members set settled_up_at = null, settled_up_undo = null, last_active_at = now()
     where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. settlements: re-plan the pending part only; unmark reopens the trip
-- ---------------------------------------------------------------------------
create or replace function public.generate_settlements(p_trip uuid)
returns setof public.settlements language plpgsql security definer set search_path = public, private as $$
declare
  v_cr uuid; v_db uuid; v_cr_net bigint; v_db_net bigint; v_pay integer;
begin
  if not public.is_trip_member(p_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  if not public.gate_open(p_trip) then raise exception 'close out is still locked' using errcode = '23514'; end if;

  create temp table if not exists _nets (user_id uuid primary key, net bigint) on commit drop;
  delete from _nets where true;
  insert into _nets
    select m.user_id,
           coalesce((select sum(pp.base_amount_cents) from public.expense_payers pp join public.expenses e on e.id = pp.expense_id where e.trip_id = p_trip and e.deleted_at is null and pp.user_id = m.user_id), 0)
         - coalesce((select sum(ss.base_share_cents) from public.expense_shares ss join public.expenses e on e.id = ss.expense_id where e.trip_id = p_trip and e.deleted_at is null and ss.user_id = m.user_id), 0)
    from public.trip_members m where m.trip_id = p_trip;

  -- payments already made stay exactly as they are; they reduce what's left to settle
  update _nets n set net = n.net + x.paid from (
    select from_user as user_id, sum(amount_cents) as paid from public.settlements where trip_id = p_trip and status <> 'pending' group by from_user
  ) x where x.user_id = n.user_id;
  update _nets n set net = n.net - x.received from (
    select to_user as user_id, sum(amount_cents) as received from public.settlements where trip_id = p_trip and status <> 'pending' group by to_user
  ) x where x.user_id = n.user_id;

  delete from public.settlements where trip_id = p_trip and status = 'pending';

  loop
    select user_id, net into v_cr, v_cr_net from _nets where net > 0 order by net desc, user_id limit 1;
    select user_id, net into v_db, v_db_net from _nets where net < 0 order by net asc, user_id limit 1;
    exit when v_cr is null or v_db is null;
    v_pay := least(v_cr_net, -v_db_net)::integer;
    insert into public.settlements (trip_id, from_user, to_user, amount_cents) values (p_trip, v_db, v_cr, v_pay);
    update _nets set net = net - v_pay where user_id = v_cr;
    update _nets set net = net + v_pay where user_id = v_db;
    v_cr := null; v_db := null;
  end loop;

  -- nothing left pending and at least one payment exists → the trip is settled; otherwise it's open
  perform private.mark_internal();
  update public.trips t set status = 'settled', settled_at = coalesce(settled_at, now())
   where t.id = p_trip and t.status = 'open'
     and exists (select 1 from public.settlements x where x.trip_id = t.id)
     and not exists (select 1 from public.settlements x where x.trip_id = t.id and x.status = 'pending');
  update public.trips t set status = 'open', settled_at = null
   where t.id = p_trip and t.status = 'settled'
     and exists (select 1 from public.settlements x where x.trip_id = t.id and x.status = 'pending');
  return query select * from public.settlements where trip_id = p_trip order by created_at;
end $$;

create or replace function public.mark_settlement(p_settlement uuid, p_action text)
returns void language plpgsql security definer set search_path = public, private as $$
declare s record; v_title text; v_cur text;
begin
  select * into s from public.settlements where id = p_settlement;
  if s.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.mark_internal();
  if p_action = 'mark_paid' and s.from_user = auth.uid() then
    update public.settlements set status = 'marked_paid', marked_at = now() where id = s.id and status = 'pending';
    if found then
      select title, base_currency into v_title, v_cur from public.trips where id = s.trip_id;
      perform public.notify(s.to_user, 'payment.marked', v_title, public.first_name(s.from_user) || ' marked ' || public.fmt_cents(s.amount_cents, v_cur) || ' as paid to you. Tap Got it once it lands.', jsonb_build_object('settlement_id', s.id), s.trip_id);
    end if;
  elsif p_action = 'unmark' and s.from_user = auth.uid() then
    update public.settlements set status = 'pending', marked_at = null where id = s.id and status = 'marked_paid';
    -- a payment is outstanding again: the trip is not settled any more
    update public.trips set status = 'open', settled_at = null where id = s.trip_id and status = 'settled';
  elsif p_action = 'confirm' and s.to_user = auth.uid() then
    update public.settlements set status = 'confirmed', confirmed_at = now(), marked_at = coalesce(marked_at, now()) where id = s.id;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.trips t set status = 'settled', settled_at = now()
   where t.id = s.trip_id and t.status = 'open'
     and not exists (select 1 from public.settlements x where x.trip_id = t.id and x.status = 'pending');
end $$;

-- ---------------------------------------------------------------------------
-- 2. currencies
-- ---------------------------------------------------------------------------
alter table public.expenses drop constraint if exists expenses_currency_allowed;
alter table public.expenses add constraint expenses_currency_allowed check (currency in ('USD', 'EUR', 'GBP', 'MXN'));
alter table public.trips drop constraint if exists trips_currency_allowed;
alter table public.trips add constraint trips_currency_allowed check (base_currency in ('USD', 'EUR', 'GBP', 'MXN'));

-- ---------------------------------------------------------------------------
-- 3. save_expense: server-side base amounts, payer pinned to the creator,
--    night data consistent, settled trips reopen. delete_expense: creator/owner.
-- ---------------------------------------------------------------------------
create or replace function public.save_expense(p jsonb)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_new boolean := (nullif(p->>'id', '') is null);
  v_trip uuid := (p->>'trip_id')::uuid;
  v_amount integer := (p->>'amount_cents')::integer;
  v_tip integer := coalesce((p->>'tip_cents')::integer, 0);
  v_currency text := upper(coalesce(p->>'currency', 'USD'));
  v_base_currency text;
  v_status public.trip_status;
  v_fx numeric := coalesce((p->>'fx_rate')::numeric, 1);
  v_base integer;
  v_nights integer := (p->>'nights')::integer;
  v_owner boolean;
  v_creator uuid;
  v_payers uuid[];
  v_existing_payers uuid[];
  r jsonb;
  rem integer;
begin
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  select base_currency, status into v_base_currency, v_status from public.trips where id = v_trip;
  if jsonb_typeof(p->'payers') <> 'array' or jsonb_array_length(p->'payers') = 0 then raise exception 'someone has to have paid' using errcode = '23514'; end if;
  if jsonb_typeof(p->'shares') <> 'array' or jsonb_array_length(p->'shares') = 0 then raise exception 'pick at least one person' using errcode = '23514'; end if;
  if v_amount + v_tip <= 0 then raise exception 'enter an amount' using errcode = '23514'; end if;

  -- the rate is locked server-side: base currency means 1, anything else must be positive
  if v_currency = v_base_currency then v_fx := 1; end if;
  if v_fx is null or v_fx <= 0 then raise exception 'the exchange rate has to be above zero' using errcode = '23514'; end if;
  v_base := round((v_amount + v_tip) * v_fx)::integer;

  v_owner := public.is_trip_owner(v_trip);
  select array_agg((x->>'user_id')::uuid order by (x->>'user_id')) into v_payers from jsonb_array_elements(p->'payers') x;

  if v_new then
    v_creator := auth.uid();
    if not v_owner and v_payers <> array[auth.uid()] then
      raise exception 'you can only log expenses you paid for' using errcode = '42501';
    end if;
    perform private.mark_internal();
    if v_status = 'settled' then
      update public.trips set status = 'open', settled_at = null where id = v_trip;  -- a late expense reopens the trip
    end if;
    insert into public.expenses (trip_id, description, category, subcategory, amount_cents, tip_cents, currency, fx_rate, base_amount_cents, split_type, nights, receipt_url, created_by)
    values (v_trip, p->>'description', p->>'category', nullif(p->>'subcategory', ''), v_amount, v_tip, v_currency, v_fx, v_base,
            coalesce((p->>'split_type')::public.split_type, 'equal'), v_nights, nullif(p->>'receipt_url', ''), auth.uid())
    returning id into v_id;
  else
    select created_by into v_creator from public.expenses where id = v_id and trip_id = v_trip and deleted_at is null;
    if v_creator is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
    select array_agg(user_id order by user_id::text) into v_existing_payers from public.expense_payers where expense_id = v_id;
    if not v_owner then
      if auth.uid() = v_creator then
        if v_payers <> array[auth.uid()] then raise exception 'you can only log expenses you paid for' using errcode = '42501'; end if;
      elsif v_payers <> v_existing_payers then
        raise exception 'only the trip owner can change who paid' using errcode = '42501';
      end if;
    end if;
    update public.expenses set
      description = p->>'description', category = p->>'category', subcategory = nullif(p->>'subcategory', ''),
      amount_cents = v_amount, tip_cents = v_tip, currency = v_currency, fx_rate = v_fx, base_amount_cents = v_base,
      split_type = coalesce((p->>'split_type')::public.split_type, split_type), nights = v_nights,
      receipt_url = coalesce(nullif(p->>'receipt_url', ''), receipt_url)
    where id = v_id;
    delete from public.expense_payers where expense_id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  -- payers: client cents, base recomputed (floor, then largest remainder)
  for r in select * from jsonb_array_elements(p->'payers') loop
    insert into public.expense_payers (expense_id, user_id, amount_cents, base_amount_cents)
    values (v_id, (r->>'user_id')::uuid, (r->>'amount_cents')::integer, floor((r->>'amount_cents')::integer * v_fx)::integer);
  end loop;
  select v_base - coalesce(sum(base_amount_cents), 0) into rem from public.expense_payers where expense_id = v_id;
  if rem < 0 then raise exception 'payers add up to more than the total' using errcode = '23514'; end if;
  update public.expense_payers q set base_amount_cents = base_amount_cents + 1
   where (q.expense_id, q.user_id) in (
     select expense_id, user_id from public.expense_payers where expense_id = v_id
      order by (amount_cents * v_fx - floor(amount_cents * v_fx)) desc, user_id limit rem);

  -- shares: same treatment; night data must be consistent when present
  for r in select * from jsonb_array_elements(p->'shares') loop
    if v_nights is not null and jsonb_typeof(r->'night_presence') = 'array' and jsonb_array_length(r->'night_presence') <> v_nights then
      raise exception 'night ticks do not match the number of nights' using errcode = '23514';
    end if;
    insert into public.expense_shares (expense_id, user_id, share_cents, base_share_cents, nights, night_presence)
    values (v_id, (r->>'user_id')::uuid, (r->>'share_cents')::integer, floor((r->>'share_cents')::integer * v_fx)::integer,
            (r->>'nights')::integer,
            case when jsonb_typeof(r->'night_presence') = 'array' then array(select (x)::boolean from jsonb_array_elements_text(r->'night_presence') x) else null end);
  end loop;
  select v_base - coalesce(sum(base_share_cents), 0) into rem from public.expense_shares where expense_id = v_id;
  if rem < 0 then raise exception 'shares add up to more than the total' using errcode = '23514'; end if;
  update public.expense_shares q set base_share_cents = base_share_cents + 1
   where (q.expense_id, q.user_id) in (
     select expense_id, user_id from public.expense_shares where expense_id = v_id
      order by (share_cents * v_fx - floor(share_cents * v_fx)) desc, user_id limit rem);

  if v_new then perform public.notify_expense(v_id, 'create'); end if;  -- edits are history only (spec: Done gate)
  return v_id;
end $$;

create or replace function public.delete_expense(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_trip uuid; v_creator uuid;
begin
  select trip_id, created_by into v_trip, v_creator from public.expenses where id = p_id and deleted_at is null;
  if v_trip is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  if auth.uid() <> v_creator and not public.is_trip_owner(v_trip) then
    raise exception 'only the person who logged this expense or the trip owner can delete it' using errcode = '42501';
  end if;
  perform public.notify_expense(p_id, 'delete');
  update public.expenses set deleted_at = now() where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. set_done rejects non-members; membership as a set for the hot policies
-- ---------------------------------------------------------------------------
create or replace function public.set_done(p_trip uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text; v_last uuid; v_left int;
begin
  if not public.is_trip_member(p_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  update public.trip_members set done_at = case when p_done then now() else null end, last_active_at = now()
   where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
  if not p_done then return; end if;
  select title into v_title from public.trips where id = p_trip;
  if public.gate_open(p_trip) then
    perform public.notify_trip(p_trip, 'closeout.unlocked', v_title, 'Everyone is done. Close out is unlocked - settle up in Venmo.', '{}'::jsonb);
    return;
  end if;
  select count(*), (array_agg(user_id))[1] into v_left, v_last from public.trip_members where trip_id = p_trip and removed_at is null and done_at is null;
  if v_left = 1 then
    perform public.nudge(p_trip, v_last, 'nudge.last_one', v_title, 'Everyone else is done - add anything you paid for and tap Done to unlock close out.');
  end if;
end $$;

-- trips I'm an active member of, evaluated once per statement (hash join), not once per row
create or replace function public.my_trip_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select trip_id from public.trip_members where user_id = auth.uid() and removed_at is null;
$$;
revoke execute on function public.my_trip_ids() from anon;

create or replace function public.my_expense_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.id from public.expenses e where e.trip_id in (select public.my_trip_ids());
$$;
revoke execute on function public.my_expense_ids() from anon;

drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members for select using (trip_id in (select public.my_trip_ids()));
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select using (created_by = auth.uid() or id in (select public.my_trip_ids()));
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select using (trip_id in (select public.my_trip_ids()));
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select using (trip_id in (select public.my_trip_ids()));
drop policy if exists history_select on public.expense_history;
create policy history_select on public.expense_history for select using (trip_id in (select public.my_trip_ids()));
drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements for select using (trip_id in (select public.my_trip_ids()));
-- payers/shares/comments were "for all" through the expense's trip; writes go through save_expense (definer),
-- comments keep their own insert/delete policies
drop policy if exists payers_all on public.expense_payers;
create policy payers_select on public.expense_payers for select using (expense_id in (select public.my_expense_ids()));
drop policy if exists shares_all on public.expense_shares;
create policy shares_select on public.expense_shares for select using (expense_id in (select public.my_expense_ids()));
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (expense_id in (select public.my_expense_ids()));

-- ---------------------------------------------------------------------------
-- 7. password reset: masked phone + one-shot ticket, 5 lookups / identifier / hour
-- ---------------------------------------------------------------------------
create table if not exists private.reset_requests (
  ticket uuid primary key default gen_random_uuid(),
  identifier text not null,
  phone text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists reset_requests_ident_idx on private.reset_requests (identifier, created_at);

create or replace function private.lookup_reset_phone(p_identifier text)
returns text language plpgsql security definer set search_path = public as $$
declare v_phone text; v_digits text;
begin
  if p_identifier is null or length(trim(p_identifier)) = 0 then return null; end if;
  if position('@' in p_identifier) > 0 then
    select phone into v_phone from auth.users
     where lower(email) = lower(trim(p_identifier)) and phone is not null and phone_confirmed_at is not null limit 1;
  else
    v_digits := regexp_replace(p_identifier, '\D', '', 'g');
    if length(v_digits) = 10 then v_digits := '1' || v_digits; end if;
    select phone into v_phone from auth.users where phone = v_digits and phone_confirmed_at is not null limit 1;
  end if;
  return v_phone;
end $$;

create or replace function public.request_password_reset_v2(p_identifier text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_phone text; v_key text := lower(trim(coalesce(p_identifier, ''))); v_ticket uuid;
begin
  if v_key = '' then return null; end if;
  if (select count(*) from private.reset_requests where identifier = v_key and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many reset attempts; try again in an hour' using errcode = '54000';
  end if;
  v_phone := private.lookup_reset_phone(p_identifier);
  insert into private.reset_requests (identifier, phone) values (v_key, v_phone) returning ticket into v_ticket;
  if v_phone is null then return null; end if;
  return jsonb_build_object('masked', '•••• ••• ' || right(v_phone, 4), 'ticket', v_ticket);
end $$;
revoke all on function public.request_password_reset_v2(text) from public;
grant execute on function public.request_password_reset_v2(text) to anon, authenticated;

-- the full number, once, within the hour
create or replace function public.reset_phone_for_ticket(p_ticket uuid)
returns text language plpgsql security definer set search_path = public, private as $$
declare v_phone text;
begin
  update private.reset_requests set used_at = now()
   where ticket = p_ticket and used_at is null and phone is not null and created_at > now() - interval '1 hour'
  returning phone into v_phone;
  if v_phone is null then return null; end if;
  return '+' || v_phone;
end $$;
revoke all on function public.reset_phone_for_ticket(uuid) from public;
grant execute on function public.reset_phone_for_ticket(uuid) to anon, authenticated;

-- legacy signature: masked only, same rate limit
create or replace function public.request_password_reset(p_identifier text)
returns text language plpgsql security definer set search_path = public, private as $$
declare j jsonb;
begin
  j := public.request_password_reset_v2(p_identifier);
  if j is null then return null; end if;
  return j->>'masked';
end $$;

-- ---------------------------------------------------------------------------
-- 8. deleting a trip purges its photos (receipts + cover) via an Edge Function
-- ---------------------------------------------------------------------------
create or replace function public.purge_trip_media()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  perform private.call_function('purge-trip-media', jsonb_build_object('trip_id', old.id));
  return old;
end $$;
drop trigger if exists trips_purge_media on public.trips;
create trigger trips_purge_media before delete on public.trips for each row execute function public.purge_trip_media();
