import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Cliente de Supabase con la clave PUBLICABLE (segura de exponer: la protegen las políticas RLS).
 * Sin variables de entorno el catálogo funciona en modo estático (solo JSON) y el panel del local no se ofrece.
 * La clave service_role NUNCA va en el front.
 */
export const supabase =
  URL && KEY
    ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null;
