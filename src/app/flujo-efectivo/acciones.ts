"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

// Cambia el concepto de flujo de un solo movimiento; vacio vuelve al de su categoria.
export async function asignarConceptoFlujo(idMov: number, concepto: string) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mov_concepto_flujo", {
    p_mov: idMov,
    p_flujo: concepto,
  });
  if (error) return { error: error.message };
  revalidatePath("/flujo-efectivo");
  return { ok: true };
}
