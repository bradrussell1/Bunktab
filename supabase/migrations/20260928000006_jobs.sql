-- Checkm8 V1 · scheduled jobs and invite texts (spec: Auto-nudges,
-- Auto-archive, Invite links, Security → invite rate limit)
--
-- pg_cron runs plain SQL functions; anything that leaves the database goes
-- through public.notify → the push function, or the send-invite function.

-- ---------------------------------------------------------------------------
-- invites: 50 per user per day, and a text to each invitee on insert
-- ---------------------------------------------------------------------------
create or replace function public.guard_invite_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.invites where invited_by = new.invited_by and created_at > now() - interval '24 hours';
  if n >= 50 then
    raise exception 'invite limit reached: 50 invites a day. Try again tomorrow.' using errcode = '54000';
  end if;
  -- normalise to digits only (the users.phone column is stored without "+")
  new.phone := regexp_replace(new.phone, '\D', '', 'g');
  return new;
end $$;
drop trigger if exists invites_rate on public.invites;
create trigger invites_rate before insert on public.invites for each row execute function public.guard_invite_rate();

create or replace function public.send_invite_text()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  perform private.call_function('send-invite', jsonb_build_object('invite_id', new.id));
  return new;
end $$;
drop trigger if exists invites_send on public.invites;
create trigger invites_send after insert on public.invites for each row execute function public.send_invite_text();

-- ---------------------------------------------------------------------------
-- nudges (hourly): 24h of inactivity from a member who isn't Done, on an
-- open trip that has started. Capped at one nudge per member per 24h by
-- public.nudge (last_nudged_at).
-- ---------------------------------------------------------------------------
create or replace function public.run_nudges()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select m.trip_id, m.user_id, t.title
      from public.trip_members m
      join public.trips t on t.id = m.trip_id
     where t.status = 'open'
       and t.start_date <= current_date
       and m.removed_at is null
       and m.done_at is null
       and m.last_active_at < now() - interval '24 hours'
       and (m.last_nudged_at is null or m.last_nudged_at < now() - interval '24 hours')
       and exists (select 1 from public.expenses e where e.trip_id = t.id and e.deleted_at is null)  -- a trip nobody has used yet isn't nagged
  loop
    if public.nudge(r.trip_id, r.user_id, 'nudge.inactive', r.title, 'Anything else from the trip? Add what you paid for, or tap Done if you''re all set.') then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.run_nudges() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- auto-archive (daily): 14 quiet days → Past. Activity un-archives
-- (touch_trip_activity already flips archived → open).
-- ---------------------------------------------------------------------------
create or replace function public.run_auto_archive()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with a as (
    update public.trips set status = 'archived'
     where status = 'open' and last_activity_at < now() - interval '14 days'
    returning id
  ) select count(*) into n from a;
  return n;
end $$;
revoke execute on function public.run_auto_archive() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- invite expiry (daily): unused links die after 14 days
-- ---------------------------------------------------------------------------
create or replace function public.run_invite_expiry()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with a as (
    update public.invites set status = 'expired' where status = 'pending' and expires_at <= now() returning id
  ) select count(*) into n from a;
  return n;
end $$;
revoke execute on function public.run_invite_expiry() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- schedules (idempotent)
-- ---------------------------------------------------------------------------
do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in ('checkm8_nudges', 'checkm8_auto_archive', 'checkm8_invite_expiry') loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule('checkm8_nudges', '15 * * * *', $c$ select public.run_nudges(); $c$);
  perform cron.schedule('checkm8_auto_archive', '30 9 * * *', $c$ select public.run_auto_archive(); $c$);   -- 09:30 UTC daily
  perform cron.schedule('checkm8_invite_expiry', '45 9 * * *', $c$ select public.run_invite_expiry(); $c$);
end $$;
