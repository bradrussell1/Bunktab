-- Receipt retention (RECEIPT_SPLIT_PROMPT Part 1): archiving a trip keeps its receipts;
-- soft-deleting an expense keeps them; a hard-deleted expense removes the receipt only
-- when no other expense links the same photo; deleting the trip removes everything.
-- Run as the postgres role; the transaction is rolled back, nothing is left behind:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/receipt_retention.sql
begin;
do $$
declare v_user uuid; v_trip uuid; v_exp uuid; v_exp2 uuid; v_rcpt uuid; n int;
begin
  select id into v_user from public.users where deleted_at is null limit 1;
  insert into public.trips (title, start_date, end_date, base_currency, created_by) values ('retention test', current_date, current_date + 2, 'USD', v_user) returning id into v_trip;
  insert into public.trip_members (trip_id, user_id, role) values (v_trip, v_user, 'owner') on conflict do nothing;
  insert into public.receipts (trip_id, storage_path, image_sha256, status, created_by) values (v_trip, v_trip || '/t.jpg', 'sha-test', 'ready', v_user) returning id into v_rcpt;
  insert into public.expenses (trip_id, description, category, subcategory, amount_cents, currency, base_amount_cents, split_type, receipt_id, created_by)
    values (v_trip, 'dinner', 'dining', 'restaurants', 1000, 'USD', 1000, 'itemized', v_rcpt, v_user) returning id into v_exp;

  -- 1. archive keeps the receipt
  update public.trips set status = 'archived' where id = v_trip;
  select count(*) into n from public.receipts where id = v_rcpt; assert n = 1, 'archiving dropped the receipt';
  update public.trips set status = 'open' where id = v_trip;

  -- 2. soft delete keeps it
  update public.expenses set deleted_at = now() where id = v_exp;
  select count(*) into n from public.receipts where id = v_rcpt; assert n = 1, 'soft delete dropped the receipt';

  -- 3. a second expense on the same photo: hard-deleting the first keeps the receipt
  insert into public.expenses (trip_id, description, category, subcategory, amount_cents, currency, base_amount_cents, split_type, receipt_id, created_by)
    values (v_trip, 'dinner again', 'dining', 'restaurants', 1000, 'USD', 1000, 'equal', v_rcpt, v_user) returning id into v_exp2;
  delete from public.expenses where id = v_exp;
  select count(*) into n from public.receipts where id = v_rcpt; assert n = 1, 'hard delete with a sibling link dropped the receipt';

  -- 4. hard-deleting the last linked expense removes it
  delete from public.expenses where id = v_exp2;
  select count(*) into n from public.receipts where id = v_rcpt; assert n = 0, 'orphan receipt survived';

  -- 5. trip delete cascades
  insert into public.receipts (trip_id, storage_path, image_sha256, status, created_by) values (v_trip, v_trip || '/u.jpg', 'sha-test-2', 'ready', v_user) returning id into v_rcpt;
  delete from public.trips where id = v_trip;
  select count(*) into n from public.receipts where id = v_rcpt; assert n = 0, 'trip delete left a receipt';
  raise notice 'receipt retention: all 5 checks passed';
end $$;
rollback;
