"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

async function soloAdmin() {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") return "Solo el administrador puede hacer esto.";
  return null;
}

export async function crearFormaPago(descripcion: string, orden: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!descripcion.trim()) return { error: "Indique la descripcion." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("formas_pago")
    .insert({ descripcion: descripcion.trim(), orden, activo: true });
  // La descripcion es unica: se traduce el error tecnico a algo entendible.
  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe una forma de pago con ese texto." : error.message,
    };
  }
  revalidatePath("/formas-pago");
  return { ok: true };
}

export async function actualizarFormaPago(
  id: number,
  descripcion: string,
  orden: number
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!descripcion.trim()) return { error: "Indique la descripcion." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("formas_pago")
    .update({ descripcion: descripcion.trim(), orden })
    .eq("id", id);
  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe una forma de pago con ese texto." : error.message,
    };
  }
  revalidatePath("/formas-pago");
  return { ok: true };
}

// Se desactiva en vez de borrar: puede estar referenciada por cotizaciones.
export async function cambiarActivoFormaPago(id: number, activo: boolean) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("formas_pago").update({ activo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/formas-pago");
  return { ok: true };
}
