"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";

export type Resultado = { ok: boolean; mensaje?: string };

// Un nombre propio con sus particulas en minuscula: "stephan von meyenn" -> "Stephan von Meyenn".
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "von", "van", "da", "do", "y"]);
function nombrePropio(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// Agrega una persona a la lista de propietarios de leads --o le cambia el nombre--. La base valida
// que el correo y el nombre no se repitan, y corrige los leads que ya traen ese correo o ese nombre.
export async function guardarPropietario(email: string, nombre: string): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return { ok: false, mensaje: "Solo un administrador puede cambiar los propietarios." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("propietario_guardar", { p_email: email, p_nombre: nombrePropio(nombre) });
  if (error) return { ok: false, mensaje: error.message };

  const r = (data ?? {}) as { nombres_corregidos?: number; correos_completados?: number };
  revalidatePath("/propietarios");
  revalidatePath("/leads");
  const tocados = Number(r.nombres_corregidos ?? 0) + Number(r.correos_completados ?? 0);
  return { ok: true, mensaje: tocados > 0 ? `Guardado. Se corrigieron ${tocados} leads.` : "Guardado." };
}

export async function quitarPropietario(email: string): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return { ok: false, mensaje: "Solo un administrador puede cambiar los propietarios." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("propietario_quitar", { p_email: email });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/propietarios");
  return { ok: true, mensaje: (data as string) ?? "Persona quitada." };
}
