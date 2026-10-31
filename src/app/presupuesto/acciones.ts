"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

export async function guardarPresupuesto(centro: number, anio: number, tipo: "Gasto" | "Ingreso", montos: number[]) {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) return { error: "No tiene permiso para cambiar el presupuesto." };
  if (montos.length !== 12 || montos.some((m) => !Number.isFinite(m) || m < 0)) {
    return { error: "Los 12 montos deben ser números desde 0." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("presupuesto_guardar", {
    p_centro: centro,
    p_anio: anio,
    p_tipo: tipo,
    p_montos: montos,
  });
  if (error) return { error: error.message };
  revalidatePath("/presupuesto");
  return { ok: true };
}
