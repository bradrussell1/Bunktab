-- 1. save_expense: a JSON null under night_presence passed the `?` key test
--    and then failed jsonb_array_elements ("cannot extract elements from a
--    scalar"). Only arrays are read now.
-- 2. "Settled up" per member: a self-declared flag that marks everything
--    involving me as paid/confirmed and greys my view of the trip.
-- 3. users.email for the account flows (login by email or phone).

alter table public.users add column if not exists email text;
create unique index if not exists users_email_key on public.users (lower(email)) where email is not null;

alter table public.trip_members add column if not exists settled_up_at timestamptz;

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
  if jsonb_typeof(p->'payers') <> 'array' or jsonb_array_length(p->'payers') = 0 then raise exception 'someone has to have paid' using errcode = '23514'; end if;
  if jsonb_typeof(p->'shares') <> 'array' or jsonb_array_length(p->'shares') = 0 then raise exception 'pick at least one person' using errcode = '23514'; end if;

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
            case when jsonb_typeof(r->'night_presence') = 'array' then array(select (x)::boolean from jsonb_array_elements_text(r->'night_presence') x) else null end);
  end loop;
  update public.expense_shares s set base_share_cents = base_share_cents + (v_base - (select sum(base_share_cents) from public.expense_shares where expense_id = v_id))
    where s.expense_id = v_id and s.user_id = (select user_id from public.expense_shares where expense_id = v_id order by user_id limit 1);
  update public.expense_payers s set base_amount_cents = base_amount_cents + (v_base - (select sum(base_amount_cents) from public.expense_payers where expense_id = v_id))
    where s.expense_id = v_id and s.user_id = (select user_id from public.expense_payers where expense_id = v_id order by user_id limit 1);

  if v_new then perform public.notify_expense(v_id, 'create'); end if;  -- edits are history only (spec: Done gate)
  return v_id;
end $$;

-- set_settled_up: "I've paid and/or been paid." On: every payment I owe is
-- marked paid and every payment owed to me is confirmed; the trip settles
-- when nothing is pending. Off: my outgoing payments go back to pending and
-- my incoming ones back to marked_paid (the payer's claim stands).
create or replace function public.set_settled_up(p_trip uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text; v_cur text; s record;
begin
  if not public.is_trip_member(p_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  update public.trip_members set settled_up_at = case when p_on then now() else null end, last_active_at = now()
   where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
  select title, base_currency into v_title, v_cur from public.trips where id = p_trip;
  if p_on then
    for s in select * from public.settlements where trip_id = p_trip and from_user = auth.uid() and status = 'pending' loop
      update public.settlements set status = 'marked_paid', marked_at = now() where id = s.id;
      perform public.notify(s.to_user, 'payment.marked', v_title, public.first_name(s.from_user) || ' marked ' || public.fmt_cents(s.amount_cents, v_cur) || ' as paid to you.', jsonb_build_object('settlement_id', s.id), p_trip);
    end loop;
    update public.settlements set status = 'confirmed', confirmed_at = now(), marked_at = coalesce(marked_at, now())
     where trip_id = p_trip and to_user = auth.uid() and status <> 'confirmed';
    update public.trips t set status = 'settled', settled_at = now()
     where t.id = p_trip and t.status = 'open'
       and not exists (select 1 from public.settlements x where x.trip_id = t.id and x.status = 'pending');
  else
    update public.settlements set status = 'pending', marked_at = null where trip_id = p_trip and from_user = auth.uid() and status = 'marked_paid';
    update public.settlements set status = 'marked_paid', confirmed_at = null where trip_id = p_trip and to_user = auth.uid() and status = 'confirmed';
    update public.trips set status = 'open', settled_at = null where id = p_trip and status = 'settled'
      and exists (select 1 from public.settlements x where x.trip_id = id and x.status = 'pending');
  end if;
end $$;
grant execute on function public.set_settled_up(uuid, boolean) to authenticated;
