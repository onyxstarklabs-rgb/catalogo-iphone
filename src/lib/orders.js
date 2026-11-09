import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

const FRIENDLY = [
  [/^SIN_STOCK:(.*)/, (m) => `Ya no hay stock suficiente de ${m[1]}. Actualizamos el catálogo.`],
  [/^DEMASIADAS_UNIDADES/, () => "Máximo 5 unidades por reserva."],
  [/^LIMITE_POR_CLIENTE/, () => "Ya tienes 3 reservas activas con ese nombre. Recógelas o espera a que venzan."],
  [/^DEMASIADAS_RESERVAS/, () => "Hay muchas reservas en este momento. Intenta de nuevo en unos minutos."],
  [/^NOMBRE_INVALIDO/, () => "Escribe tu nombre y apellido (2 a 80 caracteres)."],
  [/^PRODUCTO_NO_ENCONTRADO/, () => "Uno de los productos ya no está disponible. Actualizamos el catálogo."],
  [/^PEDIDO_INVALIDO/, () => "Revisa tu pedido (máximo 3 unidades por producto y 5 en total)."],
  [/^YA_CERRADA/, () => "Esa orden ya estaba cerrada."],
  [/^SIN_PERMISO/, () => "Inicia sesión como dueño para hacer esto."]
];
export function friendlyOrderError(message) {
  for (const [re, fn] of FRIENDLY) { const m = String(message || "").match(re); if (m) return fn(m); }
  return "No se pudo completar la operación. Intenta de nuevo.";
}

/** Crea la reserva en el servidor (valida, descuenta stock y fija el vencimiento). */
export async function createReservation({ name, delivery, lines, labelOf, colorOf }) {
  const { data, error } = await supabase.rpc("create_order", {
    p_name: name.trim(),
    p_delivery: delivery,
    p_items: lines.map((l) => ({ id: l.id, gb: l.gb, qty: l.qty, color: colorOf(l), name: labelOf(l) }))
  });
  if (error) throw new Error(friendlyOrderError(error.message), { cause: error.message });
  const row = Array.isArray(data) ? data[0] : data;
  return { code: row.o_code, total: Number(row.o_total), expiresAt: row.o_expires_at };
}

/** Órdenes para el panel del dueño: en vivo (Realtime) y con refresco cada minuto para ver los vencimientos. */
export function useOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
    if (e) { setError("No se pudieron cargar las órdenes"); return; }
    setError(null);
    setOrders(data);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("orders-live").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load()).subscribe();
    const timer = setInterval(load, 60000);
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [load]);

  const setStatus = useCallback(async (id, status) => {
    const { error: e } = await supabase.rpc("set_order_status", { p_id: id, p_status: status });
    await load();
    return e ? { ok: false, error: friendlyOrderError(e.message) } : { ok: true };
  }, [load]);

  return { orders, error, reload: load, setStatus };
}
