-- Checkm8 V1 · policy fixes and the write RPCs the app needs
--
-- 1. A trip's creator can always read it: the owner-membership row is added
--    by an AFTER trigger, and INSERT … RETURNING checks the SELECT policy
--    before that trigger has run, so the creator was denied their own row.
-- 2. The owner can delete a trip (the spec's destructive action sheet).
-- 3. save_expense / delete_expense: one transaction for the expense, its
--    payers and its shares, so the deferred sum checks see the whole thing.
--    Every REST call is its own transaction, so a client cannot do this.
-- 4. generate_settlements: the greedy settlement in SQL, server-authoritative,
--    written when the gate is open (everyone Done, or the owner's override)
--    and no payment is marked paid yet.
-- 5. remove_member / owner_closeout: the owner's actions, logged.

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select using (created_by = auth.uid() or public.is_trip_member(id));
create policy trips_delete on public.trips for delete using (public.is_trip_owner(id));

-- The fixed category list, mirrored from packages/core/src/categories.ts.
create or replace function public.valid_category(p_category text, p_subcategory text)
returns boolean language sql immutable as $$
  select case p_category
    when 'travel' then p_subcategory in ('airfare', 'hotels', 'rentals', 'vacation-misc')
    when 'dining' then p_subcategory in ('restaurants', 'bars', 'delivery', 'catering')
    when 'transportation' then p_subcategory in ('rideshare', 'parking', 'misc')
    when 'groceries' then p_subcategory is null
    when 'alcohol' then p_subcategory is null
    when 'recreation' then p_subcategory is null
    when 'other' then p_subcategory is null
    else false end;
$$;

alter table public.expenses drop constraint if exists expenses_category_valid;
alter table public.expenses add constraint expenses_category_valid check (public.valid_category(category, subcategory));

-- ---------------------------------------------------------------------------
-- save_expense: insert or update an expense with its payers and shares
-- ---------------------------------------------------------------------------
create or replace function public.save_expense(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
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

  if v_id is null then
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
  -- base shares/payers must sum to base_amount_cents exactly: fold any rounding drift onto the first row
  update public.expense_shares s set base_share_cents = base_share_cents + (v_base - (select sum(base_share_cents) from public.expense_shares where expense_id = v_id))
    where s.expense_id = v_id and s.user_id = (select user_id from public.expense_shares where expense_id = v_id order by user_id limit 1);
  update public.expense_payers s set base_amount_cents = base_amount_cents + (v_base - (select sum(base_amount_cents) from public.expense_payers where expense_id = v_id))
    where s.expense_id = v_id and s.user_id = (select user_id from public.expense_payers where expense_id = v_id order by user_id limit 1);
  return v_id;
end $$;

create or replace function public.delete_expense(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select trip_id into v_trip from public.expenses where id = p_id and deleted_at is null;
  if v_trip is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  update public.expenses set deleted_at = now() where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- generate_settlements: nets in base cents → the fewest payments
-- ---------------------------------------------------------------------------
create or replace function public.gate_open(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select closeout_override_at is not null from public.trips where id = p_trip)
      or (exists (select 1 from public.trip_members where trip_id = p_trip and removed_at is null)
          and not exists (select 1 from public.trip_members where trip_id = p_trip and removed_at is null and done_at is null));
$$;

create or replace function public.generate_settlements(p_trip uuid)
returns setof public.settlements language plpgsql security definer set search_path = public as $$
declare
  nets numeric[]; ids uuid[];
  cr int; db int; pay integer; i int;
begin
  if not public.is_trip_member(p_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  if not public.gate_open(p_trip) then raise exception 'close out is still locked' using errcode = '23514'; end if;
  if exists (select 1 from public.settlements where trip_id = p_trip and status <> 'pending') then
    -- payments already in flight: keep them, return the current plan
    return query select * from public.settlements where trip_id = p_trip order by created_at;
    return;
  end if;
  delete from public.settlements where trip_id = p_trip;

  create temp table _nets on commit drop as
    select m.user_id,
           coalesce((select sum(pp.base_amount_cents) from public.expense_payers pp join public.expenses e on e.id = pp.expense_id where e.trip_id = p_trip and e.deleted_at is null and pp.user_id = m.user_id), 0)
         - coalesce((select sum(ss.base_share_cents) from public.expense_shares ss join public.expenses e on e.id = ss.expense_id where e.trip_id = p_trip and e.deleted_at is null and ss.user_id = m.user_id), 0) as net
    from public.trip_members m where m.trip_id = p_trip;

  loop
    select user_id, net into ids[1], nets[1] from _nets where net > 0 order by net desc, user_id limit 1;   -- largest creditor
    select user_id, net into ids[2], nets[2] from _nets where net < 0 order by net asc, user_id limit 1;    -- largest debtor
    exit when ids[1] is null or ids[2] is null;
    pay := least(nets[1], -nets[2])::integer;
    insert into public.settlements (trip_id, from_user, to_user, amount_cents) values (p_trip, ids[2], ids[1], pay);
    update _nets set net = net - pay where user_id = ids[1];
    update _nets set net = net + pay where user_id = ids[2];
  end loop;
  return query select * from public.settlements where trip_id = p_trip order by created_at;
end $$;

-- ---------------------------------------------------------------------------
-- owner actions
-- ---------------------------------------------------------------------------
create or replace function public.remove_member(p_trip uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the trip owner can remove members' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'the owner cannot remove themselves' using errcode = '23514'; end if;
  update public.trip_members set removed_at = now() where trip_id = p_trip and user_id = p_user and removed_at is null;
end $$;

create or replace function public.owner_closeout(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the trip owner can close out early' using errcode = '42501'; end if;
  update public.trips set closeout_override_by = auth.uid(), closeout_override_at = now() where id = p_trip and closeout_override_at is null;
end $$;

-- Members may see each other's phone only through the roster (display name
-- and Venmo handle); the phone column stays readable for the invite flow.
