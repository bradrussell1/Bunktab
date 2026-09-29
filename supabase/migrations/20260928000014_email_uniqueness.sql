-- A deleted account kept its email on the anonymised users row, and the
-- next sign-up with that email tripped users_email_key inside the auth
-- trigger, which failed the whole sign-up with a 500. Two fixes:
--  1. delete_my_account clears email too.
--  2. handle_new_auth_user never lets an email collision break sign-up: a
--     taken email is left null on the new row (the user can set it later).

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text := lower(coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data->>'email', '')));
begin
  if v_email is not null and exists (select 1 from public.users u where lower(u.email) = v_email and u.id <> new.id) then
    v_email := null;  -- taken by another row; don't fail the sign-up
  end if;
  insert into public.users (id, phone, email, display_name, venmo_username)
  values (new.id, new.phone, v_email,
          nullif(new.raw_user_meta_data->>'display_name', ''),
          nullif(new.raw_user_meta_data->>'venmo_username', ''))
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.users.phone),
    email = coalesce(excluded.email, public.users.email),
    display_name = coalesce(public.users.display_name, excluded.display_name),
    venmo_username = coalesce(public.users.venmo_username, excluded.venmo_username);
  return new;
end $$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  old_phone text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select phone into old_phone from public.users where id = uid;

  delete from public.trips t
   where t.created_by = uid
     and not exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id <> uid and m.removed_at is null);

  update public.users
     set display_name = 'Former member', phone = null, email = null, photo_url = null, venmo_username = null, deleted_at = now()
   where id = uid;
  update public.trip_members set done_at = coalesce(done_at, now()), removed_at = coalesce(removed_at, now())
   where user_id = uid
     and not exists (select 1 from public.expense_payers p join public.expenses e on e.id = p.expense_id where p.user_id = uid and e.trip_id = trip_members.trip_id)
     and not exists (select 1 from public.expense_shares s join public.expenses e on e.id = s.expense_id where s.user_id = uid and e.trip_id = trip_members.trip_id);
  delete from public.devices where user_id = uid;
  if old_phone is not null then delete from public.invites where phone = old_phone and status = 'pending'; end if;

  delete from auth.users where id = uid;
end $$;

-- tidy the rows left behind by earlier test deletions
update public.users set email = null where deleted_at is not null and email is not null;
