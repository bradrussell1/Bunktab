-- Checkm8 V1 · foundation schema (spec: Data model, Security and privacy)
--
-- Ten tables from the spec plus three the spec's features need but its
-- table list omits (flagged in the build notes): devices (Expo push tokens),
-- notification_log (the once-per-24h nudge rule and dedupe), and
-- expense_history carrying trip_id with a nullable expense_id so owner
-- overrides and member removals - trip-level events the spec files under
-- expense_history - have a home.
--
-- Money is integer cents. Every table has row-level security; a user reads
-- or writes a trip's data only as a member of that trip, enforced here, not
-- in the app. Server-side checks (split sums, payer sums, membership) are
-- deferred constraint triggers so a tampered client cannot write bad numbers.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- users: one row per auth user; phone is the login identity
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  display_name text,
  photo_url text,
  venmo_username text,
  created_at timestamptz not null default now(),
  -- account deletion anonymises the name and clears personal fields (spec:
  -- Data protection); the row stays so other members' totals stay correct
  deleted_at timestamptz
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, phone) values (new.id, new.phone)
  on conflict (id) do update set phone = excluded.phone;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of phone on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create type public.trip_status as enum ('open', 'settled', 'archived');

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 250),
  cover_photo_url text,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  base_currency char(3) not null default 'USD',
  status public.trip_status not null default 'open',
  closeout_override_by uuid references public.users (id),
  closeout_override_at timestamptz,
  settled_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);
create index if not exists trips_activity_idx on public.trips (status, last_activity_at);

-- ---------------------------------------------------------------------------
-- trip_members
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'member');
create type public.joined_via as enum ('app', 'web');

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.member_role not null default 'member',
  done_at timestamptz,                 -- null = not done; cleared on new expenses
  joined_via public.joined_via not null default 'app',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,              -- blocked when the member has payer or share rows
  last_active_at timestamptz not null default now(),  -- inactivity nudges (added)
  last_nudged_at timestamptz,          -- nudges repeat at most every 24h (added)
  primary key (trip_id, user_id)
);
create index if not exists trip_members_user_idx on public.trip_members (user_id) where removed_at is null;

-- ---------------------------------------------------------------------------
-- invites: the token powers the web guest link
-- ---------------------------------------------------------------------------
create type public.invite_status as enum ('pending', 'accepted', 'expired', 'revoked');

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  phone text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status public.invite_status not null default 'pending',
  invited_by uuid not null references public.users (id),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index if not exists invites_phone_idx on public.invites (phone) where status = 'pending';

-- ---------------------------------------------------------------------------
-- expenses (+ payers, shares)
-- ---------------------------------------------------------------------------
create type public.split_type as enum ('equal', 'exact', 'percent', 'shares', 'nights');

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 140),
  category text not null,
  subcategory text,
  amount_cents integer not null check (amount_cents >= 0),      -- receipt total, expense currency
  tip_cents integer not null default 0 check (tip_cents >= 0),  -- separate field; split with the same people
  currency char(3) not null,
  fx_rate numeric(18, 8) not null default 1,                     -- base per 1 unit of currency, locked at save
  base_amount_cents integer not null,                            -- (amount + tip) × fx_rate, rounded
  split_type public.split_type not null default 'equal',
  nights integer check (nights is null or nights > 0),           -- lodging splits
  receipt_url text,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                                          -- soft delete: hidden from totals, kept in history
);
create index if not exists expenses_trip_idx on public.expenses (trip_id, created_at desc) where deleted_at is null;

create table if not exists public.expense_payers (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.users (id),
  amount_cents integer not null check (amount_cents >= 0),       -- expense currency
  base_amount_cents integer not null,
  primary key (expense_id, user_id)
);

create table if not exists public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.users (id),
  share_cents integer not null check (share_cents >= 0),         -- expense currency
  base_share_cents integer not null,
  nights integer,                                                 -- nights stayed (lodging)
  night_presence boolean[],                                       -- which nights (lodging)
  primary key (expense_id, user_id)
);
create index if not exists expense_shares_user_idx on public.expense_shares (user_id);
create index if not exists expense_payers_user_idx on public.expense_payers (user_id);

