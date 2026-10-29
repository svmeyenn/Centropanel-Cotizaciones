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

function destino(fechaEntrega: string | null, direccion: string | null): string {
  const cuando = fechaEntrega ? `el ${fmtFecha(fechaEntrega)}` : "en la fecha a coordinar";
  return direccion ? `${cuando} en ${direccion}` : cuando;
}

export function textosSolicitud(d: { folio: string; contacto: string | null; proveedor: string; fechaEntrega: string | null; direccion: string | null; recibe?: Recibe; emisor: Firma }) {
  const dest = destino(d.fechaEntrega, d.direccion);
  const saludo = `Estimados ${d.contacto || d.proveedor}:`;
  return {
    asunto: `Solicitud de cotizacion ${d.folio} - Centro Panel`,
    cuerpo: `${saludo}\n\nLes solicitamos cotizar los materiales del documento adjunto (${d.folio}), para entrega ${dest}.${recibe(d.recibe) ? ` Recibe en destino: ${recibe(d.recibe)}.` : ""}\n\nLos precios del documento son los que tenemos registrados para su empresa: confirmenlos o indiquennos el precio vigente de cada item, junto con el plazo de entrega, las condiciones de pago y la validez de la oferta.\n\nQuedamos atentos a su respuesta.\n\nSaludos cordiales,\n${firma(d.emisor)}`,
    whatsapp: `Hola ${d.contacto || d.proveedor}, le enviamos la solicitud de cotizacion ${d.folio} de Centro Panel (PDF adjunto). Entrega ${dest}. Quedamos atentos a su cotizacion. ${d.emisor.nombre}`,
  };
}

export function textosOrden(d: { numero: string; contacto: string | null; proveedor: string; fechaEntrega: string | null; direccion: string | null; recibe?: Recibe; emisor: Firma }) {
  const dest = destino(d.fechaEntrega, d.direccion);
  const saludo = `Estimados ${d.contacto || d.proveedor}:`;
  return {
    asunto: `Orden de compra ${d.numero} - Centro Panel`,
    cuerpo: `${saludo}\n\nAdjuntamos la orden de compra ${d.numero}, con entrega ${dest}.${recibe(d.recibe) ? ` Recibe en destino: ${recibe(d.recibe)}.` : ""}\n\nLes pedimos confirmar la recepcion de la orden y la fecha de entrega, e indicar el numero de la orden en su factura.\n\nSaludos cordiales,\n${firma(d.emisor)}`,
    whatsapp: `Hola ${d.contacto || d.proveedor}, le enviamos la orden de compra ${d.numero} de Centro Panel (PDF adjunto). Entrega ${dest}. Favor confirmar recepcion y fecha de entrega. ${d.emisor.nombre}`,
  };
}
