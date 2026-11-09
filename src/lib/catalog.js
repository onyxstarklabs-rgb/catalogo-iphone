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
const IMG_BUCKET = "product-images";
const imageUrl = (path) => supabase.storage.from(IMG_BUCKET).getPublicUrl(path).data.publicUrl;
const validSpecs = (specs) => (Array.isArray(specs) ? specs.filter((x) => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string").slice(0, 10) : []);

function applyRemote(base, shopRow, stockRows, customRows, imageRows) {
  const live = new Map((stockRows || []).map((r) => [`${r.product_id}|${r.gb}`, r]));
  const images = new Map((imageRows || []).map((r) => [r.product_id, r.path]));
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
  if (validate(merged).length !== 0) return base;

  // Productos creados desde el panel: se ignoran los que no pasen la validación (nunca tumban el catálogo).
  const custom = (customRows || [])
    .map((c) => ({
      id: c.id, name: c.name, line: c.line, cond: c.cond, warr: c.warr, colors: c.colors, specs: validSpecs(c.specs), custom: true,
      storages: (stockRows || []).filter((r) => r.product_id === c.id).map(({ gb, price, stock }) => ({ gb, price, stock })).sort((x, y) => x.gb - y.gb)
    }))
    .filter((p) => validate({ ...merged, products: [p] }).length === 0);

  const products = [...merged.products, ...custom].map((p) => (images.has(p.id) ? { ...p, imageUrl: imageUrl(images.get(p.id)), imagePath: images.get(p.id) } : p));
  return { ...merged, products };
}

async function fetchRemote() {
  const [shop, stock, custom, images] = await Promise.all([
    supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("stock").select("product_id,gb,price,stock"),
    supabase.from("custom_products").select("*").order("created_at"),
    supabase.from("product_images").select("product_id,path")
  ]);
  const failed = shop.error || stock.error || custom.error || images.error;
  if (failed) throw new Error(failed.message);
  return { shop: shop.data, stock: stock.data, custom: custom.data, images: images.data };
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
      setCurrent(applyRemote(baseRef.current, r.shop, r.stock, r.custom, r.images));
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
          try { const r = await fetchRemote(); next = applyRemote(loaded, r.shop, r.stock, r.custom, r.images); } catch { /* sin conexión a la base: se usa el JSON */ }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_products" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_images" }, onChange)
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

  const newId = () => `c-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => "abcdefghijklmnopqrstuvwxyz0123456789"[n % 36]).join("")}`;

  /** Ejecuta una operación contra Supabase y devuelve { ok, error } sin lanzar; refresca el catálogo al terminar. */
  const run = useCallback(async (fn) => {
    try { await fn(); await resync(); return { ok: true }; }
    catch (e) { await resync(); return { ok: false, error: e.message || "Error de red" }; }
  }, [resync]);
  const must = ({ error: err }) => { if (err) throw new Error(err.message); };

  const putImage = async (productId, image, oldPath) => {
    const path = `${productId}/${crypto.randomUUID()}.${image.ext}`;
    must(await supabase.storage.from(IMG_BUCKET).upload(path, image.blob, { contentType: image.contentType, cacheControl: "31536000", upsert: false }));
    try {
      must(await supabase.from("product_images").upsert({ product_id: productId, path, updated_at: new Date().toISOString() }));
    } catch (e) {
      await supabase.storage.from(IMG_BUCKET).remove([path]);
      throw e;
    }
    if (oldPath) await supabase.storage.from(IMG_BUCKET).remove([oldPath]);
  };

  const toRow = (f) => ({ name: f.name.trim(), line: f.line.trim(), cond: f.cond, warr: f.warr, colors: f.colors, specs: (f.specs || []).filter((x) => x && x.label && x.value).map((x) => [String(x.label).trim(), String(x.value).trim()]) });
  const stockRowsOf = (id, f) => f.storages.map((s) => ({ product_id: id, gb: s.gb, price: s.price, stock: s.stock }));

  const createProduct = useCallback((f, image) => run(async () => {
    const id = newId();
    must(await supabase.from("custom_products").insert({ id, ...toRow(f) }));
    try {
      must(await supabase.from("stock").insert(stockRowsOf(id, f)));
      if (image) await putImage(id, image, null);
    } catch (e) {
      await supabase.from("stock").delete().eq("product_id", id);
      await supabase.from("custom_products").delete().eq("id", id);
      throw e;
    }
  }), [run]);

  const updateProduct = useCallback((id, f, image) => run(async () => {
    const cur = current.products.find((p) => p.id === id);
    if (!cur || !cur.custom) throw new Error("Solo se pueden editar los productos creados desde el panel");
    must(await supabase.from("custom_products").update(toRow(f)).eq("id", id).select("id").single());
    const keep = new Set(f.storages.map((s) => s.gb));
    const removed = cur.storages.map((s) => s.gb).filter((gb) => !keep.has(gb));
    if (removed.length) must(await supabase.from("stock").delete().eq("product_id", id).in("gb", removed));
    must(await supabase.from("stock").upsert(stockRowsOf(id, f)));
    if (image) await putImage(id, image, cur.imagePath);
  }), [run, current]);

  const deleteProduct = useCallback((id) => run(async () => {
    const cur = current.products.find((p) => p.id === id);
    if (!cur || !cur.custom) throw new Error("Solo se pueden eliminar los productos creados desde el panel");
    must(await supabase.from("stock").delete().eq("product_id", id));
    must(await supabase.from("product_images").delete().eq("product_id", id));
    must(await supabase.from("custom_products").delete().eq("id", id));
    if (cur.imagePath) await supabase.storage.from(IMG_BUCKET).remove([cur.imagePath]);
  }), [run, current]);

  const setProductImage = useCallback((id, image) => run(async () => {
    const cur = current.products.find((p) => p.id === id);
    if (!cur) throw new Error("Producto no encontrado");
    await putImage(id, image, cur.imagePath);
  }), [run, current]);

  const removeProductImage = useCallback((id) => run(async () => {
    const cur = current.products.find((p) => p.id === id);
    if (!cur || !cur.imagePath) return;
    must(await supabase.from("product_images").delete().eq("product_id", id));
    await supabase.storage.from(IMG_BUCKET).remove([cur.imagePath]);
  }), [run, current]);

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
      resetOverrides,
      createProduct,
      updateProduct,
      deleteProduct,
      setProductImage,
      removeProductImage
    };
  }, [current, hasOverrides, sync, updateShop, updateStorage, setProductStock, resetOverrides, createProduct, updateProduct, deleteProduct, setProductImage, removeProductImage]);

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
