"use server";

import { revalidatePath } from "next/cache";
import { requerirVendedor } from "@/lib/sesion";
import { leerCotizacionDoc } from "@/lib/cotizacionDoc";
import { correoConfigurado, enviarGmail } from "@/lib/gmail";
import { archivoCotizacionPdf } from "@/lib/pdf/CotizacionPdf";
import { createClient } from "@/lib/supabase/server";

// Envia la cotizacion con el PDF adjunto desde la casilla de quien esta
// conectado. El destinatario sale de la ficha del cliente y no del navegador:
// asi el boton no sirve para mandar correos a cualquier direccion.
export async function enviarCotizacionPorCorreo(
  id: number,
  asunto: string,
  texto: string
): Promise<{ ok: true; para: string } | { error: string }> {
  const v = await requerirVendedor();

  if (!correoConfigurado()) {
    return { error: "El envio con adjunto aun no esta configurado. Use el enlace mientras tanto." };
  }
  const de = v.email?.trim().toLowerCase();
  if (!de) return { error: "Su usuario no tiene correo registrado." };
  if (!/@centropanel\.(cl|pe)$/.test(de)) {
    return { error: "Solo se puede enviar desde un correo @centropanel.cl o @centropanel.pe." };
  }

  const doc = await leerCotizacionDoc(id);
  if (!doc) return { error: "No se encontro la cotizacion." };
  if (!doc.emailCliente) return { error: "El cliente no tiene correo registrado." };

  try {
    const datos = await archivoCotizacionPdf(doc.d, doc.p);
    await enviarGmail({
      de,
      nombreDe: v.nombre,
      para: doc.emailCliente,
      asunto,
      texto,
      adjunto: { nombre: `${doc.d.num_cotizacion ?? "Cotizacion"}.pdf`, datos },
    });
  } catch (e) {
    return { error: `No se pudo enviar: ${(e as Error).message}` };
  }

  // Queda en el historial del lead de la cotizacion --o en su bitacora--, con el mensaje.
  await registrarEnvioCotizacion(id, "email", doc.emailCliente, asunto, texto);

  return { ok: true, para: doc.emailCliente };
}

// Anota un correo o WhatsApp enviado desde la pantalla de una cotizacion: en el historial del lead al que
// pertenece o, si no tiene lead, en la bitacora de la cotizacion. Un fallo aqui no deshace el envio.
export async function registrarEnvioCotizacion(
  id: number,
  canal: "email" | "whatsapp",
  destino: string,
  asunto: string,
  texto: string
): Promise<{ ok: boolean; mensaje?: string }> {
  await requerirVendedor();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cotizacion_registrar_envio", {
    p_cot: id,
    p_canal: canal,
    p_destino: destino,
    p_asunto: asunto.trim().slice(0, 300) || null,
    p_cuerpo: texto.trim().slice(0, 4500) || null,
  });
  if (error) return { ok: false, mensaje: error.message };
  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath("/");
  return { ok: true, mensaje: (data as string) ?? "Anotado." };
}
