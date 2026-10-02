-- Paid payments stay in the table when the plan is regenerated (user decision
-- 2026-10-01), so the same payer→recipient pair can legitimately appear
-- twice: one marked/confirmed row and one new pending row. Uniqueness now
-- applies to pending rows only.
alter table public.settlements drop constraint if exists settlements_trip_id_from_user_to_user_key;
drop index if exists public.settlements_pending_pair_idx;
create unique index settlements_pending_pair_idx on public.settlements (trip_id, from_user, to_user) where status = 'pending';
