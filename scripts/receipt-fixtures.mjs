// Renders the anonymised test receipts in design/receipt/fixtures/receipts/ (RECEIPT_SPLIT_PROMPT,
// Verification 2): each case is an HTML receipt drawn with headless Chrome, with photo-like
// treatment (skew, fade, noise, a handwritten tip, a two-photo pair, one non-receipt), plus an
// `.expected.json` with the ground truth the eval compares against. No real receipts, no PII.
//
//   NODE_PATH=<dir with playwright-core> node scripts/receipt-fixtures.mjs
//
// playwright-core isn't a repo dependency; point NODE_PATH at any install (the design
// screenshots use the same local Chrome).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "design/receipt/fixtures/receipts");
fs.mkdirSync(out, { recursive: true });
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const money = (c) => (c / 100).toFixed(2);

/** A receipt case: lines, charges, options; expected is derived so it can't drift from the picture. */
function mk(name, o) {
  const items = o.items.map((it, i) => ({ position: i, name: it.name, quantity: it.qty ?? 1, unit_cents: it.unit ?? null, line_total_cents: it.cents, kind: it.kind ?? "food", is_void: !!it.void }));
  const live = items.filter((it) => !it.is_void || it.line_total_cents < 0);
  const itemDiscount = (o.discounts ?? []).filter((d) => d.item_index != null).reduce((s, d) => s + d.cents, 0);
  const subtotal = o.subtotal ?? live.reduce((s, it) => s + it.line_total_cents, 0) + itemDiscount;
  const tax = (o.taxes ?? []).reduce((s, t) => s + t.cents, 0);
  const fees = (o.fees ?? []).reduce((s, f) => s + f.cents, 0);
  const other = (o.discounts ?? []).filter((d) => d.item_index == null).reduce((s, d) => s + d.cents, 0);
  const total = o.taxIncluded ? subtotal + fees + other : subtotal + tax + fees + other;
  return { name, merchant: o.merchant, date: o.date, currency: o.currency ?? "USD", items, taxes: o.taxes ?? [], fees: o.fees ?? [], discounts: o.discounts ?? [], subtotal, tax, total, tipPrinted: o.tipPrinted ?? null, taxIncluded: !!o.taxIncluded, style: o.style ?? {}, readable: o.readable ?? true, pages: o.pages ?? 1, footer: o.footer ?? [] };
}

