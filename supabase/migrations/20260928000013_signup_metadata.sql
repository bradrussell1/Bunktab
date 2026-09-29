-- Sign-up sends display_name / email / venmo_username as user metadata.
-- Copy them into public.users when the auth row is created, and keep
-- users.email in step when the auth email changes (updateUser({ email })),
-- so the row is complete even if the client's follow-up write fails.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, phone, email, display_name, venmo_username)
  values (new.id, new.phone,
          coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data->>'email', '')),
          nullif(new.raw_user_meta_data->>'display_name', ''),
          nullif(new.raw_user_meta_data->>'venmo_username', ''))
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.users.phone),
    email = coalesce(excluded.email, public.users.email),
    display_name = coalesce(public.users.display_name, excluded.display_name),
    venmo_username = coalesce(public.users.venmo_username, excluded.venmo_username);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of phone, email on auth.users
  for each row execute function public.handle_new_auth_user();
