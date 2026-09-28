-- Comments thread updates live (spec: Comments); the thread screen otherwise
-- refreshes on focus and after send.
alter publication supabase_realtime add table public.comments;
