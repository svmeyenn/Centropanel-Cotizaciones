"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";

export type Resultado = { ok: boolean; mensaje?: string };

export type Candidato = {
  id: number;
  nombre: string;
  empresa: string | null;
  emails: { email?: string }[] | null;
  telefonos: { phone?: string }[] | null;
  estado: string;
  creado: string | null;
  propietario: string | null;
  conversaciones: number;
  oportunidades: number;
  coincide: string | null;
};

// Fusionar leads duplicados: el lead que se abre se conserva y recibe lo del
// duplicado. Solo quien administra; la base lo comprueba igual.

export async function buscarDuplicados(
  idLead: number,
  texto: string
): Promise<{ ok: true; candidatos: Candidato[] } | { ok: false; mensaje: string }> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return { ok: false, mensaje: "Solo quien administra puede fusionar leads." };
  if (!Number.isFinite(idLead)) return { ok: false, mensaje: "Falta el lead." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_duplicados", { p_lead: idLead, p_q: texto.trim().slice(0, 80) || null });
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, candidatos: (data ?? []) as Candidato[] };
}

export async function fusionarLeads(idDestino: number, idOrigen: number, motivo: string): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return { ok: false, mensaje: "Solo quien administra puede fusionar leads." };
  if (!Number.isFinite(idDestino) || !Number.isFinite(idOrigen)) return { ok: false, mensaje: "Faltan los leads." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_fusionar", {
    p_destino: idDestino,
    p_origen: idOrigen,
    p_motivo: motivo.trim() || null,
  });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/leads/${idDestino}`);
  revalidatePath("/leads");
  revalidatePath("/");
  return { ok: true, mensaje: (data as string) ?? "Leads fusionados." };
}
