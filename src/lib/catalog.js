import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

const url = (name) => `${import.meta.env.BASE_URL}data/${name}.json`;

async function getJSON(name) {
  const r = await fetch(url(name), { cache: "no-cache" });
  if (!r.ok) throw new Error(`No se pudo cargar data/${name}.json (${r.status})`);
  return r.json();
}

/** Revisa los datos del cliente; si algo está mal se muestra el error en lugar de un catálogo a medias. */
export function validate({ shop, colors, warr, products }) {
  const err = [];
  if (typeof shop?.whatsapp !== "string" || !/^\d{10,15}$/.test(shop.whatsapp)) err.push("shop.whatsapp debe ser solo dígitos con indicativo de país (10 a 15 dígitos)");
  if (!Array.isArray(products) || products.length === 0) return [...err, "products debe ser una lista con al menos un modelo"];
  for (const p of products) {
    if (!p || typeof p.id !== "string") { err.push("modelo sin id"); continue; }
    if (!warr[p.warr]) err.push(`${p.id}: garantía "${p.warr}" no existe`);
    if (!Array.isArray(p.colors) || p.colors.length === 0) { err.push(`${p.id}: sin colores`); continue; }
    if (!Array.isArray(p.storages) || p.storages.length === 0) { err.push(`${p.id}: sin capacidades`); continue; }
    for (const c of p.colors) if (!colors[c]) err.push(`${p.id}: color "${c}" no existe`);
    for (const s of p.storages) {
      if (!Number.isInteger(s.price) || s.price <= 0 || !Number.isInteger(s.stock) || s.stock < 0) err.push(`${p.id} ${s.gb}: precio o stock inválido`);
    }
  }
  return err;
}

const shopFromRow = (r) => ({
  name: r.name, tagline: r.tagline, headline: r.headline, sub: r.sub, hours: r.hours,
  whatsapp: r.whatsapp, whatsappLabel: r.whatsapp_label, whatsappAddon: r.whatsapp_addon
});
const SHOP_COLS = { name: "name", tagline: "tagline", headline: "headline", sub: "sub", hours: "hours", whatsapp: "whatsapp", whatsappLabel: "whatsapp_label", whatsappAddon: "whatsapp_addon" };
const shopToRow = (patch) => Object.fromEntries(Object.entries(patch).filter(([k]) => SHOP_COLS[k]).map(([k, v]) => [SHOP_COLS[k], v]));

/**
 * Los datos en vivo (precio, stock y textos del local) viven en Supabase; la estructura (nombres, colores, fichas)
 * siempre viene de los JSON del deploy. Lo que no exista o sea inválido en la base se ignora y queda el valor del JSON.
 */
function applyRemote(base, shopRow, stockRows) {
  const live = new Map((stockRows || []).map((r) => [`${r.product_id}|${r.gb}`, r]));
  const merged = {
    ...base,
    shop: shopRow ? { ...base.shop, ...shopFromRow(shopRow) } : base.shop,
    products: base.products.map((p) => ({
      ...p,
      storages: p.storages.map((s) => {
        const r = live.get(`${p.id}|${s.gb}`);
        return r && Number.isInteger(r.price) && r.price > 0 && Number.isInteger(r.stock) && r.stock >= 0 ? { ...s, price: r.price, stock: r.stock } : s;
      })
    }))
  };
  return validate(merged).length === 0 ? merged : base;
}

async function fetchRemote() {
  const [shop, stock] = await Promise.all([
    supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("stock").select("product_id,gb,price,stock")
  ]);
  if (shop.error || stock.error) throw new Error((shop.error || stock.error).message);
  return { shop: shop.data, stock: stock.data };
}

async function loadCatalog() {
  const [shop, colors, warr, products] = await Promise.all(["shop", "colors", "warranties", "products"].map(getJSON));
  const problems = validate({ shop, colors, warr, products });
  if (problems.length) throw new Error(problems.join(" · "));
  return { shop, colors, warr, products };
}

const DEBOUNCE_MS = 500;

