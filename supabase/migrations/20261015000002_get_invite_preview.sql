-- get_invite_preview(code): what zebrasplit.com/join/<code> shows before anyone signs in.
-- `code` is invites.token. SECURITY DEFINER so anon can read across invites, trips,
-- trip_members, users and expenses under RLS, returning only: state, trip name and dates,
-- the inviter's first name, member / done / expense counts, and each active member's first
-- name and done flag. Never phone numbers, amounts, Venmo usernames, receipts or ids.
create or replace function public.get_invite_preview(code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invites%rowtype;
  v_trip public.trips%rowtype;
  v_state text;
  v_members jsonb;
  v_member_count int;
  v_done_count int;
  v_expense_count int;
  v_inviter text;
begin
  if code is null or length(code) > 128 then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into v_inv from public.invites i where i.token = code;
  if not found then return jsonb_build_object('state', 'invalid'); end if;

  select * into v_trip from public.trips t where t.id = v_inv.trip_id;
  if not found then return jsonb_build_object('state', 'invalid'); end if;

  if v_trip.status = 'settled' or v_trip.settled_at is not null then
    v_state := 'settled';
  elsif v_inv.status in ('expired', 'revoked') or v_inv.expires_at < now() then
    v_state := 'expired';
  else
    v_state := 'valid';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'done', m.done) order by m.joined_at), '[]'::jsonb),
         count(*)::int,
         count(*) filter (where m.done)::int
    into v_members, v_member_count, v_done_count
    from (
      select coalesce(nullif(trim(u.first_name), ''), nullif(split_part(trim(coalesce(u.display_name, '')), ' ', 1), ''), 'Friend') as name,
             tm.done_at is not null as done,
             tm.joined_at
        from public.trip_members tm
        left join public.users u on u.id = tm.user_id
       where tm.trip_id = v_trip.id and tm.removed_at is null
    ) m;

  select count(*)::int into v_expense_count
    from public.expenses e
   where e.trip_id = v_trip.id and e.deleted_at is null;

  select coalesce(nullif(trim(u.first_name), ''), nullif(split_part(trim(coalesce(u.display_name, '')), ' ', 1), ''), 'A friend')
    into v_inviter
    from public.users u where u.id = v_inv.invited_by;

  return jsonb_build_object(
    'state', v_state,
    'trip', jsonb_build_object('name', v_trip.title, 'start_date', v_trip.start_date, 'end_date', v_trip.end_date),
    'inviter', coalesce(v_inviter, 'A friend'),
    'members', v_members,
    'member_count', v_member_count,
    'done_count', v_done_count,
    'expense_count', v_expense_count
  );
end;
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
comment on function public.get_invite_preview(text) is 'Public invite preview for zebrasplit.com/join/<token>: state, trip name/dates, inviter first name, counts, member first names + done. No phones, amounts, Venmo handles, receipts or ids.';