const CASES = [
  mk("restaurant-bill", { merchant: "Casa Lupe Taqueria", date: "2026-10-09", items: [
    { name: "Queso fundido", cents: 1250 }, { name: "Carnitas plate", cents: 1900 }, { name: "Pollo verde", cents: 1750 }, { name: "Veggie bowl", cents: 1500 },
    { name: "Horchata", cents: 450, kind: "drink" }, { name: "Mexican coke", cents: 400, kind: "drink" }, { name: "Flan", cents: 800 } ],
    taxes: [{ label: "SALES TAX 8.75%", cents: 880, applies_to: "all" }], footer: ["THANK YOU", "GRATUITY NOT INCLUDED"] }),
  mk("bar-tab", { merchant: "The Hollow Pine", date: "2026-10-10", items: [
    { name: "IPA draft", qty: 2, unit: 800, cents: 1600, kind: "alcohol" }, { name: "House margarita", qty: 3, unit: 1200, cents: 3600, kind: "alcohol" },
    { name: "Old fashioned", qty: 2, unit: 1400, cents: 2800, kind: "alcohol" }, { name: "Pretzel bites", cents: 1100 }, { name: "Wings", qty: 2, unit: 1300, cents: 2600 }, { name: "Club soda", cents: 300, kind: "drink" } ],
    taxes: [{ label: "SALES TAX", cents: 724, applies_to: "all" }, { label: "LIQUOR TAX", cents: 480, applies_to: "alcohol" }], style: { font: "'Courier New', monospace", width: 300 } }),
  mk("grocery-long", { merchant: "Pinecrest Market", date: "2026-10-08", items: Array.from({ length: 34 }, (_, i) => {
    const names = ["Bananas", "Avocado", "Tortilla chips", "Salsa verde", "Limes 6ct", "Ground beef", "Chicken thighs", "Eggs dozen", "Oat milk", "Coffee beans", "Paper towels", "Sunscreen", "Ice 10lb", "Seltzer 12pk", "Burger buns", "Cheddar block", "Lettuce", "Tomatoes", "Onions", "Cilantro", "Jalapenos", "Rice 2lb", "Black beans", "Olive oil", "Charcoal", "Lighter fluid", "Marshmallows", "Graham crackers", "Chocolate bars", "Trash bags", "Dish soap", "Sponges", "Bottled water", "Orange juice"];
    const cents = [129, 249, 399, 449, 199, 1298, 987, 549, 499, 1299, 899, 1199, 399, 699, 349, 599, 249, 379, 189, 99, 129, 449, 139, 999, 1499, 599, 349, 429, 599, 1099, 399, 299, 599, 549];
    return { name: names[i], cents: cents[i], kind: /milk|juice|seltzer|water|coffee/i.test(names[i]) ? "drink" : /towel|sunscreen|charcoal|lighter|trash|soap|sponge/i.test(names[i]) ? "other" : "food" };
  }), taxes: [{ label: "TAX", cents: 612, applies_to: "unknown" }], style: { font: "'Courier New', monospace", width: 280, size: 11 }, footer: ["ITEMS 34", "THANK YOU FOR SHOPPING"] }),
  mk("comp-and-void", { merchant: "Driftwood Grill", date: "2026-10-11", items: [
    { name: "Fish & chips", cents: 1800 }, { name: "Clam chowder", cents: 900 }, { name: "Lobster roll", cents: 2600 }, { name: "Lobster roll", cents: -2600, void: true }, { name: "Caesar salad", cents: 1300 },
    { name: "Key lime pie", cents: 0, void: true }, { name: "Lemonade", qty: 2, unit: 400, cents: 800, kind: "drink" } ],
    taxes: [{ label: "STATE TAX 6%", cents: 408, applies_to: "all" }], footer: ["*** VOID LOBSTER ROLL ***", "KEY LIME PIE COMP - MGR"] }),
  mk("auto-gratuity", { merchant: "Vela Rooftop", date: "2026-10-10", items: [
    { name: "Burrata", cents: 1600 }, { name: "Cacio e pepe", qty: 2, unit: 2200, cents: 4400 }, { name: "Branzino", cents: 3400 }, { name: "Short rib", cents: 3800 }, { name: "Tiramisu", qty: 2, unit: 1100, cents: 2200 },
    { name: "Negroni", qty: 4, unit: 1500, cents: 6000, kind: "alcohol" }, { name: "Sparkling water", qty: 2, unit: 600, cents: 1200, kind: "drink" } ],
    taxes: [{ label: "TAX 9.5%", cents: 2147, applies_to: "all" }], fees: [{ label: "SERVICE CHARGE 20% (PARTY OF 7)", cents: 4520, kind: "auto_gratuity" }], footer: ["SERVICE CHARGE IS A GRATUITY", "NO ADDITIONAL TIP NECESSARY"] }),
  mk("vat-inclusive", { merchant: "Bar Tomate", date: "2026-10-07", currency: "EUR", items: [
    { name: "Pan con tomate", qty: 2, unit: 350, cents: 700 }, { name: "Jamon iberico", cents: 1800 }, { name: "Gambas al ajillo", cents: 1400 }, { name: "Tortilla", cents: 900 },
    { name: "Vermut", qty: 3, unit: 450, cents: 1350, kind: "alcohol" }, { name: "Agua con gas", cents: 300, kind: "drink" } ],
    taxes: [{ label: "IVA 10% (INCLUIDO)", cents: 586, applies_to: "all" }], taxIncluded: true, style: { font: "'Courier New', monospace", width: 290 }, footer: ["IVA INCLUIDO EN LOS PRECIOS", "GRACIAS POR SU VISITA"] }),
  mk("handwritten-tip", { merchant: "Juniper & Ash", date: "2026-10-09", items: [
    { name: "Roast chicken", cents: 2800 }, { name: "Mushroom risotto", cents: 2400 }, { name: "Little gem salad", cents: 1400 }, { name: "Pinot noir", qty: 2, unit: 1600, cents: 3200, kind: "alcohol" } ],
    taxes: [{ label: "TAX", cents: 833, applies_to: "all" }], tipPrinted: 2000, style: { handwrittenTip: "20.00", handwrittenTotal: "118.33" } }),
  mk("faded-thermal", { merchant: "Sunrise Diner", date: "2026-10-06", items: [
    { name: "Two egg breakfast", qty: 2, unit: 1100, cents: 2200 }, { name: "Pancake stack", cents: 1200 }, { name: "Side bacon", qty: 2, unit: 500, cents: 1000 }, { name: "Coffee", qty: 3, unit: 300, cents: 900, kind: "drink" }, { name: "OJ large", cents: 450, kind: "drink" } ],
    taxes: [{ label: "TAX", cents: 460, applies_to: "all" }], style: { fade: true, font: "'Courier New', monospace", width: 300 } }),
  mk("two-photo", { merchant: "Golden Wok", date: "2026-10-10", items: [
    { name: "Hot & sour soup", qty: 2, unit: 600, cents: 1200 }, { name: "Scallion pancake", cents: 800 }, { name: "Kung pao chicken", cents: 1650 }, { name: "Mapo tofu", cents: 1450 }, { name: "Beef chow fun", cents: 1750 },
    { name: "Garlic eggplant", cents: 1350 }, { name: "Steamed rice", qty: 4, unit: 200, cents: 800 }, { name: "Tsingtao", qty: 3, unit: 600, cents: 1800, kind: "alcohol" }, { name: "Jasmine tea", cents: 300, kind: "drink" } ],
    taxes: [{ label: "TAX 8.5%", cents: 947, applies_to: "all" }], pages: 2 }),
  mk("coupon-discount", { merchant: "Slice House", date: "2026-10-05", items: [
    { name: "Large pepperoni", cents: 2400 }, { name: "Large veggie", cents: 2300 }, { name: "Garlic knots", cents: 700 }, { name: "Caesar salad", cents: 1100 }, { name: "2L soda", cents: 450, kind: "drink" } ],
    discounts: [{ label: "COUPON LG PIZZA -5.00", cents: -500, item_index: 0 }, { label: "LOYALTY REWARD", cents: -300, item_index: null }],
    taxes: [{ label: "TAX", cents: 532, applies_to: "all" }], fees: [{ label: "DELIVERY FEE", cents: 399, kind: "other_fee" }] }),
  mk("skewed-cafe", { merchant: "Lantern Coffee", date: "2026-10-11", items: [
    { name: "Oat latte", qty: 2, unit: 575, cents: 1150, kind: "drink" }, { name: "Cold brew", cents: 500, kind: "drink" }, { name: "Almond croissant", qty: 2, unit: 475, cents: 950 }, { name: "Avocado toast", cents: 1200 } ],
    taxes: [{ label: "TAX 8.25%", cents: 314, applies_to: "all" }], style: { skew: true, width: 260 } }),
  mk("not-a-receipt", { merchant: "", date: "2026-10-11", items: [], readable: false, style: { menu: true } }),
];

