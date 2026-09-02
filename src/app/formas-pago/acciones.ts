"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

async function soloAdmin() {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") return "Solo el administrador puede hacer esto.";
  return null;
}

export async function crearFormaPago(
  descripcion: string,
  orden: number,
  piePct: number
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!descripcion.trim()) return { error: "Indique la descripcion." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("formas_pago")
    .insert({
      descripcion: descripcion.trim(),
      orden,
      pie_pct: piePct,
      activo: true,
    });
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
  orden: number,
  piePct: number
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!descripcion.trim()) return { error: "Indique la descripcion." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("formas_pago")
    .update({ descripcion: descripcion.trim(), orden, pie_pct: piePct })
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

// --- medios de pago ---------------------------------------------------------

// Tarjeta y link de pago cobran comision. No se descuenta del precio: se
// recarga sobre el total dividiendo por (1 - comision), de modo que a Centro
// Panel le llegue integro lo cotizado.
export async function actualizarMedioPago(
  id: number,
  nombre: string,
  comisionPct: number,
  activo: boolean
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!nombre.trim()) return { error: "Indique el nombre." };
  if (comisionPct < 0 || comisionPct >= 100) {
    return { error: "La comision debe estar entre 0 y 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("medios_pago")
    .update({ nombre: nombre.trim(), comision_pct: comisionPct, activo })
    .eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un medio de pago con ese nombre."
          : error.message,
    };
  }
  revalidatePath("/formas-pago");
  revalidatePath("/cotizaciones");
  return { ok: true };
}

export async function crearMedioPago(nombre: string, comisionPct: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!nombre.trim()) return { error: "Indique el nombre." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("medios_pago")
    .insert({ nombre: nombre.trim(), comision_pct: comisionPct });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un medio de pago con ese nombre."
          : error.message,
    };
  }
  revalidatePath("/formas-pago");
  return { ok: true };
}

// Cual forma de pago viene propuesta al abrir una cotizacion. Es una sola: se
// apagan todas y se prende la elegida, en ese orden, porque el indice unico de
// la base no admite dos marcadas ni por un instante.
export async function marcarFormaPagoPorDefecto(id: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();

  const { error: e1 } = await supabase
    .from("formas_pago")
    .update({ por_defecto: false })
    .eq("por_defecto", true);
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase
    .from("formas_pago")
    .update({ por_defecto: true })
    .eq("id", id);
  if (e2) return { error: e2.message };

  revalidatePath("/formas-pago");
  revalidatePath("/cotizaciones/nueva");
  return { ok: true };
}
