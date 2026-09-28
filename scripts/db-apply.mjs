// Apply one migration file to the linked project through the Supabase
// Management API and record it in supabase_migrations.schema_migrations, for
// when `supabase db push` isn't usable (no database password on this machine).
// Usage: SUPABASE_ACCESS_TOKEN=sbp_… node scripts/db-apply.mjs supabase/migrations/<file>.sql
import fs from "node:fs";
const ref = fs.readFileSync("supabase/.temp/project-ref", "utf8").trim();
const token = process.env.SUPABASE_ACCESS_TOKEN; if (!token) throw new Error("SUPABASE_ACCESS_TOKEN not set");
const file = process.argv[2]; if (!file) throw new Error("pass a migration file");
const version = file.match(/(\d{14})_/)?.[1]; const name = file.replace(/^.*\d{14}_/, "").replace(/\.sql$/, "");
async function q(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${t}`); return t;
}
const [{ n }] = JSON.parse(await q(`select count(*)::int as n from supabase_migrations.schema_migrations where version = '${version}'`));
if (n > 0) { console.log(`already applied: ${version}`); process.exit(0); }
await q(fs.readFileSync(file, "utf8"));
await q(`insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${name}', array[]::text[])`);
console.log(`applied ${version}_${name}`);
