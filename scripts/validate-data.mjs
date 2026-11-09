// Valida data/*.json sin dependencias. Uso: node scripts/validate-data.mjs
import { readFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}.json`, import.meta.url), "utf8"));
const shop = load("shop"), colors = load("colors"), warr = load("warranties"), products = load("products");
const err = [];
if (!/^\d{10,15}$/.test(shop.whatsapp)) err.push("shop.whatsapp: solo dígitos con indicativo (10 a 15)");
const ids = new Set();
for (const p of products) {
  if (ids.has(p.id)) err.push(`${p.id}: id repetido`); ids.add(p.id);
  if (!/^[a-z0-9-]+$/.test(p.id)) err.push(`${p.id}: el id solo admite minúsculas, números y guiones`);
  if (!warr[p.warr]) err.push(`${p.id}: garantía "${p.warr}" no existe`);
  for (const c of p.colors) if (!colors[c]) err.push(`${p.id}: color "${c}" no existe`);
  if (!p.storages?.length) err.push(`${p.id}: sin capacidades`);
  for (const s of p.storages ?? []) {
    if (!Number.isInteger(s.price) || s.price <= 0) err.push(`${p.id} ${s.gb}: precio inválido`);
    if (!Number.isInteger(s.stock) || s.stock < 0) err.push(`${p.id} ${s.gb}: stock inválido`);
  }
}
if (err.length) { console.error(err.map((e) => "✗ " + e).join("\n")); process.exit(1); }
console.log(`OK: ${products.length} productos, ${Object.keys(colors).length} colores, ${Object.keys(warr).length} garantías`);
