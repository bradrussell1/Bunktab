-- Hardening from QA report B (docs/qa/qa-report-B-2026-10-01.md).
--
-- B-01  members could PATCH their own trip_members row to role = owner.
-- B-02/03/04  members could write expenses rows directly (money fields,
--        trip_id, inserts with no payers/shares), bypassing save_expense.
-- B-05  any member could add any user, and re-add people the owner removed.
-- B-08/B-19  fx_rate / base cents / zero totals accepted.
-- B-16  helper functions callable by anon.
-- B-20  no comments delete policy.  B-22  self-invites accepted.

-- ---------------------------------------------------------------------------
-- trip_members: no self-service updates at all (Done and Settled up are RPCs);
-- role / identity columns frozen; re-activation only on the owner's say-so
-- ---------------------------------------------------------------------------
drop policy if exists members_update_self on public.trip_members;

create or replace function public.guard_member_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if new.trip_id <> old.trip_id or new.user_id <> old.user_id then
    raise exception 'membership rows cannot be moved' using errcode = '42501';
  end if;
  select created_by into v_owner from public.trips where id = new.trip_id;
  if new.role is distinct from old.role and auth.uid() is distinct from v_owner then
    raise exception 'only the trip owner can change roles' using errcode = '42501';
  end if;
  if old.removed_at is not null and new.removed_at is null then
    -- back in only if the owner is doing it, or is the one who re-invited after the removal
    if auth.uid() is distinct from v_owner and not exists (
      select 1 from public.invites i join public.users u on u.phone = i.phone
       where i.trip_id = new.trip_id and u.id = new.user_id and i.invited_by = v_owner and i.created_at > old.removed_at
    ) then
      raise exception 'this person was removed by the trip owner; only the owner can add them back' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists members_guard_update on public.trip_members;
create trigger members_guard_update before update on public.trip_members for each row execute function public.guard_member_update();

-- ---------------------------------------------------------------------------
-- expenses: every write goes through save_expense / delete_expense
-- ---------------------------------------------------------------------------
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_update on public.expenses;

alter table public.expenses drop constraint if exists expenses_fx_positive;
alter table public.expenses add constraint expenses_fx_positive check (fx_rate > 0);
alter table public.expenses drop constraint if exists expenses_total_positive;
alter table public.expenses add constraint expenses_total_positive check (amount_cents + tip_cents > 0 and base_amount_cents > 0);

-- ---------------------------------------------------------------------------
-- invites: no inviting yourself
-- ---------------------------------------------------------------------------
create or replace function public.guard_invite_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int; v_mine text;
begin
  select count(*) into n from public.invites where invited_by = new.invited_by and created_at > now() - interval '24 hours';
  if n >= 50 then
    raise exception 'invite limit reached: 50 invites a day. Try again tomorrow.' using errcode = '54000';
  end if;
  new.phone := regexp_replace(new.phone, '\D', '', 'g');
  select phone into v_mine from public.users where id = new.invited_by;
  if v_mine is not null and v_mine = new.phone then
    raise exception 'that is your own number' using errcode = '23514';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- comments: authors can delete their own
-- ---------------------------------------------------------------------------
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- helpers are for policies and RPCs, not for anonymous callers
-- ---------------------------------------------------------------------------
revoke execute on function public.first_name(uuid) from anon;
revoke execute on function public.expense_trip(uuid) from anon;
revoke execute on function public.is_trip_member(uuid) from anon;
revoke execute on function public.is_trip_owner(uuid) from anon;
revoke execute on function public.shares_trip_with(uuid) from anon;
revoke execute on function public.gate_open(uuid) from anon;
revoke execute on function public.set_done(uuid, boolean) from anon;
