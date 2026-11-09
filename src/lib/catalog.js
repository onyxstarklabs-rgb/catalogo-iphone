import { useCallback, useEffect, useMemo, useState } from "react";

const ADMIN_KEY = "catalogo-admin-v1";
const url = (name) => `${import.meta.env.BASE_URL}data/${name}.json`;

async function getJSON(name) {
  const r = await fetch(url(name), { cache: "no-cache" });
  if (!r.ok) throw new Error(`No se pudo cargar data/${name}.json (${r.status})`);
  return r.json();
}

/** Revisa los datos del cliente; si algo está mal se muestra el error en lugar de un catálogo a medias. */
export function validate({ shop, colors, warr, products }) {
  const err = [];
  if (!/^\d{10,15}$/.test(shop.whatsapp)) err.push("shop.whatsapp debe ser solo dígitos con indicativo de país (10 a 15 dígitos)");
  for (const p of products) {
    if (!warr[p.warr]) err.push(`${p.id}: garantía "${p.warr}" no existe`);
    for (const c of p.colors) if (!colors[c]) err.push(`${p.id}: color "${c}" no existe`);
    for (const s of p.storages) {
      if (!Number.isInteger(s.price) || s.price <= 0 || !Number.isInteger(s.stock) || s.stock < 0) err.push(`${p.id} ${s.gb}: precio o stock inválido`);
    }
  }
  return err;
}

function readOverrides(base) {
  try {
    const raw = JSON.parse(localStorage.getItem(ADMIN_KEY) || "null");
    if (!raw || typeof raw !== "object") return null;
    const merged = {
      shop: raw.shop ? { ...base.shop, ...raw.shop } : base.shop,
      colors: base.colors,
      warr: base.warr,
      products: Array.isArray(raw.products) ? raw.products : base.products
    };
    return validate(merged).length === 0 ? merged : null;
  } catch {
    return null;
  }
}

async function loadCatalog() {
  const [shop, colors, warr, products] = await Promise.all(["shop", "colors", "warranties", "products"].map(getJSON));
  const problems = validate({ shop, colors, warr, products });
  if (problems.length) throw new Error(problems.join(" · "));
  return { shop, colors, warr, products };
}

export function useCatalog() {
  const [base, setBase] = useState(null);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState(null);
  const [hasOverrides, setHasOverrides] = useState(false);

  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      (loaded) => {
        if (!alive) return;
        setBase(loaded);
        const saved = readOverrides(loaded);
        setCurrent(saved || loaded);
        setHasOverrides(Boolean(saved));
      },
      (err) => alive && setError(err.message)
    );
    return () => { alive = false; };
  }, []);

  const persist = useCallback((next) => {
    setCurrent(next);
    setHasOverrides(true);
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify({ shop: next.shop, products: next.products }));
    } catch { /* sin almacenamiento */ }
  }, []);

  const updateShop = useCallback((patch) => {
    setCurrent((cur) => {
      if (!cur) return cur;
      const next = { ...cur, shop: { ...cur.shop, ...patch } };
      try { localStorage.setItem(ADMIN_KEY, JSON.stringify({ shop: next.shop, products: next.products })); } catch { /* ignore */ }
      setHasOverrides(true);
      return next;
    });
  }, []);

  const setProductStock = useCallback((productId, stockValue) => {
    setCurrent((cur) => {
      if (!cur) return cur;
      const products = cur.products.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          storages: p.storages.map((s) => ({ ...s, stock: stockValue }))
        };
      });
      const next = { ...cur, products };
      try { localStorage.setItem(ADMIN_KEY, JSON.stringify({ shop: next.shop, products: next.products })); } catch { /* ignore */ }
      setHasOverrides(true);
      return next;
    });
  }, []);

  const updateStorage = useCallback((productId, gb, patch) => {
    setCurrent((cur) => {
      if (!cur) return cur;
      const products = cur.products.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          storages: p.storages.map((s) => (s.gb === gb ? { ...s, ...patch } : s))
        };
      });
      const next = { ...cur, products };
      try { localStorage.setItem(ADMIN_KEY, JSON.stringify({ shop: next.shop, products: next.products })); } catch { /* ignore */ }
      setHasOverrides(true);
      return next;
    });
  }, []);

  const resetOverrides = useCallback(() => {
    try { localStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ }
    setHasOverrides(false);
    if (base) setCurrent(base);
  }, [base]);

  const data = useMemo(() => {
    if (!current) return null;
    return {
      ...current,
      byId: Object.fromEntries(current.products.map((p) => [p.id, p])),
      lines: ["Todos", ...new Set(current.products.map((p) => p.line))],
      hasOverrides,
      updateShop,
      updateStorage,
      setProductStock,
      resetOverrides,
      persist
    };
  }, [current, hasOverrides, updateShop, updateStorage, setProductStock, resetOverrides, persist]);

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