function receiptHtml(c) {
  const s = c.style; const font = s.font ?? "'Courier New', monospace"; const width = s.width ?? 320; const size = s.size ?? 13;
  if (s.menu) {
    return `<body style="margin:0;background:#2b2b2b;display:flex;align-items:center;justify-content:center;height:900px;width:700px;font-family:Georgia,serif"><div style="background:#f6efe0;padding:40px 48px;width:420px;color:#222"><h1 style="margin:0 0 6px;font-size:34px;letter-spacing:2px">LANTERN</h1><div style="font-size:12px;letter-spacing:3px;margin-bottom:24px">BRUNCH · WEEKENDS 9–2</div>${["Shakshuka  14", "Ricotta pancakes  13", "Breakfast burrito  12", "Avocado toast  12", "Granola bowl  10"].map((l) => `<div style="display:flex;justify-content:space-between;font-size:17px;padding:8px 0;border-bottom:1px dotted #aaa"><span>${l.split("  ")[0]}</span><span>${l.split("  ")[1]}</span></div>`).join("")}<div style="margin-top:22px;font-size:12px;font-style:italic">Ask about our seasonal specials.</div></div></body>`;
  }
  const row = (l, r, extra = "") => `<div style="display:flex;justify-content:space-between;gap:12px;${extra}"><span>${l}</span><span>${r}</span></div>`;
  const lines = [];
  lines.push(`<div style="text-align:center;font-weight:bold;font-size:${size + 3}px">${c.merchant.toUpperCase()}</div>`);
  lines.push(`<div style="text-align:center">${c.date.replace(/-/g, "/")}  TBL 12  SVR 4</div><div style="text-align:center">- - - - - - - - - - - - - -</div>`);
  for (const it of c.items) {
    const name = it.name.toUpperCase();
    if (it.is_void && it.line_total_cents < 0) lines.push(row(`VOID ${name}`, `-${money(-it.line_total_cents)}`));
    else if (it.is_void) lines.push(row(`${name}  **COMP**`, money(0)));
    else if (it.quantity > 1) { lines.push(row(name, money(it.line_total_cents))); lines.push(`<div style="opacity:.75;padding-left:14px">${it.quantity} @ ${money(it.unit_cents ?? Math.round(it.line_total_cents / it.quantity))}</div>`); }
    else lines.push(row(name, money(it.line_total_cents)));
  }
  for (const d of c.discounts) if (d.item_index != null) lines.push(row(`  ${d.label}`, `-${money(-d.cents)}`));
  lines.push(`<div style="text-align:center">- - - - - - - - - - - - - -</div>`);
  lines.push(row("SUBTOTAL", money(c.subtotal)));
  for (const d of c.discounts) if (d.item_index == null) lines.push(row(d.label, `-${money(-d.cents)}`));
  for (const t of c.taxes) lines.push(row(t.label, money(t.cents)));
  for (const f of c.fees) lines.push(row(f.label, money(f.cents)));
  lines.push(row("TOTAL", money(c.total), "font-weight:bold;font-size:" + (size + 2) + "px;margin-top:4px"));
  if (c.tipPrinted != null) {
    lines.push(`<div style="margin-top:10px;position:relative">TIP: ________<span style="position:absolute;left:52px;top:-14px;font-family:'Bradley Hand','Comic Sans MS',cursive;font-size:22px;color:#1a2a8a;transform:rotate(-4deg)">${s.handwrittenTip}</span></div>`);
    lines.push(`<div style="margin-top:12px;position:relative">TOTAL: ________<span style="position:absolute;left:66px;top:-16px;font-family:'Bradley Hand','Comic Sans MS',cursive;font-size:22px;color:#1a2a8a;transform:rotate(-3deg)">${s.handwrittenTotal}</span></div>`);
    lines.push(`<div style="margin-top:16px;font-family:'Bradley Hand','Comic Sans MS',cursive;font-size:20px;color:#1a2a8a">J. Rivera</div>`);
  }
  for (const f of c.footer) lines.push(`<div style="text-align:center;margin-top:${f === c.footer[0] ? 10 : 0}px">${f}</div>`);
  const paper = `<div id="paper" style="background:#fbfaf6;width:${width}px;padding:22px 16px 30px;font-family:${font};font-size:${size}px;line-height:1.45;color:#1b1b1b;box-shadow:0 2px 12px rgba(0,0,0,.35)">${lines.join("")}</div>`;
  const filter = s.fade ? "filter:contrast(.55) brightness(1.18) blur(.3px);" : "";
  const skew = s.skew ? "transform:perspective(900px) rotateZ(-4deg) rotateX(6deg);" : "transform:rotate(1.2deg);";
  return `<body style="margin:0;background:#6d655c;display:flex;align-items:flex-start;justify-content:center;padding:40px 0"><div style="${filter}${skew}">${paper}</div></body>`;
}

