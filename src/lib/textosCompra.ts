import { fecha as fmtFecha } from "@/lib/formato";

// Los textos de los mensajes al proveedor, armados con los datos del documento. Quien envia puede editarlos
// antes de mandarlos.

interface Firma {
  nombre: string;
  cargo?: string | null;
  email?: string | null;
  telefono?: string | null;
}

function firma(f: Firma): string {
  return [f.nombre, f.cargo, [f.email, f.telefono].filter(Boolean).join(" | ")].filter(Boolean).join("\n");
}

interface Recibe {
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
}

function recibe(r?: Recibe): string {
  const datos = [r?.telefono, r?.email].filter(Boolean).join(" | ");
  return r?.nombre ? `${r.nombre}${datos ? ` (${datos})` : ""}` : "";
}

export type Modalidad = "Despacho" | "Retiro";

interface Entrega {
  fechaEntrega: string | null;
  direccion: string | null;
  // Todo pedido de materia prima se despacha a la bodega de Centro Panel o se retira en el proveedor.
  modalidad?: Modalidad;
  // Para el retiro: donde esta el proveedor.
  direccionProveedor?: string | null;
}

// "despacho a nuestra bodega (El Roble 165...), el 15-11-2026" o "retiro por nuestra parte en sus instalaciones (...)".
function destino(e: Entrega): string {
  const cuando = e.fechaEntrega ? `el ${fmtFecha(e.fechaEntrega)}` : "en la fecha a coordinar";
  if (e.modalidad === "Retiro") {
    return `retiro por nuestra parte en sus instalaciones${e.direccionProveedor ? ` (${e.direccionProveedor})` : ""}, ${cuando}`;
  }
  return `despacho a nuestra bodega${e.direccion ? ` (${e.direccion})` : ""}, ${cuando}`;
}

function alternativaDespacho(e: Entrega, accion: string): string {
  return e.modalidad === "Retiro" ? "" : ` Si no puede despachar a esa direccion, ${accion} y coordinamos el retiro en sus instalaciones.`;
}

export function textosSolicitud(d: { folio: string; contacto: string | null; proveedor: string; recibe?: Recibe; emisor: Firma } & Entrega) {
  const dest = destino(d);
  const saludo = `Estimados ${d.contacto || d.proveedor}:`;
  return {
    asunto: `Solicitud de cotizacion ${d.folio} - Centro Panel`,
    cuerpo: `${saludo}\n\nLes solicitamos cotizar los materiales del documento adjunto (${d.folio}). Entrega: ${dest}.${recibe(d.recibe) ? ` Recibe: ${recibe(d.recibe)}.` : ""}${alternativaDespacho(d, "indiquelo en su respuesta")}\n\nLos precios del documento son los que tenemos registrados para su empresa: confirmenlos o indiquennos el precio vigente de cada item, junto con el plazo de entrega, las condiciones de pago y la validez de la oferta.\n\nQuedamos atentos a su respuesta.\n\nSaludos cordiales,\n${firma(d.emisor)}`,
    whatsapp: `Hola ${d.contacto || d.proveedor}, le enviamos la solicitud de cotizacion ${d.folio} de Centro Panel (PDF adjunto). Entrega: ${dest}. Quedamos atentos a su cotizacion. ${d.emisor.nombre}`,
  };
}

export function textosOrden(d: { numero: string; contacto: string | null; proveedor: string; recibe?: Recibe; emisor: Firma } & Entrega) {
  const dest = destino(d);
  const saludo = `Estimados ${d.contacto || d.proveedor}:`;
  return {
    asunto: `Orden de compra ${d.numero} - Centro Panel`,
    cuerpo: `${saludo}\n\nAdjuntamos la orden de compra ${d.numero}. Entrega: ${dest}.${recibe(d.recibe) ? ` Recibe: ${recibe(d.recibe)}.` : ""}${alternativaDespacho(d, "avisenos")}\n\nLes pedimos confirmar la recepcion de la orden y la fecha de entrega, e indicar el numero de la orden en su factura.\n\nSaludos cordiales,\n${firma(d.emisor)}`,
    whatsapp: `Hola ${d.contacto || d.proveedor}, le enviamos la orden de compra ${d.numero} de Centro Panel (PDF adjunto). Entrega: ${dest}. Favor confirmar recepcion y fecha de entrega. ${d.emisor.nombre}`,
  };
}
