"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

export async function cerrarPeriodo(idPais: number, anio: number, mes: number) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("periodo_cerrar", { p_pais: idPais, p_anio: anio, p_mes: mes });
  if (error) return { error: error.message };
  revalidatePath("/periodos");
  return { ok: true };
}

export async function reabrirPeriodo(idPais: number, anio: number, mes: number, motivo: string) {
  await requerirVendedor();
  if (motivo.trim().length < 5) return { error: "Escriba el motivo de la reapertura (mínimo 5 letras)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("periodo_reabrir", {
    p_pais: idPais,
    p_anio: anio,
    p_mes: mes,
    p_motivo: motivo.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/periodos");
  return { ok: true };
}
