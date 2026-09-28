-- Checkm8 V1 · notifications core (spec: Push notifications, Done gate,
-- Members, Comments)
--
-- Postgres decides *who* gets told *what*; an Edge Function ("push") does
-- the sending through Expo. The database calls it with pg_net and a shared
-- secret kept in Vault (secret name checkm8_internal_secret; the same value
-- is the function's CHECKM8_INTERNAL_SECRET). Every notification is first
-- written to notification_log, which also drives the 24-hour nudge cap.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- small config table: the Functions base URL (no secrets here)
create table if not exists private.config (key text primary key, value text not null);
insert into private.config (key, value) values ('functions_url', 'https://qywowvkkkxldgxoatdsh.supabase.co/functions/v1')
  on conflict (key) do update set value = excluded.value;

create or replace function private.config_get(p_key text)
returns text language sql stable security definer set search_path = private as $$
  select value from private.config where key = p_key;
$$;

create or replace function private.internal_secret()
returns text language sql stable security definer set search_path = vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'checkm8_internal_secret' limit 1;
$$;

-- POST JSON to one of our Edge Functions with the shared secret. Never raises:
-- a notification must not roll back the write that caused it.
create or replace function private.call_function(p_name text, p_body jsonb)
returns void language plpgsql security definer set search_path = private, extensions as $$
begin
  perform net.http_post(
    url := private.config_get('functions_url') || '/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-checkm8-secret', coalesce(private.internal_secret(), '')),
    body := p_body,
    timeout_milliseconds := 8000);
exception when others then
  raise warning 'call_function % failed: %', p_name, sqlerrm;
end $$;

-- money for message copy: $84.50 / EUR 84.50
create or replace function public.fmt_cents(p_cents bigint, p_currency text default 'USD')
returns text language sql immutable as $$
  select case when upper(coalesce(p_currency, 'USD')) = 'USD' then '$' else upper(p_currency) || ' ' end
         || to_char(p_cents / 100.0, 'FM999,999,999,990.00');
$$;

create or replace function public.first_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(split_part(nullif(trim(display_name), ''), ' ', 1), 'Someone') from public.users where id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- notify: log it, then hand it to the push function
-- ---------------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb, p_trip uuid default null, p_dedupe text default null)
returns bigint language plpgsql security definer set search_path = public, private as $$
declare v_id bigint;
begin
  if p_user is null then return null; end if;
  insert into public.notification_log (user_id, trip_id, kind, dedupe_key, payload)
  values (p_user, p_trip, p_kind, p_dedupe, jsonb_build_object('title', p_title, 'body', p_body, 'data', coalesce(p_data, '{}'::jsonb)))
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then return null; end if;  -- deduped
  perform private.call_function('push', jsonb_build_object('log_id', v_id, 'user_id', p_user, 'title', p_title, 'body', p_body, 'data', coalesce(p_data, '{}'::jsonb) || jsonb_build_object('trip_id', p_trip, 'kind', p_kind)));
  return v_id;
end $$;
revoke execute on function public.notify(uuid, text, text, text, jsonb, uuid, text) from public, anon, authenticated;

