-- In-app account deletion (spec: Data protection and compliance; App Store
-- requirement). The public.users row stays, anonymised, so other members'
-- balances still add up; the auth identity is deleted so the number can't
-- log back into this account (signing up again creates a fresh account).
-- The FK to auth.users is dropped for that reason: cascading would take the
-- ledger rows with it.
alter table public.users drop constraint if exists users_id_fkey;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  old_phone text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select phone into old_phone from public.users where id = uid;

  -- trips only this person is in go away entirely
  delete from public.trips t
   where t.created_by = uid
     and not exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id <> uid and m.removed_at is null);

  -- personal data off the row; membership and ledger rows stay
  update public.users
     set display_name = 'Former member', phone = null, photo_url = null, venmo_username = null, deleted_at = now()
   where id = uid;
  -- leave trips where nothing was logged; stay (anonymised) where money is involved
  update public.trip_members set done_at = coalesce(done_at, now()), removed_at = coalesce(removed_at, now())
   where user_id = uid
     and not exists (select 1 from public.expense_payers p join public.expenses e on e.id = p.expense_id where p.user_id = uid and e.trip_id = trip_members.trip_id)
     and not exists (select 1 from public.expense_shares s join public.expenses e on e.id = s.expense_id where s.user_id = uid and e.trip_id = trip_members.trip_id);
  delete from public.devices where user_id = uid;
  if old_phone is not null then delete from public.invites where phone = old_phone and status = 'pending'; end if;
  -- the avatar object is removed by the app through the Storage API first;
  -- storage rows can't be deleted from SQL on Supabase

  -- the login identity itself
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
