/**
 * The Edge Functions run a byte-for-byte copy of the receipt engine, schema and prompt.
 * If this fails: node scripts/sync-functions.mjs
 */
import { expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { stale } from "../../../scripts/sync-functions.mjs";

it("supabase/functions carries the current receipt engine, schema and prompt", () => {
  expect(stale()).toEqual([]);
});