-- notify every active member of a trip (optionally skipping one)
create or replace function public.notify_trip(p_trip uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb, p_skip uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from public.trip_members where trip_id = p_trip and removed_at is null and (p_skip is null or user_id <> p_skip) loop
    perform public.notify(m.user_id, p_kind, p_title, p_body, p_data, p_trip);
  end loop;
end $$;
revoke execute on function public.notify_trip(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Done reset: notify each member whose badge a new expense cleared
-- ---------------------------------------------------------------------------
create or replace function public.reset_done_on_new_expense()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; v_title text;
begin
  select title into v_title from public.trips where id = new.trip_id;
  for m in select user_id, done_at from public.trip_members where trip_id = new.trip_id and done_at is not null and removed_at is null loop
    insert into public.expense_history (trip_id, expense_id, actor_id, action, before_json, after_json)
    values (new.trip_id, new.id, new.created_by, 'done.clear', jsonb_build_object('user_id', m.user_id, 'done_at', m.done_at), null);
    if m.user_id <> new.created_by then
      perform public.notify(m.user_id, 'done.reset', v_title,
        public.first_name(new.created_by) || ' added ' || new.description || ' · ' || public.fmt_cents(new.amount_cents + new.tip_cents, new.currency) || '. Your Done badge was reset - check it and tap Done again.',
        jsonb_build_object('expense_id', new.id), new.trip_id);
    end if;
  end loop;
  update public.trip_members set done_at = null where trip_id = new.trip_id and done_at is not null;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- New expense / deleted expense: told to everyone included (except the actor).
-- Shares arrive after the expense row, so these hang off save_expense and
-- delete_expense rather than a row trigger.
-- ---------------------------------------------------------------------------
create or replace function public.notify_expense(p_expense uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare e record; s record; v_title text; v_actor uuid := auth.uid();
begin
  select * into e from public.expenses where id = p_expense;
  if e.id is null then return; end if;
  select title into v_title from public.trips where id = e.trip_id;
  for s in select user_id, share_cents from public.expense_shares where expense_id = e.id and user_id <> coalesce(v_actor, e.created_by) loop
    if p_action = 'create' then
      -- skip anyone who just got the Done-reset message for this expense
      if exists (select 1 from public.notification_log where user_id = s.user_id and kind = 'done.reset' and payload->'data'->>'expense_id' = e.id::text) then continue; end if;
      perform public.notify(s.user_id, 'expense.new', v_title,
        public.first_name(coalesce(v_actor, e.created_by)) || ' added ' || e.description || ' · ' || public.fmt_cents(e.amount_cents + e.tip_cents, e.currency) || ' · your share ' || public.fmt_cents(s.share_cents, e.currency),
        jsonb_build_object('expense_id', e.id), e.trip_id);
    else
      perform public.notify(s.user_id, 'expense.deleted', v_title,
        public.first_name(coalesce(v_actor, e.created_by)) || ' deleted ' || e.description || ' · ' || public.fmt_cents(e.amount_cents + e.tip_cents, e.currency),
        jsonb_build_object('expense_id', e.id), e.trip_id);
    end if;
  end loop;
end $$;
revoke execute on function public.notify_expense(uuid, text) from public, anon, authenticated;

create or replace function public.save_expense(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_new boolean := (nullif(p->>'id', '') is null);
  v_trip uuid := (p->>'trip_id')::uuid;
  v_amount integer := (p->>'amount_cents')::integer;
  v_tip integer := coalesce((p->>'tip_cents')::integer, 0);
  v_fx numeric := coalesce((p->>'fx_rate')::numeric, 1);
  v_base integer := coalesce((p->>'base_amount_cents')::integer, round((v_amount + v_tip) * v_fx)::integer);
  r jsonb;
begin
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  if (select status from public.trips where id = v_trip) = 'settled' then raise exception 'this trip is settled' using errcode = '23514'; end if;
  if jsonb_array_length(coalesce(p->'payers', '[]'::jsonb)) = 0 then raise exception 'someone has to have paid' using errcode = '23514'; end if;
  if jsonb_array_length(coalesce(p->'shares', '[]'::jsonb)) = 0 then raise exception 'pick at least one person' using errcode = '23514'; end if;

  if v_new then
    insert into public.expenses (trip_id, description, category, subcategory, amount_cents, tip_cents, currency, fx_rate, base_amount_cents, split_type, nights, receipt_url, created_by)
    values (v_trip, p->>'description', p->>'category', nullif(p->>'subcategory', ''), v_amount, v_tip, coalesce(p->>'currency', 'USD'), v_fx, v_base,
            coalesce((p->>'split_type')::public.split_type, 'equal'), (p->>'nights')::integer, nullif(p->>'receipt_url', ''), auth.uid())
    returning id into v_id;
  else
    if not exists (select 1 from public.expenses where id = v_id and trip_id = v_trip and deleted_at is null) then
      raise exception 'expense not found' using errcode = 'P0002';
    end if;
    update public.expenses set
      description = p->>'description', category = p->>'category', subcategory = nullif(p->>'subcategory', ''),
      amount_cents = v_amount, tip_cents = v_tip, currency = coalesce(p->>'currency', currency), fx_rate = v_fx, base_amount_cents = v_base,
      split_type = coalesce((p->>'split_type')::public.split_type, split_type), nights = (p->>'nights')::integer,
      receipt_url = coalesce(nullif(p->>'receipt_url', ''), receipt_url)
    where id = v_id;
    delete from public.expense_payers where expense_id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  for r in select * from jsonb_array_elements(p->'payers') loop
    insert into public.expense_payers (expense_id, user_id, amount_cents, base_amount_cents)
    values (v_id, (r->>'user_id')::uuid, (r->>'amount_cents')::integer, coalesce((r->>'base_amount_cents')::integer, round((r->>'amount_cents')::integer * v_fx)::integer));
  end loop;
  for r in select * from jsonb_array_elements(p->'shares') loop
    insert into public.expense_shares (expense_id, user_id, share_cents, base_share_cents, nights, night_presence)
    values (v_id, (r->>'user_id')::uuid, (r->>'share_cents')::integer, coalesce((r->>'base_share_cents')::integer, round((r->>'share_cents')::integer * v_fx)::integer),
            (r->>'nights')::integer,
            case when r ? 'night_presence' then array(select (x)::boolean from jsonb_array_elements_text(r->'night_presence') x) else null end);
  end loop;
  update public.expense_shares s set base_share_cents = base_share_cents + (v_base - (select sum(base_share_cents) from public.expense_shares where expense_id = v_id))
    where s.expense_id = v_id and s.user_id = (select user_id from public.expense_shares where expense_id = v_id order by user_id limit 1);
  update public.expense_payers s set base_amount_cents = base_amount_cents + (v_base - (select sum(base_amount_cents) from public.expense_payers where expense_id = v_id))
    where s.expense_id = v_id and s.user_id = (select user_id from public.expense_payers where expense_id = v_id order by user_id limit 1);

  if v_new then perform public.notify_expense(v_id, 'create'); end if;  -- edits are history only (spec: Done gate)
  return v_id;
end $$;

create or replace function public.delete_expense(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select trip_id into v_trip from public.expenses where id = p_id and deleted_at is null;
  if v_trip is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  perform public.notify_expense(p_id, 'delete');
  update public.expenses set deleted_at = now() where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- set_done: close-out unlocked → everyone; last one out → that member
-- ---------------------------------------------------------------------------
create or replace function public.set_done(p_trip uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text; v_last uuid; v_left int;
begin
  update public.trip_members set done_at = case when p_done then now() else null end, last_active_at = now()
   where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
  if not p_done then return; end if;
  select title into v_title from public.trips where id = p_trip;
  if public.gate_open(p_trip) then
    perform public.notify_trip(p_trip, 'closeout.unlocked', v_title, 'Everyone is done. Close out is unlocked - settle up in Venmo.', '{}'::jsonb);
    return;
  end if;
  select count(*), (array_agg(user_id))[1] into v_left, v_last from public.trip_members where trip_id = p_trip and removed_at is null and done_at is null;  -- no min(uuid) in Postgres
  if v_left = 1 then
    perform public.nudge(p_trip, v_last, 'nudge.last_one', v_title, 'Everyone else is done - add anything you paid for and tap Done to unlock close out.');
  end if;
end $$;

-- A nudge honours the 24-hour per-member cap (spec: Auto-nudges).
create or replace function public.nudge(p_trip uuid, p_user uuid, p_kind text, p_title text, p_body text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_last timestamptz;
begin
  select last_nudged_at into v_last from public.trip_members where trip_id = p_trip and user_id = p_user;
  if v_last is not null and v_last > now() - interval '24 hours' then return false; end if;
  perform public.notify(p_user, p_kind, p_title, p_body, '{}'::jsonb, p_trip);
  update public.trip_members set last_nudged_at = now() where trip_id = p_trip and user_id = p_user;
  return true;
end $$;
revoke execute on function public.nudge(uuid, uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- owner_closeout → everyone; remove_member → that member; mark paid → recipient
-- ---------------------------------------------------------------------------
create or replace function public.owner_closeout(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the trip owner can close out early' using errcode = '42501'; end if;
  update public.trips set closeout_override_by = auth.uid(), closeout_override_at = now() where id = p_trip and closeout_override_at is null;
  if found then
    select title into v_title from public.trips where id = p_trip;
    perform public.notify_trip(p_trip, 'closeout.override', v_title, public.first_name(auth.uid()) || ' closed out the trip before everyone tapped Done. Expenses already logged still count.', '{}'::jsonb);
  end if;
end $$;

create or replace function public.remove_member(p_trip uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the trip owner can remove members' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'the owner cannot remove themselves' using errcode = '23514'; end if;
  update public.trip_members set removed_at = now() where trip_id = p_trip and user_id = p_user and removed_at is null;
  if found then
    select title into v_title from public.trips where id = p_trip;
    perform public.notify(p_user, 'member.removed', v_title, public.first_name(auth.uid()) || ' removed you from this trip.', '{}'::jsonb, p_trip);
  end if;
end $$;

create or replace function public.mark_settlement(p_settlement uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_title text; v_cur text;
begin
  select * into s from public.settlements where id = p_settlement;
  if s.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_action = 'mark_paid' and s.from_user = auth.uid() then
    update public.settlements set status = 'marked_paid', marked_at = now() where id = s.id and status = 'pending';
    if found then
      select title, base_currency into v_title, v_cur from public.trips where id = s.trip_id;
      perform public.notify(s.to_user, 'payment.marked', v_title, public.first_name(s.from_user) || ' marked ' || public.fmt_cents(s.amount_cents, v_cur) || ' as paid to you. Tap Got it once it lands.', jsonb_build_object('settlement_id', s.id), s.trip_id);
    end if;
  elsif p_action = 'unmark' and s.from_user = auth.uid() then
    update public.settlements set status = 'pending', marked_at = null where id = s.id and status = 'marked_paid';
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
-- comments → everyone included on the expense, except the author
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare e record; s record; v_title text;
begin
  select * into e from public.expenses where id = new.expense_id;
  select title into v_title from public.trips where id = e.trip_id;
  for s in select user_id from public.expense_shares where expense_id = e.id and user_id <> new.user_id loop
    perform public.notify(s.user_id, 'comment.new', v_title, public.first_name(new.user_id) || ' on ' || e.description || ': ' || left(new.body, 120), jsonb_build_object('expense_id', e.id), e.trip_id);
  end loop;
  return new;
end $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_new_comment();

-- push function writes receipts back into the log; it uses the service role,
-- so no policy change is needed. Members may read their own log (existing).

-- the Edge Functions (service role) may call notify directly, e.g. send-invite
grant execute on function public.notify(uuid, text, text, text, jsonb, uuid, text) to service_role;
grant execute on function public.notify_trip(uuid, text, text, text, jsonb, uuid) to service_role;
grant usage on schema private to service_role;
