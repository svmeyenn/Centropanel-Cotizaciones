"use server";

import { requerirVendedor } from "@/lib/sesion";
import { leerCotizacionDoc } from "@/lib/cotizacionDoc";
import { correoConfigurado, enviarGmail } from "@/lib/gmail";
import { archivoCotizacionPdf } from "@/lib/pdf/CotizacionPdf";

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

  return { ok: true, para: doc.emailCliente };
}
