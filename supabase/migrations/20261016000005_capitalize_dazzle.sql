-- Product wording: "Dazzle" is capitalized everywhere the user sees it (2026-10-16).
-- Only the strings change; the function is otherwise identical to 20261015000001.

create or replace function public.force_close_out(p_trip uuid)
returns integer language plpgsql security definer set search_path = public, private as $$
declare v_title text; m record; n int := 0;
begin
  if not public.is_trip_owner(p_trip) then raise exception 'only the Dazzle creator can close out for everyone' using errcode = '42501'; end if;
  if (select status from public.trips where id = p_trip) <> 'open' then raise exception 'this Dazzle is already closed' using errcode = '23514'; end if;
  perform private.mark_internal();
  select title into v_title from public.trips where id = p_trip;
  for m in select user_id from public.trip_members where trip_id = p_trip and removed_at is null and done_at is null loop
    update public.trip_members set done_at = now(), last_active_at = now() where trip_id = p_trip and user_id = m.user_id;
    insert into public.expense_history (trip_id, actor_id, action, after_json)
    values (p_trip, auth.uid(), 'done.force', jsonb_build_object('user_id', m.user_id));
    if m.user_id <> auth.uid() then
      perform public.notify(m.user_id, 'closeout.forced', v_title,
        public.first_name(auth.uid()) || ' closed out the Dazzle, so your stripe is in. Expenses already logged still count.', '{}'::jsonb, p_trip);
    end if;
    n := n + 1;
  end loop;
  -- the override is logged (trips_override_log) even though every stripe is now in
  update public.trips set closeout_override_by = auth.uid(), closeout_override_at = now() where id = p_trip and closeout_override_at is null;
  return n;
end $$;
revoke execute on function public.force_close_out(uuid) from public, anon;
grant execute on function public.force_close_out(uuid) to authenticated;
