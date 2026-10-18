"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import type { Resultado } from "@/app/leads/actividad-lead";

// Un contacto que ya era lead volvio a escribir por Meta. "Visto" lo saca de la
// bandeja; "Reabrir" ademas devuelve a seguimiento a un lead que estaba perdido.
export async function atenderReingreso(id: number, reabrir: boolean): Promise<Resultado> {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_reingreso_atender", { p_id: id, p_reabrir: reabrir });
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath("/");
  revalidatePath("/leads");
  return { ok: true };
}