const expected = (c) => ({
  readable: c.readable, merchant: c.merchant || null, date: c.date, currency: c.currency,
  items: c.items.map((it) => ({ name: it.name, quantity: it.quantity, line_total_cents: it.line_total_cents, kind: it.kind, is_void: it.is_void })),
  subtotal_cents: c.subtotal, tax_lines: c.taxes.map((t) => ({ label: t.label, amount_cents: t.cents, applies_to: t.applies_to })),
  fees: c.fees.map((f) => ({ label: f.label, amount_cents: f.cents, kind: f.kind })), discounts: c.discounts.map((d) => ({ label: d.label, amount_cents: d.cents, item_index: d.item_index })),
  printed_total_cents: c.readable ? c.total : null, tip_printed_cents: c.tipPrinted, tax_included_in_prices: c.taxIncluded, pages: c.pages,
});

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2 });
for (const c of CASES) {
  await page.setContent(receiptHtml(c));
  await page.evaluate(() => document.fonts.ready);
  if (c.pages === 2) {
    const box = await page.locator("#paper").boundingBox();
    const half = Math.ceil(box.height / 2) + 30;
    await page.screenshot({ path: path.join(out, `${c.name}-1.png`), clip: { x: 0, y: 0, width: 700, height: Math.min(900, box.y + half) } });
    await page.setViewportSize({ width: 700, height: Math.ceil(box.y + box.height + 60) });
    await page.screenshot({ path: path.join(out, `${c.name}-2.png`), clip: { x: 0, y: box.y + half - 60, width: 700, height: box.height - half + 120 } });
    await page.setViewportSize({ width: 700, height: 900 });
  } else {
    const box = await page.locator("#paper").boundingBox().catch(() => null);
    await page.screenshot({ path: path.join(out, `${c.name}.png`), fullPage: !!box && box.y + box.height > 900 });
  }
  fs.writeFileSync(path.join(out, `${c.name}.expected.json`), JSON.stringify(expected(c), null, 2) + "\n");
  console.log("wrote", c.name, c.readable ? `total ${money(c.total)}` : "(not a receipt)");
}
await browser.close();
