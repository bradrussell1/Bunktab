-- Avatars and trip covers are displayed on every list and header; signed URLs
-- per render would be a request per image. Paths are UUID-scoped and
-- unguessable, so these two buckets are public-read. Receipts stay private.
update storage.buckets set public = true where id in ('avatars', 'covers');