-- ---------------------------------------------------------------------------
-- expense_history: the audit trail (also trip-level events - see header)
-- ---------------------------------------------------------------------------
create table if not exists public.expense_history (
  id bigserial primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete cascade,
  actor_id uuid references public.users (id),
  action text not null,   -- expense.create | expense.update | expense.delete | member.remove | closeout.override | done.set | done.clear
  before_json jsonb,
  after_json jsonb,
  at timestamptz not null default now()
);
create index if not exists expense_history_trip_idx on public.expense_history (trip_id, at desc);
create index if not exists expense_history_expense_idx on public.expense_history (expense_id, at desc);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.users (id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_expense_idx on public.comments (expense_id, created_at);

-- ---------------------------------------------------------------------------
-- settlements: written when close-out unlocks; confirmed is optional
-- ---------------------------------------------------------------------------
create type public.settlement_status as enum ('pending', 'marked_paid', 'confirmed');

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_user uuid not null references public.users (id),
  to_user uuid not null references public.users (id),
  amount_cents integer not null check (amount_cents > 0),        -- base currency
  status public.settlement_status not null default 'pending',
  marked_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, from_user, to_user)
);

-- ---------------------------------------------------------------------------
-- devices (added): Expo push tokens
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  user_id uuid not null references public.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_push_token)
);

-- ---------------------------------------------------------------------------
-- notification_log (added): what was sent, for dedupe and the 24h nudge rule
-- ---------------------------------------------------------------------------
create table if not exists public.notification_log (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  kind text not null,
  dedupe_key text unique,
  payload jsonb,
  sent_at timestamptz not null default now()
);

-- ===========================================================================
-- helpers
-- ===========================================================================

-- Active membership check used by every policy. SECURITY DEFINER so it can
-- read trip_members without recursing into trip_members' own policy.
create or replace function public.is_trip_member(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip and m.user_id = auth.uid() and m.removed_at is null
  );
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip and m.user_id = auth.uid() and m.role = 'owner' and m.removed_at is null
  );
$$;

create or replace function public.expense_trip(p_expense uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select trip_id from public.expenses where id = p_expense;
$$;

-- Two users share a trip - lets members see each other's name / Venmo handle.
create or replace function public.shares_trip_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members a
    join public.trip_members b on b.trip_id = a.trip_id
    where a.user_id = auth.uid() and a.removed_at is null
      and b.user_id = p_user and b.removed_at is null
  );
$$;

-- ===========================================================================
-- triggers: activity, Done reset, history, validation
-- ===========================================================================

create or replace function public.touch_trip_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  v_trip := coalesce(new.trip_id, (select trip_id from public.expenses where id = new.expense_id));
  update public.trips
     set last_activity_at = now(),
         status = case when status = 'archived' then 'open' else status end  -- activity un-archives
   where id = v_trip;
  if tg_table_name in ('expenses', 'comments') then
    update public.trip_members set last_active_at = now()
     where trip_id = v_trip and user_id = coalesce(new.created_by, new.user_id);
  end if;
  return new;
end $$;

drop trigger if exists expenses_touch on public.expenses;
create trigger expenses_touch after insert or update on public.expenses for each row execute function public.touch_trip_activity();
drop trigger if exists comments_touch on public.comments;
create trigger comments_touch after insert on public.comments for each row execute function public.touch_trip_activity();

-- A NEW expense clears every Done badge on the trip (edits do not) and logs it.
create or replace function public.reset_done_on_new_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.expense_history (trip_id, expense_id, actor_id, action, before_json, after_json)
  select new.trip_id, new.id, new.created_by, 'done.clear', jsonb_build_object('user_id', m.user_id, 'done_at', m.done_at), null
    from public.trip_members m where m.trip_id = new.trip_id and m.done_at is not null and m.removed_at is null;
  update public.trip_members set done_at = null where trip_id = new.trip_id and done_at is not null;
  return new;
end $$;

