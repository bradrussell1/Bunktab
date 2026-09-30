-- Forgot password takes "email or phone" but the reset code always goes by
-- text, so an email has to be resolved to the phone on that account. This
-- runs signed out (anon) and therefore reveals whether an identifier has an
-- account with a confirmed phone - the same thing a phone-based reset on
-- any service reveals. It never returns anything for an unknown identifier.
create or replace function public.request_password_reset(p_identifier text)
returns text language plpgsql security definer set search_path = public as $$
declare v_phone text; v_digits text;
begin
  if p_identifier is null or length(trim(p_identifier)) = 0 then return null; end if;
  if position('@' in p_identifier) > 0 then
    select phone into v_phone from auth.users
     where lower(email) = lower(trim(p_identifier)) and phone is not null and phone_confirmed_at is not null
     limit 1;
  else
    v_digits := regexp_replace(p_identifier, '\D', '', 'g');
    if length(v_digits) = 10 then v_digits := '1' || v_digits; end if;
    select phone into v_phone from auth.users
     where phone = v_digits and phone_confirmed_at is not null
     limit 1;
  end if;
  if v_phone is null then return null; end if;
  return '+' || v_phone;
end $$;
revoke all on function public.request_password_reset(text) from public;
grant execute on function public.request_password_reset(text) to anon, authenticated;
