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

/** Lo único que se guarda en el navegador: textos del local y precio/stock por modelo+capacidad. */
function slim(cur) {
  return {
    v: 2,
    shop: cur.shop,
    products: cur.products.map((p) => ({ id: p.id, storages: p.storages.map(({ gb, price, stock }) => ({ gb, price, stock })) }))
  };
}

function saveOverrides(cur) {
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify(slim(cur))); } catch { /* sin almacenamiento */ }
}

/**
 * Aplica lo guardado SOBRE los datos desplegados: nombres, colores y fichas siempre vienen del deploy,
 * así que un guardado viejo (modelo borrado, esquema distinto) no puede romper la app; se ignora lo que ya no existe.
 */
function readOverrides(base) {
  try {
    const raw = JSON.parse(localStorage.getItem(ADMIN_KEY) || "null");
    if (!raw || typeof raw !== "object") return null;
    const saved = new Map((Array.isArray(raw.products) ? raw.products : []).filter((p) => p && Array.isArray(p.storages)).map((p) => [p.id, p.storages]));
    const merged = {
      ...base,
      shop: raw.shop && typeof raw.shop === "object" ? { ...base.shop, ...raw.shop } : base.shop,
      products: base.products.map((p) => {
        const st = saved.get(p.id);
        if (!st) return p;
        return {
          ...p,
          storages: p.storages.map((s) => {
            const o = st.find((x) => x && x.gb === s.gb);
            const ok = o && Number.isInteger(o.price) && o.price > 0 && Number.isInteger(o.stock) && o.stock >= 0;
            return ok ? { ...s, price: o.price, stock: o.stock } : s;
          })
        };
      })
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
    saveOverrides(next);
  }, []);

  const updateShop = useCallback((patch) => {
    setCurrent((cur) => {
      if (!cur) return cur;
      const next = { ...cur, shop: { ...cur.shop, ...patch } };
      saveOverrides(next);
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
      saveOverrides(next);
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
      saveOverrides(next);
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
