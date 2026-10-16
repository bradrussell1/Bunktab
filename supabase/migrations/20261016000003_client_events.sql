-- Product analytics for the receipt flow (RECEIPT_SPLIT_PROMPT, Part 7). No PII:
-- rows carry an event name and a small bag of numbers/enums, never a user id, trip
-- id, name, phone or amount typed by a person. Insert-only through log_event; the
-- allow-list below is the whole vocabulary. The user correction rate (edited lines ÷
-- read lines) is a query over receipt_items.edited_by_user, not an event.
create table if not exists public.client_events (
  id bigserial primary key,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  platform text,
  app_version text,
  at timestamptz not null default now()
);
create index if not exists client_events_name_at on public.client_events (name, at desc);
alter table public.client_events enable row level security;
-- nobody reads these from the apps; the owner queries them in the dashboard

create or replace function public.log_event(p_name text, p_props jsonb default '{}'::jsonb, p_platform text default null, p_app_version text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_name not in (
    'receipt_scan_started', 'receipt_read_ready', 'receipt_read_failed', 'receipt_line_edited',
    'tip_selected', 'split_method_chosen', 'split_rest_used', 'receipt_expense_saved'
  ) then return; end if;
  if pg_column_size(p_props) > 2048 then p_props := '{}'::jsonb; end if;
  insert into public.client_events (name, props, platform, app_version) values (p_name, coalesce(p_props, '{}'::jsonb), left(p_platform, 20), left(p_app_version, 40));
end $$;
grant execute on function public.log_event(text, jsonb, text, text) to authenticated;

-- the quality metric for the AI step: edited lines ÷ read lines, by prompt version
create or replace view public.receipt_correction_rate as
  select r.prompt_version, r.model,
         count(i.id) as lines_read,
         count(i.id) filter (where i.edited_by_user) as lines_edited,
         round(count(i.id) filter (where i.edited_by_user)::numeric / nullif(count(i.id), 0), 4) as correction_rate,
         count(distinct r.id) as receipts,
         count(distinct r.id) filter (where r.reconciled) as receipts_reconciled
    from public.receipts r join public.receipt_items i on i.receipt_id = r.id
   where r.status in ('ready', 'needs_review')
   group by r.prompt_version, r.model;
revoke all on public.receipt_correction_rate from anon, authenticated;
