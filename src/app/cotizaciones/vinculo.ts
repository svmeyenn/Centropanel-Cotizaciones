"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { puedeEscribirLeads } from "@/lib/leads";

export type Resultado = { ok: boolean; mensaje?: string };

export type LeadBuscado = {
  id: number;
  nombre: string;
  empresa: string | null;
  emails: { email?: string }[] | null;
  telefonos: { phone?: string }[] | null;
  estado: string;
  propietario: string | null;
};

export type CotizacionBuscada = {
  id: number;
  folio: string | null;
  fecha: string;
  estado: string;
  cliente: string | null;
  vendedor: string | null;
  total: number | null;
  moneda: string | null;
  ya_vinculada: boolean;
  vinculada_a_otro: boolean;
};

// Vincular a mano una cotizacion con un lead, cuando el sistema no lo deduce solo
// --porque ninguna oportunidad de Clientify nombra el folio y el cliente no
// coincide--. Lo vinculado a mano manda sobre lo deducido. Quien puede editar; la
// base comprueba el mercado.

export async function buscarLeadsParaCotizacion(
  idCot: number,
  texto: string
): Promise<{ ok: true; leads: LeadBuscado[] } | { ok: false; mensaje: string }> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite vincular." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_buscar_para_cotizacion", { p_cot: idCot, p_q: texto.trim().slice(0, 80) });
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, leads: (data ?? []) as LeadBuscado[] };
}

export async function buscarCotizacionesParaLead(
  idLead: number,
  texto: string
): Promise<{ ok: true; cotizaciones: CotizacionBuscada[] } | { ok: false; mensaje: string }> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite vincular." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cotizacion_buscar_para_lead", { p_lead: idLead, p_q: texto.trim().slice(0, 80) });
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, cotizaciones: (data ?? []) as CotizacionBuscada[] };
}

function refrescar(idCot: number, idLead: number | null) {
  revalidatePath(`/cotizaciones/${idCot}`);
  if (idLead) revalidatePath(`/leads/${idLead}`);
  revalidatePath("/");
}

export async function vincularCotizacion(idCot: number, idLead: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite vincular." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cotizacion_vincular_lead", { p_cot: idCot, p_lead: idLead });
  if (error) return { ok: false, mensaje: error.message };
  refrescar(idCot, idLead);
  return { ok: true, mensaje: (data as string) ?? "Cotizacion vinculada." };
}

export async function desvincularCotizacion(idCot: number, idLead: number | null): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite desvincular." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cotizacion_desvincular_lead", { p_cot: idCot });
  if (error) return { ok: false, mensaje: error.message };
  refrescar(idCot, idLead);
  return { ok: true, mensaje: (data as string) ?? "Vinculo quitado." };
}
