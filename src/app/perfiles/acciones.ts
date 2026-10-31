"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { AREAS, CASILLAS_FIN, NIVELES, esSuperAdmin } from "@/lib/permisos";

export interface DatosPerfil {
  nombre: string;
  ejemplo: string;
  alcance: string;
  rolBase: string;
  permisos: Record<string, string>;
  fin: Record<string, boolean>;
}

const ROLES_BASE = ["Administrador", "Supervisor", "Vendedor", "Comprador", "Consulta"];

// Solo lo conocido: nada que no sea un area, un nivel o un rol valido llega a la base.
function limpiar(d: DatosPerfil) {
  if (!d.nombre.trim()) return { error: "Indique el nombre del perfil." } as const;
  if (!d.alcance.trim()) return { error: "Indique el alcance del perfil." } as const;
  if (!ROLES_BASE.includes(d.rolBase)) return { error: "Rol base no valido." } as const;
  const permisos: Record<string, string> = {};
  for (const a of AREAS) {
    const n = d.permisos[a.k];
    if (!(NIVELES as readonly string[]).includes(n)) return { error: `Nivel no valido en ${a.t}.` } as const;
    permisos[a.k] = n;
  }
  const fin: Record<string, boolean> = {};
  for (const [k] of CASILLAS_FIN) fin[k] = !!d.fin[k];
  return { permisos, fin } as const;
}

// Un perfil nuevo queda sin tope de aprobacion en ningun mercado: no aprueba hasta que se fije.
export async function crearPerfil(d: DatosPerfil) {
  const yo = await requerirVendedor();
  if (!esSuperAdmin(yo)) return { error: "Solo un super administrador crea perfiles." };
  const l = limpiar(d);
  if ("error" in l) return { error: l.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("perfil_crear", {
    p_nombre: d.nombre.trim(),
    p_ejemplo: d.ejemplo.trim(),
    p_alcance: d.alcance.trim(),
    p_rol_base: d.rolBase,
    p_permisos: l.permisos,
    p_fin: l.fin,
  });
  if (error) return { error: error.message };
  revalidatePath("/perfiles");
  return { ok: true };
}

// Cambiar una plantilla afecta a quien se cree desde ella de ahi en adelante;
// las personas que ya la tienen conservan lo suyo hasta que se les reaplique.
export async function guardarPerfil(id: number, d: DatosPerfil) {
  const yo = await requerirVendedor();
  if (!esSuperAdmin(yo)) return { error: "Solo un super administrador cambia los perfiles." };
  const l = limpiar(d);
  if ("error" in l) return { error: l.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("perfil_actualizar", {
    p_id: id,
    p_nombre: d.nombre.trim(),
    p_ejemplo: d.ejemplo.trim(),
    p_alcance: d.alcance.trim(),
    p_rol_base: d.rolBase,
    p_permisos: l.permisos,
    p_fin: l.fin,
  });
  if (error) return { error: error.message };
  revalidatePath("/perfiles");
  return { ok: true };
}

export async function eliminarPerfil(id: number) {
  const yo = await requerirVendedor();
  if (!esSuperAdmin(yo)) return { error: "Solo un super administrador elimina perfiles." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("perfil_eliminar", { p_id: id });
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
