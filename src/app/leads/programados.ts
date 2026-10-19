"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { puedeEscribirLeads } from "@/lib/leads";
import type { Resultado } from "@/app/leads/actividad-lead";

export type DatosProgramado = {
  idLead: number;
  canal: "email" | "whatsapp";
  programadoPara: string;
  destino: string;
  asunto: string;
  cuerpo: string;
  plantilla: string;
  idsCotizacion: number[];
  idsArchivo: number[];
  nombresAdjuntos: string[];
  // El correo ya esta en la bandeja de salida de Outlook; el WhatsApp espera su hora aqui.
  estado: "Programado" | "En bandeja de salida";
};

// Deja anotado un mensaje para mas tarde. Lo ve su autor en la ficha del lead y, si es un
// WhatsApp, en "Mi gestion" cuando llega la hora.
export async function programarMensaje(d: DatosProgramado): Promise<Resultado & { id?: number }> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite escribirle a los leads." };
  if (d.canal !== "email" && d.canal !== "whatsapp") return { ok: false, mensaje: "Ese canal no existe." };
  const cuando = new Date(d.programadoPara);
  if (Number.isNaN(cuando.getTime())) return { ok: false, mensaje: "La fecha no es valida." };
  if (!d.destino.trim() || !d.cuerpo.trim()) return { ok: false, mensaje: "Falta el destinatario o el texto." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mensajes_programados")
    .insert({
      id_clientify: d.idLead,
      canal: d.canal,
      programado_para: cuando.toISOString(),
      destino: d.destino.trim(),
      asunto: d.canal === "email" ? d.asunto.trim() || null : null,
      cuerpo: d.cuerpo,
      plantilla: d.plantilla || null,
      ids_cotizacion: d.idsCotizacion,
      ids_archivo: d.idsArchivo,
      nombres_adjuntos: d.nombresAdjuntos,
      estado: d.estado,
      id_vendedor: v.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/leads/${d.idLead}`);
  revalidatePath("/");
  return { ok: true, id: Number(data.id) };
}

// Pasa un mensaje programado a Enviado o Cancelado.
export async function cerrarProgramado(id: number, idLead: number, estado: "Enviado" | "Cancelado"): Promise<Resultado> {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("mensajes_programados")
    .update({ estado, resuelto_en: new Date().toISOString() })
    .eq("id", id)
    .in("estado", ["Programado", "En bandeja de salida"]);
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath(`/leads/${idLead}`);
  revalidatePath("/");
  return { ok: true };
}
