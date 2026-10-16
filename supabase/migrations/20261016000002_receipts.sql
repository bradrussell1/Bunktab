-- Itemized receipt splitting (RECEIPT_SPLIT_PROMPT, Part 1), step 2 of 2.
--
--  receipts            one row per photo the AI read: status, totals, the raw
--                      extraction for audits, reconciliation result
--  receipt_items       every purchased line, as read (and as edited by the user)
--  receipt_item_claims who had what: units per person, fractional when shared
--  receipt_charges     tax lines, service charges, auto-gratuity, discounts
--
-- expenses gains tip_mode / tip_percent / receipt_id. Row-level security
-- mirrors expenses: trip members read; members write while the trip is open.
-- Retention: receipts survive archiving; they go only when the trip is deleted
-- (cascade) or the expense is hard-deleted and no other expense points at the
-- photo (trigger below). Soft-deleting an expense keeps the receipt.

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete set null,
  storage_path text not null,                       -- private bucket "receipts/{trip_id}/{receipt_id}.jpg"
  image_sha256 text not null,                       -- dedupe + cache key
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'needs_review', 'failed')),
  model text,
  prompt_version text,
  schema_version text,
  raw_extraction jsonb,                             -- the model's validated JSON, kept for audits and evals
  merchant text,
  receipt_date date,
  currency text,
  subtotal_cents integer,
  tax_cents integer,
  fees_cents integer,
  discounts_cents integer,
  printed_total_cents integer,
  tip_printed_cents integer,
  tax_included boolean not null default false,
  reconciled boolean,                               -- items/subtotal/total checks passed
  error text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  attempts integer not null default 0,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, image_sha256)
);
create index if not exists receipts_trip_idx on public.receipts (trip_id, created_at desc);
create index if not exists receipts_expense_idx on public.receipts (expense_id);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  position integer not null,
  name text not null check (char_length(name) between 1 and 120),
  raw_text text,
  quantity integer not null default 1 check (quantity >= 1),
  line_total_cents integer not null,                -- may be negative for comps/voids
  kind text check (kind in ('food', 'drink', 'alcohol', 'other')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists receipt_items_receipt_idx on public.receipt_items (receipt_id, position);

-- units: how many of the line's quantity this person had. A single-unit dish shared by
-- three people carries 1 for each (equal shares); "Pacifico ×3" split by two carries
-- 1.5 each. Thirds and the like need more than 4 decimals to add back up to the
-- quantity within 1e-6, hence numeric(16,8).
create table if not exists public.receipt_item_claims (
  item_id uuid not null references public.receipt_items (id) on delete cascade,
  user_id uuid not null references public.users (id),
  units numeric(16, 8) not null check (units > 0),
  primary key (item_id, user_id)
);
create index if not exists receipt_item_claims_user_idx on public.receipt_item_claims (user_id);

create table if not exists public.receipt_charges (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  kind text not null check (kind in ('tax', 'service_charge', 'auto_gratuity', 'other_fee', 'discount')),
  label text,
  amount_cents integer not null,
  applies_to text not null default 'all' check (applies_to in ('all', 'food', 'alcohol', 'unknown')),
  item_id uuid references public.receipt_items (id) on delete set null,   -- discount tied to one line
  position integer not null default 0
);
create index if not exists receipt_charges_receipt_idx on public.receipt_charges (receipt_id, position);

-- expenses: the user's tip choice and the photo
alter table public.expenses add column if not exists tip_mode text check (tip_mode is null or tip_mode in ('percent', 'custom', 'none'));
alter table public.expenses add column if not exists tip_percent numeric(5, 2);
alter table public.expenses add column if not exists receipt_id uuid references public.receipts (id) on delete set null;
create index if not exists expenses_receipt_idx on public.expenses (receipt_id);

create or replace function public.touch_receipt_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists receipts_updated_at on public.receipts;
create trigger receipts_updated_at before update on public.receipts for each row execute function public.touch_receipt_updated_at();

-- ---------------------------------------------------------------------------
-- row-level security (same shape as expenses)
-- ---------------------------------------------------------------------------
create or replace function public.receipt_trip(p_receipt uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select trip_id from public.receipts where id = p_receipt;
$$;
create or replace function public.item_trip(p_item uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select r.trip_id from public.receipt_items i join public.receipts r on r.id = i.receipt_id where i.id = p_item;
$$;
create or replace function public.trip_is_open(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = p_trip and status <> 'settled');
$$;
revoke execute on function public.receipt_trip(uuid), public.item_trip(uuid), public.trip_is_open(uuid) from anon;

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.receipt_item_claims enable row level security;
alter table public.receipt_charges enable row level security;

drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts for select using (public.is_trip_member(trip_id));
drop policy if exists receipts_insert on public.receipts;
create policy receipts_insert on public.receipts for insert with check (public.is_trip_member(trip_id) and created_by = auth.uid() and public.trip_is_open(trip_id));
drop policy if exists receipts_update on public.receipts;
create policy receipts_update on public.receipts for update using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id) and public.trip_is_open(trip_id));

drop policy if exists receipt_items_select on public.receipt_items;
create policy receipt_items_select on public.receipt_items for select using (public.is_trip_member(public.receipt_trip(receipt_id)));
drop policy if exists receipt_items_write on public.receipt_items;
create policy receipt_items_write on public.receipt_items for all
  using (public.is_trip_member(public.receipt_trip(receipt_id)) and public.trip_is_open(public.receipt_trip(receipt_id)))
  with check (public.is_trip_member(public.receipt_trip(receipt_id)) and public.trip_is_open(public.receipt_trip(receipt_id)));

drop policy if exists receipt_claims_select on public.receipt_item_claims;
create policy receipt_claims_select on public.receipt_item_claims for select using (public.is_trip_member(public.item_trip(item_id)));
drop policy if exists receipt_claims_write on public.receipt_item_claims;
create policy receipt_claims_write on public.receipt_item_claims for all
  using (public.is_trip_member(public.item_trip(item_id)) and public.trip_is_open(public.item_trip(item_id)))
  with check (public.is_trip_member(public.item_trip(item_id)) and public.trip_is_open(public.item_trip(item_id)));

drop policy if exists receipt_charges_select on public.receipt_charges;
create policy receipt_charges_select on public.receipt_charges for select using (public.is_trip_member(public.receipt_trip(receipt_id)));
drop policy if exists receipt_charges_write on public.receipt_charges;
create policy receipt_charges_write on public.receipt_charges for all
  using (public.is_trip_member(public.receipt_trip(receipt_id)) and public.trip_is_open(public.receipt_trip(receipt_id)))
  with check (public.is_trip_member(public.receipt_trip(receipt_id)) and public.trip_is_open(public.receipt_trip(receipt_id)));

-- the client watches its receipt row flip queued → processing → ready
alter publication supabase_realtime add table public.receipts;

-- ---------------------------------------------------------------------------
-- scan limit (30 a day per user, configurable) and the parse trigger
-- ---------------------------------------------------------------------------
insert into private.config (key, value) values ('receipt_daily_limit', '30') on conflict (key) do nothing;

create or replace function public.guard_receipt_rate()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare n int; lim int := coalesce(nullif(private.config_get('receipt_daily_limit'), '')::int, 30);
begin
  select count(*) into n from public.receipts where created_by = new.created_by and created_at > now() - interval '24 hours';
  if n >= lim then
    raise exception 'scan limit reached: % receipts a day. Try again tomorrow.', lim using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists receipts_rate on public.receipts;
create trigger receipts_rate before insert on public.receipts for each row execute function public.guard_receipt_rate();

-- A queued receipt is handed to the receipt-parse function (pg_net, shared secret).
-- Realtime carries the result back; the app never waits on this call.
create or replace function public.parse_receipt_on_insert()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'queued' then
    perform private.call_function('receipt-parse', jsonb_build_object('receipt_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists receipts_parse on public.receipts;
create trigger receipts_parse after insert on public.receipts for each row execute function public.parse_receipt_on_insert();

-- Re-queue from the app ("Try again"): resets a failed/needs_review read and fires the function.
create or replace function public.requeue_receipt(p_receipt uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_trip uuid;
begin
  select trip_id into v_trip from public.receipts where id = p_receipt;
  if v_trip is null then raise exception 'receipt not found' using errcode = 'P0002'; end if;
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  update public.receipts set status = 'queued', error = null where id = p_receipt;
  perform private.call_function('receipt-parse', jsonb_build_object('receipt_id', p_receipt));
end $$;

-- ---------------------------------------------------------------------------
-- retention: a hard-deleted expense takes its receipt only when nothing else links it
-- ---------------------------------------------------------------------------
create or replace function public.drop_orphan_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The storage object itself is removed by purge-trip-media when the trip goes; a hard-deleted
  -- expense is rare (the product soft-deletes) and its object is swept with the trip.
  if old.receipt_id is not null and not exists (select 1 from public.expenses where receipt_id = old.receipt_id and id <> old.id) then
    delete from public.receipts where id = old.receipt_id;
  end if;
  return old;
end $$;
drop trigger if exists expenses_drop_receipt on public.expenses;
create trigger expenses_drop_receipt after delete on public.expenses for each row execute function public.drop_orphan_receipt();

-- ---------------------------------------------------------------------------
-- save_receipt_expense: one transaction for the expense, payers, shares, claims,
-- tip and history. The receipt-save Edge Function recomputes every share with
-- the shared split engine first and rejects a payload that differs; this RPC
-- re-checks the sums it can check in SQL so a direct call can't break totals.
-- ---------------------------------------------------------------------------
create or replace function public.save_receipt_expense(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_trip uuid := (p->>'trip_id')::uuid;
  v_receipt uuid := nullif(p->>'receipt_id', '')::uuid;
  v_grand integer := (p->>'amount_cents')::integer;        -- subtotal + tax + fees + discounts + tip
  v_tip integer := coalesce((p->>'tip_cents')::integer, 0);
  v_split public.split_type := (p->>'split_type')::public.split_type;
  v_fx numeric := coalesce((p->>'fx_rate')::numeric, 1);
  v_base integer := coalesce((p->>'base_amount_cents')::integer, round(v_grand * v_fx)::integer);
  v_sum integer; v_before jsonb; r jsonb; c jsonb; v_item uuid; v_qty integer; v_units numeric;
begin
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  if (select status from public.trips where id = v_trip) = 'settled' then raise exception 'this trip is settled' using errcode = '23514'; end if;
  if v_split not in ('equal', 'exact', 'itemized') then raise exception 'split_type must be equal, exact or itemized' using errcode = '23514'; end if;
  if v_receipt is not null and not exists (select 1 from public.receipts where id = v_receipt and trip_id = v_trip) then raise exception 'receipt not found' using errcode = 'P0002'; end if;
  if jsonb_array_length(coalesce(p->'shares', '[]'::jsonb)) = 0 then raise exception 'pick at least one person' using errcode = '23514'; end if;
  if (p->>'tip_mode') is not null and (p->>'tip_mode') not in ('percent', 'custom', 'none') then raise exception 'bad tip_mode' using errcode = '23514'; end if;

  -- the account holder pays the whole bill; shares must add back up to it
  select coalesce(sum((s->>'share_cents')::integer), 0) into v_sum from jsonb_array_elements(p->'shares') s;
  if v_sum <> v_grand then raise exception 'shares add up to % cents, not %', v_sum, v_grand using errcode = '23514'; end if;
  if exists (select 1 from jsonb_array_elements(p->'shares') s where (s->>'share_cents')::integer < 0) then raise exception 'a share is negative' using errcode = '23514'; end if;

  if v_id is null then
    insert into public.expenses (trip_id, description, category, subcategory, amount_cents, tip_cents, tip_mode, tip_percent, currency, fx_rate, base_amount_cents, split_type, receipt_id, created_by)
    values (v_trip, coalesce(nullif(p->>'description', ''), 'Receipt'), coalesce(p->>'category', 'dining'), coalesce(nullif(p->>'subcategory', ''), 'restaurants'),
            v_grand - v_tip, v_tip, p->>'tip_mode', (p->>'tip_percent')::numeric, coalesce(p->>'currency', 'USD'), v_fx, v_base, v_split, v_receipt, auth.uid())
    returning id into v_id;
    v_before := null;
  else
    select to_jsonb(e) into v_before from public.expenses e where e.id = v_id and e.trip_id = v_trip and e.deleted_at is null;
    if v_before is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
    update public.expenses set
      description = coalesce(nullif(p->>'description', ''), description), category = coalesce(p->>'category', category), subcategory = coalesce(nullif(p->>'subcategory', ''), subcategory),
      amount_cents = v_grand - v_tip, tip_cents = v_tip, tip_mode = p->>'tip_mode', tip_percent = (p->>'tip_percent')::numeric,
      currency = coalesce(p->>'currency', currency), fx_rate = v_fx, base_amount_cents = v_base, split_type = v_split, receipt_id = coalesce(v_receipt, receipt_id)
    where id = v_id;
    delete from public.expense_payers where expense_id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  -- payer: the account holder, the full grand total
  insert into public.expense_payers (expense_id, user_id, amount_cents, base_amount_cents)
  values (v_id, coalesce(nullif(p->>'payer_id', '')::uuid, auth.uid()), v_grand, v_base);

  for r in select * from jsonb_array_elements(p->'shares') loop
    insert into public.expense_shares (expense_id, user_id, share_cents, base_share_cents)
    values (v_id, (r->>'user_id')::uuid, (r->>'share_cents')::integer, coalesce((r->>'base_share_cents')::integer, round((r->>'share_cents')::integer * v_fx)::integer));
  end loop;
  update public.expense_shares s set base_share_cents = base_share_cents + (v_base - (select sum(base_share_cents) from public.expense_shares where expense_id = v_id))
    where s.expense_id = v_id and s.user_id = (select user_id from public.expense_shares where expense_id = v_id order by user_id limit 1);

  -- itemized: replace the claims; every claimed unit count must fit the line
  if v_split = 'itemized' then
    if v_receipt is null then raise exception 'an itemized split needs a receipt' using errcode = '23514'; end if;
    delete from public.receipt_item_claims where item_id in (select id from public.receipt_items where receipt_id = v_receipt);
    for r in select * from jsonb_array_elements(coalesce(p->'claims', '[]'::jsonb)) loop
      v_item := (r->>'item_id')::uuid;
      select quantity into v_qty from public.receipt_items where id = v_item and receipt_id = v_receipt;
      if v_qty is null then raise exception 'claim for an item not on this receipt' using errcode = '23514'; end if;
      v_units := (r->>'units')::numeric;
      if v_units <= 0 then raise exception 'claimed units must be positive' using errcode = '23514'; end if;
      insert into public.receipt_item_claims (item_id, user_id, units) values (v_item, (r->>'user_id')::uuid, v_units);
    end loop;
    -- multi-unit lines: claimed units can't exceed the quantity (single-unit lines carry equal-share weights)
    if exists (
      select 1 from public.receipt_items i join public.receipt_item_claims cl on cl.item_id = i.id
       where i.receipt_id = v_receipt and i.quantity > 1 group by i.id, i.quantity having sum(cl.units) > i.quantity + 0.000001
    ) then raise exception 'more units claimed than were on the line' using errcode = '23514'; end if;
  end if;

  update public.receipts set expense_id = v_id where id = v_receipt and (expense_id is null or expense_id = v_id);

  insert into public.expense_history (trip_id, expense_id, actor_id, action, before_json, after_json)
  values (v_trip, v_id, auth.uid(), 'receipt.split', v_before,
          jsonb_build_object('split_type', v_split, 'amount_cents', v_grand, 'tip_cents', v_tip, 'tip_mode', p->>'tip_mode', 'receipt_id', v_receipt, 'shares', p->'shares', 'claims', coalesce(p->'claims', '[]'::jsonb)));
  return v_id;
end $$;
