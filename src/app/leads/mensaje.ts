"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { hoyISO } from "@/lib/formato";
import { puedeEscribirLeads } from "@/lib/leads";
import { leerCotizacionDoc } from "@/lib/cotizacionDoc";
import { archivoCotizacionPdf } from "@/lib/pdf/CotizacionPdf";
import { sumarDias } from "@/components/inicio/tipos";
import type { Canal } from "@/lib/mensajes";

export type Resultado = { ok: boolean; mensaje?: string };

// Cuantos dias despues se vuelve a hablar con quien recibio el mensaje.
const DIAS_SEGUIMIENTO = 3;

const ZONAS: Record<string, string> = { CL: "America/Santiago", PE: "America/Lima" };

// El mensaje se arma en pantalla y lo manda la persona desde su correo o su
// telefono: el sistema no lo envia. Al generarlo queda anotado en "Conversaciones
// y compromisos" del lead --quien lo mando, a quien y que se adjunto-- junto con
// una tarea de seguimiento para tres dias despues.
export async function registrarEnvioLead(
  idLead: number,
  canal: Canal,
  plantilla: string,
  destino: string,
  folios: string[]
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite escribirle a los leads." };
  if (!Number.isFinite(idLead)) return { ok: false, mensaje: "Falta el lead." };
  if (canal !== "email" && canal !== "whatsapp") return { ok: false, mensaje: "Ese canal no existe." };

  const supabase = await createClient();
  // El lead sale de la base con la sesion de quien escribe: uno de otro mercado
  // no existe para esta persona.
  const { data: lead } = await supabase.from("v_leads").select("id_clientify, id_pais").eq("id_clientify", idLead).maybeSingle();
  if (!lead) return { ok: false, mensaje: "No se encontro el lead." };
  const { data: pais } = await supabase.from("paises").select("codigo").eq("id", lead.id_pais).maybeSingle();
  const zona = ZONAS[(pais?.codigo as string) ?? "CL"] ?? "America/Santiago";

  const hoy = hoyISO(zona);
  const esWa = canal === "whatsapp";
  const adjunto = folios.length > 0 ? ` PDF adjunto: ${folios.join(", ")}.` : " Sin cotizacion adjunta.";
  const comentario =
    `${esWa ? "WhatsApp" : "Correo"} enviado por ${v.nombre} ${esWa ? "desde su telefono" : "desde su correo"} ` +
    `a ${destino}. Mensaje: "${plantilla}".${adjunto}`;

  const { error } = await supabase.from("lead_actividad").insert({
    id_clientify: idLead,
    id_vendedor: v.id,
    fecha_hecho: hoy,
    comentario: comentario.slice(0, 1000),
    proxima_accion: `Dar seguimiento al ${esWa ? "WhatsApp" : "correo"} enviado`,
    proxima_fecha: sumarDias(hoy, DIAS_SEGUIMIENTO),
    id_responsable: v.id,
  });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/leads/${idLead}`);
  revalidatePath("/");
  return { ok: true, mensaje: `Anotado en el lead, con seguimiento en ${DIAS_SEGUIMIENTO} dias.` };
}

// Cabecera con tildes o enes: codificada segun RFC 2047.
function encabezado(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`;
}

// Base64 en lineas de 76 caracteres, como exige MIME.
const enLineas = (b: Buffer) => b.toString("base64").replace(/.{76}/g, "$&\r\n");

// Un borrador de correo --archivo .eml-- con el texto y los PDF ya adjuntos. Al
// abrirlo, Outlook de escritorio lo muestra como mensaje nuevo, sin enviar, para
// revisarlo. La cabecera X-Unsent lo marca como borrador.
export async function armarBorradorOutlook(
  idLead: number,
  para: string,
  asunto: string,
  cuerpo: string,
  idsCotizacion: number[]
): Promise<{ ok: true; nombre: string; base64: string } | { ok: false; mensaje: string }> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite escribirle a los leads." };
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(para)) return { ok: false, mensaje: "El correo del contacto no es valido." };

  const supabase = await createClient();
  // Solo se adjuntan cotizaciones de este lead: la lista sale de la base.
  const { data: cots } = await supabase.rpc("clientify_cotizaciones_de", { p_contacto: idLead });
  const permitidas = new Set(((cots ?? []) as { id_cotizacion: number }[]).map((c) => Number(c.id_cotizacion)));
  if (idsCotizacion.some((i) => !permitidas.has(i))) return { ok: false, mensaje: "Hay una cotizacion que no es de este lead." };

  const adjuntos: { nombre: string; datos: Buffer }[] = [];
  for (const id of idsCotizacion) {
    const doc = await leerCotizacionDoc(id);
    if (!doc) return { ok: false, mensaje: "No se pudo leer una de las cotizaciones." };
    try {
      adjuntos.push({ nombre: `${doc.d.num_cotizacion ?? `Cotizacion-${id}`}.pdf`, datos: await archivoCotizacionPdf(doc.d, doc.p) });
    } catch (e) {
      return { ok: false, mensaje: `No se pudo generar el PDF: ${(e as Error).message}` };
    }
  }

  const limite = `cp-${Date.now().toString(36)}`;
  const partes = [
    `To: ${para}`,
    `Subject: ${encabezado(asunto.replace(/[\r\n]+/g, " "))}`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    "",
    `--${limite}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    enLineas(Buffer.from(cuerpo.replace(/\r?\n/g, "\r\n"), "utf-8")),
    "",
  ];
  for (const a of adjuntos) {
    partes.push(
      `--${limite}`,
      `Content-Type: application/pdf; name="${a.nombre}"`,
      `Content-Disposition: attachment; filename="${a.nombre}"`,
      "Content-Transfer-Encoding: base64",
      "",
      enLineas(a.datos),
      ""
    );
  }
  partes.push(`--${limite}--`, "");

  return { ok: true, nombre: `Borrador para ${para.split("@")[0]}.eml`, base64: Buffer.from(partes.join("\r\n"), "utf-8").toString("base64") };
}
