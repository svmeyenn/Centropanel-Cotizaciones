"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

export type Resultado = { ok: boolean; mensaje?: string };

// Dejar en espera del cliente: el cliente pidio que no lo molesten y se espera
// su respuesta. El lead o la cotizacion sale de los listados de pendientes y
// queda en su propio cuadro del inicio. La base decide quien puede y comprueba
// el mercado; esto solo da el mensaje.

function refrescar(idLead: number | null, idCot: number | null) {
  revalidatePath("/");
  revalidatePath("/leads");
  if (idLead) revalidatePath(`/leads/${idLead}`);
  if (idCot) revalidatePath(`/cotizaciones/${idCot}`);
}

export async function ponerEnEspera(idLead: number | null, idCot: number | null, motivo: string): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar) return { ok: false, mensaje: "Su perfil no permite dejar en espera." };
  if ((idLead == null) === (idCot == null)) return { ok: false, mensaje: "Falta indicar el lead o la cotizacion." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("espera_poner", {
    p_lead: idLead,
    p_cot: idCot,
    p_motivo: motivo.trim() || null,
  });
  if (error) return { ok: false, mensaje: error.message };
  refrescar(idLead, idCot);
  return { ok: true, mensaje: (data as string) ?? "Quedo en espera del cliente." };
}

export async function retomarEspera(id: number, idLead: number | null, idCot: number | null): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar) return { ok: false, mensaje: "Su perfil no permite retomar." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("espera_retomar", { p_id: id });
  if (error) return { ok: false, mensaje: error.message };
  refrescar(idLead, idCot);
  return { ok: true, mensaje: (data as string) ?? "Retomado." };
}
