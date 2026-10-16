-- Itemized receipt splitting (RECEIPT_SPLIT_PROMPT, Part 1), step 1 of 2.
-- A new enum value can't be used in the transaction that adds it, so it gets
-- its own migration; the tables and RPC that reference it follow in
-- 20261016000002_receipts.sql. UI methods map: Split evenly → equal,
-- Exact split → exact, Split by item → itemized.
alter type public.split_type add value if not exists 'itemized';
