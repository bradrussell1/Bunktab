-- Receipt pipeline guardrails (RECEIPT_PIPELINE_PROMPT, Steps 3, 4, 5 and 9):
--
--  * settings: receipt_ai_enabled (kill switch) and receipt_daily_limit live in
--    private.config; public.receipt_settings() hands them to the app and the worker
--  * storage: the receipts bucket caps files at 10 MB and image/jpeg|webp|png
--  * worker bookkeeping: started_at, cost_estimate_usd
--  * stuck-job sweep: every minute, receipts still queued/processing after two
--    minutes are re-invoked (at most 3 attempts), then failed with error 'stalled'
--  * kill switch on insert: with the AI off, a new receipt row is saved as failed
--    ('disabled') and the worker is never called; the photo stays attached

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
insert into private.config (key, value) values ('receipt_ai_enabled', 'true') on conflict (key) do nothing;
insert into private.config (key, value) values ('receipt_daily_limit', '30') on conflict (key) do nothing;

create or replace function public.receipt_settings()
returns jsonb language sql stable security definer set search_path = private as $$
  select jsonb_build_object(
    'ai_enabled', coalesce(private.config_get('receipt_ai_enabled'), 'true') = 'true',
    'daily_limit', coalesce(nullif(private.config_get('receipt_daily_limit'), '')::int, 30)
  );
$$;
revoke all on function public.receipt_settings() from public;
grant execute on function public.receipt_settings() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- storage limits (private bucket; objects under <trip_id>/)
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png']
 where id = 'receipts';

-- ---------------------------------------------------------------------------
-- worker bookkeeping
-- ---------------------------------------------------------------------------
alter table public.receipts add column if not exists started_at timestamptz;
alter table public.receipts add column if not exists cost_estimate_usd numeric(10, 6);

-- ---------------------------------------------------------------------------
-- kill switch: a queued row becomes failed/'disabled' before the parse trigger sees it
-- ---------------------------------------------------------------------------
create or replace function public.receipt_ai_gate()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'queued' and coalesce(private.config_get('receipt_ai_enabled'), 'true') <> 'true' then
    new.status := 'failed';
    new.error := 'disabled';
  end if;
  return new;
end $$;
drop trigger if exists receipts_ai_gate on public.receipts;
create trigger receipts_ai_gate before insert on public.receipts for each row execute function public.receipt_ai_gate();

-- ---------------------------------------------------------------------------
-- stuck-job sweep (pg_cron, every minute). Covers a lost pg_net call or a worker
-- that died mid-read. attempts is bumped by the worker on every start, so a row
-- that keeps stalling runs out after three tries.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_stalled_receipts()
returns integer language plpgsql security definer set search_path = public, private as $$
declare r record; n integer := 0;
begin
  for r in
    select id, attempts from public.receipts
     where status in ('queued', 'processing')
       and coalesce(started_at, created_at) < now() - interval '2 minutes'
     order by created_at
     limit 50
  loop
    if r.attempts >= 3 then
      update public.receipts set status = 'failed', error = 'stalled' where id = r.id;
    else
      update public.receipts set status = 'queued', error = null where id = r.id;
      perform private.call_function('receipt-parse', jsonb_build_object('receipt_id', r.id));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sweep_stalled_receipts() from public;

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname = 'zebrasplit_receipt_sweep' loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule('zebrasplit_receipt_sweep', '* * * * *', $c$ select public.sweep_stalled_receipts(); $c$);
end $$;
