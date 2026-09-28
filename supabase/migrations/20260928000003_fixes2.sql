-- Checkm8 V1 · second pass from the end-to-end run
-- 1. A CHECK constraint passes on NULL, so a category that needs a
--    subcategory slipped through with none; coalesce the verdict to false.
-- 2. The API connection runs with safeupdate on: DELETE needs a WHERE.

alter table public.expenses drop constraint if exists expenses_category_valid;
alter table public.expenses add constraint expenses_category_valid check (coalesce(public.valid_category(category, subcategory), false));

create or replace function public.generate_settlements(p_trip uuid)
returns setof public.settlements language plpgsql security definer set search_path = public as $$
declare
  v_cr uuid; v_db uuid; v_cr_net bigint; v_db_net bigint; v_pay integer;
begin
  if not public.is_trip_member(p_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  if not public.gate_open(p_trip) then raise exception 'close out is still locked' using errcode = '23514'; end if;
  if exists (select 1 from public.settlements where trip_id = p_trip and status <> 'pending') then
    return query select * from public.settlements where trip_id = p_trip order by created_at;
    return;
  end if;
  delete from public.settlements where trip_id = p_trip;

  create temp table if not exists _nets (user_id uuid primary key, net bigint) on commit drop;
  delete from _nets where true;
  insert into _nets
    select m.user_id,
           coalesce((select sum(pp.base_amount_cents) from public.expense_payers pp join public.expenses e on e.id = pp.expense_id where e.trip_id = p_trip and e.deleted_at is null and pp.user_id = m.user_id), 0)
         - coalesce((select sum(ss.base_share_cents) from public.expense_shares ss join public.expenses e on e.id = ss.expense_id where e.trip_id = p_trip and e.deleted_at is null and ss.user_id = m.user_id), 0)
    from public.trip_members m where m.trip_id = p_trip;

  loop
    select user_id, net into v_cr, v_cr_net from _nets where net > 0 order by net desc, user_id limit 1;
    select user_id, net into v_db, v_db_net from _nets where net < 0 order by net asc, user_id limit 1;
    exit when v_cr is null or v_db is null;
    v_pay := least(v_cr_net, -v_db_net)::integer;
    insert into public.settlements (trip_id, from_user, to_user, amount_cents) values (p_trip, v_db, v_cr, v_pay);
    update _nets set net = net - v_pay where user_id = v_cr;
    update _nets set net = net + v_pay where user_id = v_db;
    v_cr := null; v_db := null;
  end loop;
  return query select * from public.settlements where trip_id = p_trip order by created_at;
end $$;
