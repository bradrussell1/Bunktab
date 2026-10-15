-- Feedback round 1 (2026-10-15).
--  1. users.first_name / users.last_name. display_name stays populated (composed
--     "First Last") because every reader - the web guest view, first_name(),
--     friends, history, invites - keys off it. A trigger keeps the three in step
--     whichever side is written.
--  2. send_nudge(trip, user): the creator nudges one member who hasn't tapped
--     Done; one notification_log row + push per person per UTC day. No SMS.
--  3. force_close_out(trip): the creator marks every remaining member Done,
--     notifies them, and logs the override. Settlement math is untouched.

-- ---------------------------------------------------------------------------
-- 1. names
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists last_name text;

create or replace function public.sync_user_names()
returns trigger language plpgsql as $$
declare v_first text; v_rest text;
begin
  if new.deleted_at is not null then
    -- anonymised row: no personal names left behind
    new.first_name := null; new.last_name := null;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.display_name is null and (new.first_name is not null or new.last_name is not null) then
      new.display_name := nullif(trim(concat_ws(' ', nullif(trim(new.first_name), ''), nullif(trim(new.last_name), ''))), '');
    elsif new.display_name is not null and new.first_name is null and new.last_name is null then
      v_first := nullif(split_part(trim(new.display_name), ' ', 1), '');
      v_rest := nullif(trim(substr(trim(new.display_name), length(coalesce(v_first, '')) + 1)), '');
      new.first_name := v_first; new.last_name := v_rest;
    end if;
    return new;
  end if;
  if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
    -- the app wrote the parts: compose the display name every reader uses
    new.display_name := coalesce(nullif(trim(concat_ws(' ', nullif(trim(new.first_name), ''), nullif(trim(new.last_name), ''))), ''), new.display_name);
  elsif new.display_name is distinct from old.display_name and new.display_name is not null then
    -- something else wrote display_name (web guest flow, OAuth name): re-derive the parts
    v_first := nullif(split_part(trim(new.display_name), ' ', 1), '');
    v_rest := nullif(trim(substr(trim(new.display_name), length(coalesce(v_first, '')) + 1)), '');
    new.first_name := v_first; new.last_name := v_rest;
  end if;
  return new;
end $$;
drop trigger if exists users_sync_names on public.users;
create trigger users_sync_names before insert or update on public.users for each row execute function public.sync_user_names();

-- backfill: "Mike Chen" → Mike / Chen; a one-word name keeps last_name null and the
-- app asks for it once (profile-completion step)
update public.users
   set first_name = nullif(split_part(trim(display_name), ' ', 1), ''),
       last_name  = nullif(trim(substr(trim(display_name), length(split_part(trim(display_name), ' ', 1)) + 1)), '')
 where deleted_at is null and display_name is not null and first_name is null and last_name is null;

-- sign-up metadata now carries first_name / last_name (display_name still sent too)
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data->>'email', '')));
  v_first text := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  v_last  text := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');
  v_display text := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(trim(concat_ws(' ', v_first, v_last)), ''));
begin
  if v_email is not null and exists (select 1 from public.users u where lower(u.email) = v_email and u.id <> new.id) then
    v_email := null;  -- taken by another row; don't fail the sign-up
  end if;
  insert into public.users (id, phone, email, display_name, first_name, last_name, venmo_username)
  values (new.id, new.phone, v_email, v_display, v_first, v_last,
          nullif(new.raw_user_meta_data->>'venmo_username', ''))
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.users.phone),
    email = coalesce(excluded.email, public.users.email),
    display_name = coalesce(public.users.display_name, excluded.display_name),
    first_name = coalesce(public.users.first_name, excluded.first_name),
    last_name = coalesce(public.users.last_name, excluded.last_name),
    venmo_username = coalesce(public.users.venmo_username, excluded.venmo_username);
  return new;
end $$;

-- notifications say "Mike closed out…": prefer the stored first name
create or replace function public.first_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(first_name), ''), split_part(nullif(trim(display_name), ''), ' ', 1), 'Someone') from public.users where id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- 2. manual nudge (creator → one member), deduped per person per UTC day
-- ---------------------------------------------------------------------------
create or replace function public.send_nudge(p_trip uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare v_title text; v_id bigint; v_key text;
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the dazzle creator can nudge' using errcode = '42501'; end if;
  if p_user = auth.uid() then return false; end if;
  if not exists (select 1 from public.trip_members where trip_id = p_trip and user_id = p_user and removed_at is null and done_at is null) then
    return false;  -- already done, or not on the dazzle
  end if;
  select title into v_title from public.trips where id = p_trip;
  v_key := 'nudge:' || p_trip::text || ':' || p_user::text || ':' || to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  -- notify() writes the notification_log row (on conflict do nothing on the dedupe key) and
  -- hands it to the push function → Expo → that member's devices. No SMS anywhere here.
  v_id := public.notify(p_user, 'nudge.manual', v_title, 'psst, add your receipts to ' || v_title, jsonb_build_object('from', auth.uid()), p_trip, v_key);
  if v_id is null then return false; end if;  -- already nudged today
  update public.trip_members set last_nudged_at = now() where trip_id = p_trip and user_id = p_user;
  return true;
end $$;
revoke execute on function public.send_nudge(uuid, uuid) from public, anon;
grant execute on function public.send_nudge(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. force close-out: every remaining member is marked Done by the creator
-- ---------------------------------------------------------------------------
create or replace function public.force_close_out(p_trip uuid)
returns integer language plpgsql security definer set search_path = public, private as $$
declare v_title text; m record; n int := 0;
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the dazzle creator can close out for everyone' using errcode = '42501'; end if;
  if (select status from public.trips where id = p_trip) <> 'open' then raise exception 'this dazzle is already closed' using errcode = '23514'; end if;
  perform private.mark_internal();
  select title into v_title from public.trips where id = p_trip;
  for m in select user_id from public.trip_members where trip_id = p_trip and removed_at is null and done_at is null loop
    update public.trip_members set done_at = now(), last_active_at = now() where trip_id = p_trip and user_id = m.user_id;
    insert into public.expense_history (trip_id, actor_id, action, after_json)
    values (p_trip, auth.uid(), 'done.force', jsonb_build_object('user_id', m.user_id));
    if m.user_id <> auth.uid() then
      perform public.notify(m.user_id, 'closeout.forced', v_title,
        public.first_name(auth.uid()) || ' closed out the dazzle, so your stripe is in. Expenses already logged still count.', '{}'::jsonb, p_trip);
    end if;
    n := n + 1;
  end loop;
  -- the override is logged (trips_override_log) even though every stripe is now in
  update public.trips set closeout_override_by = auth.uid(), closeout_override_at = now() where id = p_trip and closeout_override_at is null;
  return n;
end $$;
revoke execute on function public.force_close_out(uuid) from public, anon;
grant execute on function public.force_close_out(uuid) to authenticated;
