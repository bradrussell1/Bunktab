# Zebrasplit — working rules

Monorepo: `apps/mobile` (Expo), `apps/web` (guest view), `apps/site` (zebrasplit.com), `packages/core` (pure TypeScript, no I/O), `packages/theme` (tokens), `supabase/` (migrations, Edge Functions). Design sources of truth live in `design/`.

## Money and the receipt pipeline

- Money is integer cents everywhere. Parse decimals from strings (`decimalToCents`), never from floats.
- The AI never does arithmetic. The model returns data only; all splitting lives in `packages/core/src/receipt` and is written test-first (golden file `design/receipt/fixtures/el-faro.json`, fast-check properties).
- Leftover cents go to the account holder (the payer entering the expense), else to the first participant in member order. See `allocate`.
- Prompts and schemas are versioned files (`supabase/functions/receipt-parse/prompts/receipt-extraction.v1.md`, `design/receipt/receipt-extraction.schema.json`). Bump the version; never edit a shipped one.
- Secrets live only in Supabase secrets and CI secrets, never in the repo or the app bundle. The Anthropic key is used only by Edge Functions.
- Never log receipt images, item names alongside user IDs, or any card data. Worker logs carry ids, status, model, timing, tokens and cost only.

## Mechanics

- The Edge Functions run a generated copy of the core receipt engine. After editing `packages/core/src/receipt/*`, the schema or the prompt, run `node scripts/sync-functions.mjs`; `npm test` fails when the copy is stale.
- Settlement, the Venmo close-out and the Done gate are unchanged by receipt work. An itemized expense still produces ordinary `expense_payers` and `expense_shares` rows.
- Design system: tokens only (`packages/theme/src/tokens.ts`), no raw colours, sizes or radii in screens. Never put a `transform` string in a Reanimated animated prop on an SVG element.
- Migrations are additive and applied with `scripts/db-apply.mjs`; Edge Functions deploy with the Supabase CLI. Don't push or open a PR until asked.
