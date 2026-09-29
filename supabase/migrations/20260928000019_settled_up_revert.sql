-- set_settled_up: remember exactly what switching it on changed (settlement
-- ids with their prior status, and whether it settled the trip) so that
-- switching it off restores that state instead of guessing.
alter table public.trip_members add column if not exists settled_up_undo jsonb;

create or replace function public.set_settled_up(p_trip uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text; v_cur text; s record; v_undo jsonb; v_changed jsonb := '[]'::jsonb; v_settled boolean := false;
begin
  if not public.is_trip_member(p_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  select title, base_currency into v_title, v_cur from public.trips where id = p_trip;

  if p_on then
    for s in select * from public.settlements where trip_id = p_trip and from_user = auth.uid() and status = 'pending' loop
      update public.settlements set status = 'marked_paid', marked_at = now() where id = s.id;
      v_changed := v_changed || jsonb_build_object('id', s.id, 'was', s.status);
      perform public.notify(s.to_user, 'payment.marked', v_title, public.first_name(s.from_user) || ' marked ' || public.fmt_cents(s.amount_cents, v_cur) || ' as paid to you.', jsonb_build_object('settlement_id', s.id), p_trip);
    end loop;
    for s in select * from public.settlements where trip_id = p_trip and to_user = auth.uid() and status <> 'confirmed' loop
      update public.settlements set status = 'confirmed', confirmed_at = now(), marked_at = coalesce(marked_at, now()) where id = s.id;
      v_changed := v_changed || jsonb_build_object('id', s.id, 'was', s.status);
    end loop;
    update public.trips t set status = 'settled', settled_at = now()
     where t.id = p_trip and t.status = 'open'
       and not exists (select 1 from public.settlements x where x.trip_id = t.id and x.status = 'pending');
    v_settled := found;
    update public.trip_members set settled_up_at = now(), settled_up_undo = jsonb_build_object('changed', v_changed, 'settled', v_settled), last_active_at = now()
     where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
  else
    select settled_up_undo into v_undo from public.trip_members where trip_id = p_trip and user_id = auth.uid();
    for s in select (c->>'id')::uuid as id, (c->>'was')::public.settlement_status as was from jsonb_array_elements(coalesce(v_undo->'changed', '[]'::jsonb)) c loop
      update public.settlements set status = s.was,
        marked_at = case when s.was = 'pending' then null else marked_at end,
        confirmed_at = case when s.was = 'confirmed' then confirmed_at else null end
       where id = s.id;
    end loop;
    if coalesce((v_undo->>'settled')::boolean, false) then
      update public.trips set status = 'open', settled_at = null where id = p_trip and status = 'settled';
    end if;
    update public.trip_members set settled_up_at = null, settled_up_undo = null, last_active_at = now()
     where trip_id = p_trip and user_id = auth.uid() and removed_at is null;
  end if;
end $$;
grant execute on function public.set_settled_up(uuid, boolean) to authenticated;
