// No raw colours outside the generated tokens.css (DESIGN_SYSTEM.md §2.1 / build prompt 2.1).
// Fails on hex literals and rgb()/rgba()/hsl() in any .ts/.tsx/.css/.mjs file under apps/site
// except styles/tokens.css, public/, assets/ and this script. The zebra component is NOT
// exempt: it reads its palette from @bunktab/theme like everything else.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../..");
const skipDirs = new Set(["node_modules", ".next", "public", "assets", ".vercel"]);
const skipFiles = new Set([join("styles", "tokens.css"), join("scripts", "check-hex.mjs"), "next-env.d.ts"]);
const hex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const fn = /\b(?:rgba?|hsla?)\(/g;

const hits = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(root, p);
    if (statSync(p).isDirectory()) { if (!skipDirs.has(name)) walk(p); continue; }
    if (!/\.(tsx?|css|mjs)$/.test(name) || skipFiles.has(rel)) continue;
    const text = readFileSync(p, "utf8");
    text.split("\n").forEach((line, i) => {
      const m = line.match(hex) ?? [];
      const f = line.match(fn) ?? [];
      if (m.length || f.length) hits.push(`${rel.split(sep).join("/")}:${i + 1}: ${line.trim()}`);
    });
  }
})(root);

if (hits.length) {
  console.error(`check-hex: ${hits.length} raw colour literal(s) outside tokens.css:\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log("check-hex: no raw colour literals outside styles/tokens.css");
