"use server";

import { revalidatePath } from "next/cache";
import { requerirVendedor } from "@/lib/sesion";
import type { Vendedor } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { correoConfigurado, enviarGmail } from "@/lib/gmail";
import { archivoOrdenCompraPdf, archivoSolicitudPdf } from "@/lib/pdf/ComprasPdf";
import { leerOrdenDoc, leerSolicitudDoc } from "@/lib/documentosCompra";

// Envio de la solicitud de cotizacion y de la orden de compra a cada proveedor. El correo sale desde la
// casilla de quien esta conectado, con el PDF adjunto; el destinatario es el de la ficha del proveedor y no
// el que mande el navegador. El WhatsApp lo abre el navegador --o el ayudante-- y aqui solo se anota.

type Salida = { ok: true; para: string } | { ok: false; error: string };

async function remitente(): Promise<{ error: string } | { v: Vendedor; de: string }> {
  const v = await requerirVendedor();
  if (!["Administrador", "Supervisor", "Comprador"].includes(v.rol)) return { error: "Solo quien compra puede enviar documentos a proveedores." };
  if (!correoConfigurado()) return { error: "El envio con adjunto aun no esta configurado." };
  const de = v.email?.trim().toLowerCase();
  if (!de) return { error: "Su usuario no tiene correo registrado." };
  if (!/@centropanel\.(cl|pe)$/.test(de)) return { error: "Solo se puede enviar desde un correo @centropanel.cl o @centropanel.pe." };
  return { v, de };
}

async function anotar(idNm: number, tipo: "SC" | "OC", idSc: number | null, idOc: number | null, idPart: number | null, canal: "email" | "whatsapp", destino: string, asunto: string) {
  const supabase = await createClient();
  await supabase.rpc("nm_registrar_envio", { p_nm: idNm, p_tipo: tipo, p_sc: idSc, p_oc: idOc, p_part: idPart, p_canal: canal, p_destino: destino, p_asunto: asunto });
  revalidatePath(`/necesidades/${idNm}`);
}

export async function enviarSolicitudPorCorreo(idNm: number, idSc: number, idPart: number, asunto: string, texto: string): Promise<Salida> {
  const r = await remitente();
  if (!("v" in r)) return { ok: false, error: r.error };
  const doc = await leerSolicitudDoc(idNm, idSc, idPart);
  if (!doc) return { ok: false, error: "No se encontro la solicitud." };
  if (["Adjudicada", "Anulada"].includes(doc.estadoSc)) return { ok: false, error: `La solicitud esta ${doc.estadoSc.toLowerCase()}.` };
  const para = doc.proveedor.email?.trim();
  if (!para) return { ok: false, error: "El proveedor no tiene correo registrado." };
  try {
    const datos = await archivoSolicitudPdf(doc.d, doc.p);
    await enviarGmail({ de: r.de, nombreDe: r.v.nombre, para, asunto, texto, adjunto: { nombre: `${doc.d.folio}.pdf`, datos } });
  } catch (e) {
    return { ok: false, error: `No se pudo enviar: ${(e as Error).message}` };
  }
  await despuesDeEnviarSolicitud(idNm, idSc, idPart, "email", para, asunto, doc.estadoSc);
  return { ok: true, para };
}

// Una solicitud que sale por primera vez pasa a "En cotizacion".
async function despuesDeEnviarSolicitud(idNm: number, idSc: number, idPart: number, canal: "email" | "whatsapp", destino: string, asunto: string, estado: string) {
  const supabase = await createClient();
  if (estado === "Borrador") await supabase.rpc("sc_enviar", { p_sc: idSc });
  await anotar(idNm, "SC", idSc, null, idPart, canal, destino, asunto);
}

// Un envio que salio por fuera del sistema --Outlook o WhatsApp por el ayudante-- queda anotado igual.
export async function registrarEnvioSolicitud(idNm: number, idSc: number, idPart: number, estado: string, canal: "email" | "whatsapp", destino: string, texto: string) {
  await requerirVendedor();
  await despuesDeEnviarSolicitud(idNm, idSc, idPart, canal, destino, texto.slice(0, 200), estado);
}

export async function enviarOcPorCorreo(idOc: number, asunto: string, texto: string): Promise<Salida> {
  const r = await remitente();
  if (!("v" in r)) return { ok: false, error: r.error };
  const doc = await leerOrdenDoc(idOc);
  if (!doc) return { ok: false, error: "No se encontro la orden de compra." };
  if (!doc.d.aprobada) return { ok: false, error: `La orden esta ${doc.d.estado.toLowerCase()}: solo se envia una vez aprobada.` };
  const para = doc.emailProveedor?.trim();
  if (!para) return { ok: false, error: "El proveedor no tiene correo registrado." };
  try {
    const datos = await archivoOrdenCompraPdf(doc.d, doc.p);
    await enviarGmail({ de: r.de, nombreDe: r.v.nombre, para, asunto, texto, adjunto: { nombre: `${doc.d.numero}.pdf`, datos } });
  } catch (e) {
    return { ok: false, error: `No se pudo enviar: ${(e as Error).message}` };
  }
  await despuesDeEnviarOc(idOc, doc.idNecesidad, doc.idSc, doc.idParticipante, "email", para, asunto, doc.d.estado);
  return { ok: true, para };
}

// Una orden aprobada que sale por primera vez queda "Enviada".
async function despuesDeEnviarOc(idOc: number, idNm: number | null, idSc: number | null, idPart: number | null, canal: "email" | "whatsapp", destino: string, asunto: string, estado: string) {
  const supabase = await createClient();
  if (estado === "Aprobada") await supabase.rpc("oc_marcar_enviada", { p_oc: idOc });
  if (idNm) await anotar(idNm, "OC", idSc, idOc, idPart, canal, destino, asunto);
  revalidatePath(`/compras/${idOc}`);
  revalidatePath("/compras");
}

export async function registrarEnvioOc(idOc: number, canal: "email" | "whatsapp", destino: string, texto: string) {
  await requerirVendedor();
  const doc = await leerOrdenDoc(idOc);
  if (!doc) return;
  await despuesDeEnviarOc(idOc, doc.idNecesidad, doc.idSc, doc.idParticipante, canal, destino, texto.slice(0, 200), doc.d.estado);
}

// Vuelve a "Aprobada" una orden enviada, mientras no tenga pagos solicitados. Lo ya enviado no se retira.
export async function reversarEnvioOc(idOc: number): Promise<{ ok: boolean; error?: string }> {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("oc_reversar_envio", { p_oc: idOc });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/compras/${idOc}`);
  revalidatePath("/compras");
  revalidatePath("/necesidades", "layout");
  return { ok: true };
}