drop trigger if exists expenses_reset_done on public.expenses;
create trigger expenses_reset_done after insert on public.expenses for each row execute function public.reset_done_on_new_expense();

-- Every create, edit and soft-delete of an expense is logged with old and new values.
create or replace function public.log_expense_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.expense_history (trip_id, expense_id, actor_id, action, after_json)
    values (new.trip_id, new.id, auth.uid(), 'expense.create', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    insert into public.expense_history (trip_id, expense_id, actor_id, action, before_json, after_json)
    values (new.trip_id, new.id, auth.uid(),
            case when new.deleted_at is not null and old.deleted_at is null then 'expense.delete' else 'expense.update' end,
            to_jsonb(old), to_jsonb(new));
    return new;
  end if;
  return old;
end $$;

drop trigger if exists expenses_history_ins on public.expenses;
create trigger expenses_history_ins after insert on public.expenses for each row execute function public.log_expense_history();
drop trigger if exists expenses_history_upd on public.expenses;
create trigger expenses_history_upd before update on public.expenses for each row execute function public.log_expense_history();

-- Server-side validation at commit: payers and shares sum to amount + tip in
-- the expense currency, base amounts sum to base_amount_cents, and everyone
-- named is a member of the trip. Deferred so rows can arrive one by one.
create or replace function public.validate_expense_sums()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_expense uuid := coalesce(new.expense_id, old.expense_id);
  e record;
  v_pay integer; v_pay_base integer; v_share integer; v_share_base integer; v_bad integer;
begin
  select * into e from public.expenses where id = v_expense;
  if e.id is null or e.deleted_at is not null then return null; end if;
  select coalesce(sum(amount_cents), 0), coalesce(sum(base_amount_cents), 0) into v_pay, v_pay_base from public.expense_payers where expense_id = e.id;
  select coalesce(sum(share_cents), 0), coalesce(sum(base_share_cents), 0) into v_share, v_share_base from public.expense_shares where expense_id = e.id;
  if v_pay <> e.amount_cents + e.tip_cents then
    raise exception 'payers add up to % cents, expense is % cents', v_pay, e.amount_cents + e.tip_cents using errcode = '23514';
  end if;
  if v_share <> e.amount_cents + e.tip_cents then
    raise exception 'shares add up to % cents, expense is % cents', v_share, e.amount_cents + e.tip_cents using errcode = '23514';
  end if;
  if v_pay_base <> e.base_amount_cents or v_share_base <> e.base_amount_cents then
    raise exception 'base amounts do not match base_amount_cents' using errcode = '23514';
  end if;
  select count(*) into v_bad from (
    select user_id from public.expense_payers where expense_id = e.id
    union select user_id from public.expense_shares where expense_id = e.id
  ) u where not exists (select 1 from public.trip_members m where m.trip_id = e.trip_id and m.user_id = u.user_id and m.removed_at is null);
  if v_bad > 0 then
    raise exception 'a payer or participant is not a member of this trip' using errcode = '42501';
  end if;
  return null;
end $$;

drop trigger if exists payers_validate on public.expense_payers;
create constraint trigger payers_validate after insert or update or delete on public.expense_payers
  deferrable initially deferred for each row execute function public.validate_expense_sums();
drop trigger if exists shares_validate on public.expense_shares;
create constraint trigger shares_validate after insert or update or delete on public.expense_shares
  deferrable initially deferred for each row execute function public.validate_expense_sums();

-- A member with any payer or share rows cannot be removed (spec: Members).
create or replace function public.guard_member_removal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.removed_at is not null and old.removed_at is null then
    if exists (select 1 from public.expense_payers p join public.expenses e on e.id = p.expense_id where e.trip_id = new.trip_id and p.user_id = new.user_id and e.deleted_at is null)
       or exists (select 1 from public.expense_shares s join public.expenses e on e.id = s.expense_id where e.trip_id = new.trip_id and s.user_id = new.user_id and e.deleted_at is null) then
      raise exception 'members with expenses cannot be removed' using errcode = '23514';
    end if;
    insert into public.expense_history (trip_id, actor_id, action, before_json)
    values (new.trip_id, auth.uid(), 'member.remove', jsonb_build_object('user_id', new.user_id));
  end if;
  if new.done_at is distinct from old.done_at then
    insert into public.expense_history (trip_id, actor_id, action, before_json, after_json)
    values (new.trip_id, auth.uid(), case when new.done_at is null then 'done.clear' else 'done.set' end,
            jsonb_build_object('user_id', new.user_id, 'done_at', old.done_at), jsonb_build_object('user_id', new.user_id, 'done_at', new.done_at));
  end if;
  return new;
end $$;

drop trigger if exists members_guard on public.trip_members;
create trigger members_guard before update on public.trip_members for each row execute function public.guard_member_removal();

-- The owner's forced close-out is logged (spec: Done gate).
create or replace function public.log_closeout_override()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.closeout_override_at is not null and old.closeout_override_at is null then
    insert into public.expense_history (trip_id, actor_id, action, after_json)
    values (new.id, new.closeout_override_by, 'closeout.override', jsonb_build_object('at', new.closeout_override_at));
  end if;
  return new;
end $$;
drop trigger if exists trips_override_log on public.trips;
create trigger trips_override_log after update on public.trips for each row execute function public.log_closeout_override();

-- Creating a trip makes its creator the owner member.
create or replace function public.add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trips_owner on public.trips;
create trigger trips_owner after insert on public.trips for each row execute function public.add_owner_member();

-- ===========================================================================
-- RPCs the app calls
-- ===========================================================================

-- Accept an invite: the verified phone must match the invite's; links any
-- pending invites for that phone (spec: Login → auto-links trips).
create or replace function public.accept_invites_for_me(p_via public.joined_via default 'app')
returns setof uuid language plpgsql security definer set search_path = public as $$
declare v_phone text; r record;
begin
  select phone into v_phone from public.users where id = auth.uid();
  if v_phone is null then return; end if;
  for r in select * from public.invites where phone = v_phone and status = 'pending' and expires_at > now() loop
    insert into public.trip_members (trip_id, user_id, role, joined_via) values (r.trip_id, auth.uid(), 'member', p_via)
    on conflict (trip_id, user_id) do update set removed_at = null;
    update public.invites set status = 'accepted' where id = r.id;
    return next r.trip_id;
  end loop;
end $$;

-- Accept one invite by token (the web guest link), after phone verification.
create or replace function public.accept_invite_token(p_token text, p_via public.joined_via default 'web')
returns uuid language plpgsql security definer set search_path = public as $$
declare r record; v_phone text;
begin
  select * into r from public.invites where token = p_token;
  if r.id is null then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' or r.expires_at <= now() then raise exception 'invite expired' using errcode = 'P0002'; end if;
  select phone into v_phone from public.users where id = auth.uid();
  if v_phone is distinct from r.phone then raise exception 'this invite was sent to a different number' using errcode = '42501'; end if;
  insert into public.trip_members (trip_id, user_id, role, joined_via) values (r.trip_id, auth.uid(), 'member', p_via)
  on conflict (trip_id, user_id) do update set removed_at = null;
  update public.invites set status = 'accepted' where id = r.id;
  return r.trip_id;
end $$;

-- Toggle my Done badge on a trip.
create or replace function public.set_done(p_trip uuid, p_done boolean)
returns void language sql security definer set search_path = public as $$
  update public.trip_members set done_at = case when p_done then now() else null end
  where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
$$;

-- ===========================================================================
-- row-level security
-- ===========================================================================
alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_shares enable row level security;
alter table public.expense_history enable row level security;
alter table public.comments enable row level security;
alter table public.settlements enable row level security;
alter table public.devices enable row level security;
alter table public.notification_log enable row level security;

-- users: me, or anyone I share a trip with; I edit only my own row
create policy users_select on public.users for select using (id = auth.uid() or public.shares_trip_with(id));
create policy users_update on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- trips: members read; anyone signed in creates (becoming owner); owner edits
create policy trips_select on public.trips for select using (public.is_trip_member(id));
create policy trips_insert on public.trips for insert with check (created_by = auth.uid());
create policy trips_update on public.trips for update using (public.is_trip_owner(id)) with check (public.is_trip_owner(id));

-- trip_members: members see the roster; the owner adds/removes; I toggle my own Done
create policy members_select on public.trip_members for select using (public.is_trip_member(trip_id));
create policy members_insert on public.trip_members for insert with check (public.is_trip_owner(trip_id));
create policy members_update_self on public.trip_members for update using (user_id = auth.uid()) with check (user_id = auth.uid() and removed_at is null);
create policy members_update_owner on public.trip_members for update using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- invites: members see and send; tokens are only ever redeemed through the RPC
create policy invites_select on public.invites for select using (public.is_trip_member(trip_id));
create policy invites_insert on public.invites for insert with check (public.is_trip_member(trip_id) and invited_by = auth.uid());
create policy invites_update on public.invites for update using (public.is_trip_owner(trip_id));

-- expenses and their rows: any active member of the trip
create policy expenses_select on public.expenses for select using (public.is_trip_member(trip_id));
create policy expenses_insert on public.expenses for insert with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy expenses_update on public.expenses for update using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy payers_all on public.expense_payers for all using (public.is_trip_member(public.expense_trip(expense_id))) with check (public.is_trip_member(public.expense_trip(expense_id)));
create policy shares_all on public.expense_shares for all using (public.is_trip_member(public.expense_trip(expense_id))) with check (public.is_trip_member(public.expense_trip(expense_id)));

create policy history_select on public.expense_history for select using (public.is_trip_member(trip_id));

create policy comments_select on public.comments for select using (public.is_trip_member(public.expense_trip(expense_id)));
create policy comments_insert on public.comments for insert with check (public.is_trip_member(public.expense_trip(expense_id)) and user_id = auth.uid());

-- settlements: members read; the payer marks paid, the recipient confirms (writes go through the RPC below)
create policy settlements_select on public.settlements for select using (public.is_trip_member(trip_id));

-- devices / notification log: mine only
create policy devices_all on public.devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_select on public.notification_log for select using (user_id = auth.uid());

-- Settlement writes are RPCs so status transitions are checked server-side.
create or replace function public.mark_settlement(p_settlement uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.settlements where id = p_settlement;
  if s.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_action = 'mark_paid' and s.from_user = auth.uid() then
    update public.settlements set status = 'marked_paid', marked_at = now() where id = s.id and status = 'pending';
  elsif p_action = 'unmark' and s.from_user = auth.uid() then
    update public.settlements set status = 'pending', marked_at = null where id = s.id and status = 'marked_paid';
  elsif p_action = 'confirm' and s.to_user = auth.uid() then
    update public.settlements set status = 'confirmed', confirmed_at = now(), marked_at = coalesce(marked_at, now()) where id = s.id;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- the trip is settled once every payment is marked paid (confirmation optional)
  update public.trips t set status = 'settled', settled_at = now()
   where t.id = s.trip_id and t.status = 'open'
     and not exists (select 1 from public.settlements x where x.trip_id = t.id and x.status = 'pending');
end $$;

-- ===========================================================================
-- realtime: Done badges, expenses and settlements update live
-- ===========================================================================
do $$ begin
  alter publication supabase_realtime add table public.trip_members;
  alter publication supabase_realtime add table public.expenses;
  alter publication supabase_realtime add table public.settlements;
exception when others then null; end $$;

-- ===========================================================================
-- storage: private buckets, objects under <trip_id>/..., members only
-- ===========================================================================
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('covers', 'covers', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false) on conflict (id) do nothing;

create policy receipts_members on storage.objects for all
  using (bucket_id in ('receipts', 'covers') and public.is_trip_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id in ('receipts', 'covers') and public.is_trip_member(((storage.foldername(name))[1])::uuid));
create policy avatars_own on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_read_shared on storage.objects for select
  using (bucket_id = 'avatars' and public.shares_trip_with(((storage.foldername(name))[1])::uuid));
