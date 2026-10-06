"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { puedeEscribirLeads } from "@/lib/leads";
import { leerCotizacionDoc } from "@/lib/cotizacionDoc";
import { archivoCotizacionPdf } from "@/lib/pdf/CotizacionPdf";
import type { Canal } from "@/lib/mensajes";
import { codigoDeRol, tieneMarca } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import { cambiarEstado } from "@/app/cotizaciones/acciones";

export type Resultado = { ok: boolean; mensaje?: string };

// El mensaje se arma en pantalla y lo manda la persona desde su correo o su
// telefono: el sistema no lo envia. Al generarlo queda anotado en "Conversaciones
// y compromisos" del lead --quien lo mando, a quien y que se adjunto-- junto con
// una tarea de seguimiento para tres dias despues. Si lleva cotizaciones, estas
// pasan a "enviada" y el lead a Oportunidad.
export async function registrarEnvioLead(
  idLead: number,
  canal: Canal,
  plantilla: string,
  destino: string,
  folios: string[],
  idsCotizacion: number[] = [],
  asunto: string = "",
  cuerpo: string = ""
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite escribirle a los leads." };
  if (!Number.isFinite(idLead)) return { ok: false, mensaje: "Falta el lead." };
  if (canal !== "email" && canal !== "whatsapp") return { ok: false, mensaje: "Ese canal no existe." };

  // La base arma el registro --con la hora del pais del lead y la marca de envio--
  // y deja el seguimiento a tres dias, a nombre de quien envia.
  const supabase = await createClient();

  // Las cotizaciones que se mandan pasan a "enviada", salvo las que ya estan
  // cerradas --ganadas o perdidas-- o ya enviadas. Solo las de este lead: la lista
  // sale de la base con la sesion de quien escribe.
  const cat = await catalogoEstados();
  const enviada = codigoDeRol(cat.cotizacion, "enviada");
  let porEnviar: { id: number; num_cotizacion: string | null }[] = [];
  if (idsCotizacion.length > 0) {
    const { data: delLead } = await supabase.rpc("clientify_cotizaciones_de", { p_contacto: idLead });
    const permitidas = new Set(((delLead ?? []) as { id_cotizacion: number }[]).map((c) => Number(c.id_cotizacion)));
    if (idsCotizacion.some((i) => !permitidas.has(i))) return { ok: false, mensaje: "Hay una cotizacion que no es de este lead." };
    const { data: cots } = await supabase.from("cotizaciones").select("id, num_cotizacion, estado").in("id", idsCotizacion);
    porEnviar = ((cots ?? []) as { id: number; num_cotizacion: string | null; estado: string }[]).filter(
      (c) => enviada && c.estado !== enviada && !tieneMarca(cat.cotizacion, c.estado, "cerrada")
    );
  }

  // La base arma el registro --con la hora del pais del lead y la marca de envio--,
  // deja el seguimiento a tres dias y mueve el estado del lead.
  const { data, error } = await supabase.rpc("lead_registrar_envio", {
    p_lead: idLead,
    p_canal: canal,
    p_plantilla: plantilla,
    p_destino: destino,
    p_folios: folios,
    p_extra: porEnviar.length > 0 ? `Cotizacion pasada a Enviada: ${porEnviar.map((c) => c.num_cotizacion ?? c.id).join(", ")}.` : null,
    p_oportunidad: idsCotizacion.length > 0,
    p_asunto: asunto.trim().slice(0, 300) || null,
    p_cuerpo: cuerpo.trim().slice(0, 4500) || null,
  });
  if (error) return { ok: false, mensaje: error.message };

  let aviso = "";
  for (const c of porEnviar) {
    const r = await cambiarEstado(c.id, enviada as string);
    if (r && "error" in r && r.error) aviso += ` No se pudo pasar ${c.num_cotizacion ?? c.id} a Enviada: ${r.error}`;
  }

  revalidatePath(`/leads/${idLead}`);
  revalidatePath("/");
  revalidatePath("/cotizaciones");
  const base = (data as string) ?? "Anotado en el lead, con seguimiento en 3 dias.";
  return { ok: true, mensaje: base + (porEnviar.length > 0 && !aviso ? " La cotizacion quedo como Enviada." : "") + aviso };
}

// Borrar el registro de un correo o WhatsApp --y su seguimiento--. La base solo
// deja borrar los registros de envio.
export async function borrarEnvioLead(id: number, idLead: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite borrar." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_borrar_envio", { p_id: id });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/leads/${idLead}`);
  revalidatePath("/");
  return { ok: true, mensaje: (data as string) ?? "Registro borrado." };
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
