-- Inviting someone who already has a Checkm8 account (a users row with that
-- phone and a display name) adds them to the trip straight away: the invite
-- is marked accepted, they get a push, and no text message is sent. Texts go
-- only to numbers with no account (user decision 2026-09-30).
create or replace function public.attach_known_user_invite()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare v_user uuid; v_title text; v_who text;
begin
  -- phone is already digits-only here (guard_invite_rate runs first: "invites_rate" < "invites_zknown")
  select id into v_user from public.users where phone = new.phone and display_name is not null and deleted_at is null limit 1;
  if v_user is null or v_user = new.invited_by then return new; end if;

  insert into public.trip_members (trip_id, user_id, role, joined_via)
  values (new.trip_id, v_user, 'member', 'app')
  on conflict (trip_id, user_id) do update set removed_at = null, done_at = null, last_active_at = now()
    where public.trip_members.removed_at is not null;

  new.status := 'accepted';
  select title into v_title from public.trips where id = new.trip_id;
  v_who := public.first_name(new.invited_by);
  perform public.notify(v_user, 'trip.invited', coalesce(v_title, 'Checkm8'), v_who || ' added you to this trip.', '{}'::jsonb, new.trip_id, 'invite:' || new.id::text);
  return new;
end $$;

drop trigger if exists invites_zknown on public.invites;
create trigger invites_zknown before insert on public.invites for each row execute function public.attach_known_user_invite();

-- only pending invites go to the text function
create or replace function public.send_invite_text()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'pending' then
    perform private.call_function('send-invite', jsonb_build_object('invite_id', new.id));
  end if;
  return new;
end $$;