export function useCatalog() {
  const [base, setBase] = useState(null);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState(null);
  const [sync, setSync] = useState({ status: "idle", error: null });
  const baseRef = useRef(null);
  const queue = useRef(new Map());
  const inflight = useRef(0);

  const resync = useCallback(async () => {
    if (!supabase || !baseRef.current) return;
    try {
      const r = await fetchRemote();
      setCurrent(applyRemote(baseRef.current, r.shop, r.stock));
    } catch { /* se mantiene lo que hay en pantalla */ }
  }, []);

  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      async (loaded) => {
        if (!alive) return;
        baseRef.current = loaded;
        setBase(loaded);
        let next = loaded;
        if (supabase) {
          try { const r = await fetchRemote(); next = applyRemote(loaded, r.shop, r.stock); } catch { /* sin conexión a la base: se usa el JSON */ }
        }
        if (alive) setCurrent(next);
      },
      (err) => alive && setError(err.message)
    );
    return () => { alive = false; };
  }, []);

  // Cambios hechos desde otro dispositivo (o por otro cliente) llegan en vivo.
  useEffect(() => {
    if (!supabase || !base) return undefined;
    let timer;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (queue.current.size === 0 && inflight.current === 0) resync(); }, 300);
    };
    const channel = supabase.channel("catalogo-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_settings" }, onChange)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [base, resync]);

  const flush = useCallback(async (key) => {
    const job = queue.current.get(key);
    if (!job) return;
    queue.current.delete(key);
    inflight.current += 1;
    setSync({ status: "saving", error: null });
    let failed = null;
    try {
      const { data, error: err } = await job.run(job.patch);
      if (err) failed = err.message;
      else if (!data || data.length === 0) failed = "Sin permiso para guardar (inicia sesión como dueño)";
    } catch (e) {
      failed = e.message || "Error de red";
    }
    inflight.current -= 1;
    if (failed) {
      setSync({ status: "error", error: `No se pudo guardar: ${failed}` });
      await resync();
    } else if (queue.current.size === 0 && inflight.current === 0) {
      setSync({ status: "saved", error: null });
    }
  }, [resync]);

  const enqueue = useCallback((key, patch, run) => {
    const prev = queue.current.get(key);
    if (prev) clearTimeout(prev.timer);
    const job = { patch: { ...(prev ? prev.patch : {}), ...patch }, run };
    job.timer = setTimeout(() => flush(key), DEBOUNCE_MS);
    queue.current.set(key, job);
  }, [flush]);

  const updateShop = useCallback((patch) => {
    setCurrent((cur) => (cur ? { ...cur, shop: { ...cur.shop, ...patch } } : cur));
    enqueue("shop", shopToRow(patch), (row) => supabase.from("shop_settings").update(row).eq("id", 1).select("id"));
  }, [enqueue]);

  const updateStorage = useCallback((productId, gb, patch) => {
    const row = {};
    if (patch.price !== undefined) row.price = patch.price;
    if (patch.stock !== undefined) row.stock = patch.stock;
    setCurrent((cur) => (cur ? {
      ...cur,
      products: cur.products.map((p) => (p.id !== productId ? p : { ...p, storages: p.storages.map((s) => (s.gb === gb ? { ...s, ...row } : s)) }))
    } : cur));
    enqueue(`stock|${productId}|${gb}`, row, (r) => supabase.from("stock").update(r).eq("product_id", productId).eq("gb", gb).select("product_id"));
  }, [enqueue]);

  const setProductStock = useCallback((productId, stockValue) => {
    const p = current && current.products.find((x) => x.id === productId);
    if (p) p.storages.forEach((s) => updateStorage(productId, s.gb, { stock: stockValue }));
  }, [current, updateStorage]);

  const resetOverrides = useCallback(() => {
    if (!base) return;
    setCurrent(base);
    updateShop(base.shop);
    base.products.forEach((p) => p.storages.forEach((s) => updateStorage(p.id, s.gb, { price: s.price, stock: s.stock })));
  }, [base, updateShop, updateStorage]);

  const hasOverrides = useMemo(() => {
    if (!base || !current) return false;
    if (JSON.stringify(base.shop) !== JSON.stringify(current.shop)) return true;
    return base.products.some((p, i) => JSON.stringify(p.storages) !== JSON.stringify(current.products[i].storages));
  }, [base, current]);

  const data = useMemo(() => {
    if (!current) return null;
    return {
      ...current,
      byId: Object.fromEntries(current.products.map((p) => [p.id, p])),
      lines: ["Todos", ...new Set(current.products.map((p) => p.line))],
      hasOverrides,
      sync,
      updateShop,
      updateStorage,
      setProductStock,
      resetOverrides
    };
  }, [current, hasOverrides, sync, updateShop, updateStorage, setProductStock, resetOverrides]);

  if (error) return { status: "error", data: null, error };
  if (!data) return { status: "loading", data: null, error: null };
  return { status: "ready", data, error: null };
}

export const stockOf = (product, gb) => product.storages.find((s) => s.gb === gb).stock;
export const priceOf = (product, gb) => product.storages.find((s) => s.gb === gb).price;
export const fromPrice = (p) => {
  const available = p.storages.filter((s) => s.stock > 0);
  const target = available.length > 0 ? available : p.storages;
  return Math.min(...target.map((s) => s.price));
};
export const totalStock = (p) => p.storages.reduce((a, s) => a + s.stock, 0);
