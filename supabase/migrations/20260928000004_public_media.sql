-- Avatars are displayed on every list and header; signed URLs per render
-- per render would be a request per image. Paths are UUID-scoped and
-- unguessable, so the bucket is public-read. Covers and receipts stay private (spec: Files).
update storage.buckets set public = true where id = 'avatars';
