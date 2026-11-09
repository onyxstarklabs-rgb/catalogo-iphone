import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

async function isOwner(userId) {
  const { data, error } = await supabase.from("owners").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && Boolean(data);
}

/** Sesión del dueño: autenticado en Supabase Auth Y presente en la tabla `owners`. */
export function useOwner() {
  const [state, setState] = useState({ ready: !supabase, owner: false });

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    const check = async (session) => {
      const owner = session ? await isOwner(session.user.id).catch(() => false) : false;
      if (alive) setState({ ready: true, owner });
    };
    supabase.auth.getSession().then(({ data }) => check(data.session), () => alive && setState({ ready: true, owner: false }));
    // setTimeout: Supabase no admite llamadas a su API dentro del propio callback (bloqueo interno).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => check(session), 0); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw new Error("Correo o contraseña incorrectos");
    if (!(await isOwner(data.user.id).catch(() => false))) {
      await supabase.auth.signOut();
      throw new Error("Esta cuenta no tiene acceso al panel del local");
    }
  }, []);

  const signOut = useCallback(() => supabase.auth.signOut().catch(() => {}), []);

  return { ...state, available: Boolean(supabase), signIn, signOut };
}
