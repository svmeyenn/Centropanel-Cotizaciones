"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

function refrescar() {
  revalidatePath("/aprobaciones");
  revalidatePath("/egresos");
  revalidatePath("/compras");
}

async function llamar(fn: string, args: Record<string, unknown>) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  refrescar();
  return { ok: true };
}

export async function aprobarEgreso(idMov: number) {
  return llamar("egreso_aprobar", { p_mov: idMov });
}
export async function rechazarEgreso(idMov: number, motivo: string) {
  return llamar("egreso_rechazar", { p_mov: idMov, p_motivo: motivo });
}
export async function aprobarOrden(idOc: number) {
  return llamar("oc_aprobar", { p_oc: idOc });
}
export async function rechazarOrden(idOc: number, motivo: string) {
  return llamar("oc_rechazar", { p_oc: idOc, p_motivo: motivo });
}
