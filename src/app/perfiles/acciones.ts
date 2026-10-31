"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { AREAS, CASILLAS_FIN, NIVELES, esSuperAdmin } from "@/lib/permisos";

// Cambiar una plantilla afecta a quien se cree desde ella de ahi en adelante;
// las personas que ya la tienen conservan lo suyo hasta que se les reaplique.
export async function guardarPerfil(
  id: number,
  permisos: Record<string, string>,
  fin: Record<string, boolean>,
  alcance: string
) {
  const yo = await requerirVendedor();
  if (!esSuperAdmin(yo)) return { error: "Solo un super administrador cambia los perfiles." };
  if (!alcance.trim()) return { error: "Indique el alcance del perfil." };

  // Solo lo conocido: nada que no sea un area o un nivel valido llega a la base.
  const limpio: Record<string, string> = {};
  for (const a of AREAS) {
    const n = permisos[a.k];
    if (!(NIVELES as readonly string[]).includes(n)) return { error: `Nivel no valido en ${a.t}.` };
    limpio[a.k] = n;
  }
  const casillas: Record<string, boolean> = {};
  for (const [k] of CASILLAS_FIN) casillas[k] = !!fin[k];

  const supabase = await createClient();
  const { error } = await supabase.rpc("perfil_guardar", {
    p_id: id,
    p_permisos: limpio,
    p_fin: casillas,
    p_alcance: alcance.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/perfiles");
  return { ok: true };
}

// Un tope vacio deja al perfil sin poder aprobar en ese mercado.
export async function guardarTope(idPerfil: number, idPais: number, tope: number | null) {
  const yo = await requerirVendedor();
  if (!esSuperAdmin(yo)) return { error: "Solo un super administrador fija los topes." };
  if (tope != null && (!Number.isFinite(tope) || tope < 0)) {
    return { error: "El tope debe ser un monto desde cero." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("perfil_guardar_tope", {
    p_perfil: idPerfil,
    p_pais: idPais,
    p_tope: tope,
  });
  if (error) return { error: error.message };
  revalidatePath("/perfiles");
  return { ok: true };
}
