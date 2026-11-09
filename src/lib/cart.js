import { useCallback, useEffect, useMemo, useState } from "react";
import { cop, nameWith } from "./format";
import { priceOf, stockOf } from "./catalog";

const KEY = "catalogo-carrito-v1";

/** El carrito guardado se revalida contra el catálogo vigente: nada de lo guardado se da por bueno. */
function readSaved(catalog) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((l) => {
      const p = l && catalog.byId[l.id];
      return p && catalog.colors[l.color] && p.storages.some((s) => s.gb === l.gb)
        && Number.isInteger(l.qty) && l.qty > 0 && l.qty <= stockOf(p, l.gb);
    }).map(({ id, gb, color, qty }) => ({ id, gb, color, qty }));
  } catch { return []; }
}

export function useCart(catalog) {
  const [lines, setLines] = useState(() => readSaved(catalog));
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* sin almacenamiento */ } }, [lines]);

  /** Unidades de un modelo y capacidad que ya están en el pedido, sumando todos los colores. */
  const reserved = useCallback((id, gb) => lines.filter((l) => l.id === id && l.gb === gb).reduce((a, l) => a + l.qty, 0), [lines]);
  const available = useCallback((id, gb) => stockOf(catalog.byId[id], gb) - reserved(id, gb), [catalog, reserved]);

  const add = useCallback((id, gb, color, qty) => {
    const n = Math.min(qty, available(id, gb));
    if (n < 1) return 0;
    setLines((cur) => {
      const i = cur.findIndex((l) => l.id === id && l.gb === gb && l.color === color);
      if (i < 0) return [...cur, { id, gb, color, qty: n }];
      return cur.map((l, k) => (k === i ? { ...l, qty: l.qty + n } : l));
    });
    return n;
  }, [available]);

  const setQty = useCallback((index, qty) => {
    setLines((cur) => {
      const l = cur[index];
      if (!l) return cur;
      const others = cur.filter((x, k) => k !== index && x.id === l.id && x.gb === l.gb).reduce((a, x) => a + x.qty, 0);
      const max = stockOf(catalog.byId[l.id], l.gb) - others;
      const next = Math.min(Math.max(Math.floor(qty) || 1, 1), max);
      return cur.map((x, k) => (k === index ? { ...x, qty: next } : x));
    });
  }, [catalog]);

  const remove = useCallback((index) => setLines((cur) => cur.filter((_, k) => k !== index)), []);
  const clear = useCallback(() => setLines([]), []);

  const count = useMemo(() => lines.reduce((a, l) => a + l.qty, 0), [lines]);
  const total = useMemo(() => lines.reduce((a, l) => a + priceOf(catalog.byId[l.id], l.gb) * l.qty, 0), [lines, catalog]);

  return { lines, count, total, add, setQty, remove, clear, available };
}

/** Resumen de orden de reserva (Plan Base) y enlace de WhatsApp (2ª Suscripción / Add-on Chatbot). */
export function buildOrderSummary(catalog, lines, total, name, delivery, code) {
  const { shop, byId, colors, warr } = catalog;
  const rows = lines.map((l) => {
    const p = byId[l.id];
    return `• ${l.qty} × ${nameWith(p.name, l.gb)} ${colors[l.color][0]} (${p.cond}, garantía ${warr[p.warr].months} meses) — ${cop(priceOf(p, l.gb) * l.qty, shop.currency)}`;
  });
  const header = code ? `ORDEN DE RESERVA #${code} · ${shop.name}` : `Hola ${shop.name}, quiero hacer este pedido:`;
  return `${header}\n${rows.join("\n")}\nTotal: ${cop(total, shop.currency)}\nCliente: ${name.trim()}\nEntrega: ${delivery}`;
}

export function whatsappLink(catalog, lines, total, name, delivery) {
  const msg = buildOrderSummary(catalog, lines, total, name, delivery);
  return `https://wa.me/${catalog.shop.whatsapp}?text=${encodeURIComponent(msg)}`;
}
