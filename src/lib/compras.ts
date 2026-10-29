import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Donde se guardan las cotizaciones en PDF de los proveedores.
export const BUCKET_COTIZACIONES_PROV = ES_SANDBOX ? "cotizaciones-prov-sandbox" : "cotizaciones-prov";

// Estados de una orden de compra y su color. Aparte de las paginas porque Next
// no deja exportar otra cosa que la pagina desde un archivo de ruta.
export const ESTADOS_OC = [
  "Borrador",
  "Pendiente aprobacion",
  "Aprobada",
  "Enviada",
  "Recibida parcial",
  "Recibida",
  "Facturada",
  "Pagada",
  "Rechazada",
  "Anulada",
];

export const COLOR_ESTADO: Record<string, string> = {
  Borrador: "bg-gray-100 text-gray-700",
  "Pendiente aprobacion": "bg-amber-100 text-amber-800",
  Aprobada: "bg-emerald-100 text-emerald-800",
  Enviada: "bg-sky-100 text-sky-800",
  "Recibida parcial": "bg-sky-100 text-sky-800",
  Recibida: "bg-teal-100 text-teal-800",
  Facturada: "bg-indigo-100 text-indigo-800",
  Pagada: "bg-green-200 text-green-900",
  Rechazada: "bg-red-100 text-red-800",
  Anulada: "bg-gray-200 text-gray-500",
};

// Necesidad de material: lo que se necesita comprar, antes de la orden de compra.
export const ESTADOS_NM = ["Borrador", "En cotizacion", "Adjudicada parcial", "Adjudicada", "Cerrada", "Anulada"];

export const COLOR_NM: Record<string, string> = {
  Borrador: "bg-gray-100 text-gray-700",
  "En cotizacion": "bg-amber-100 text-amber-800",
  "Adjudicada parcial": "bg-sky-100 text-sky-800",
  Adjudicada: "bg-emerald-100 text-emerald-800",
  Cerrada: "bg-green-200 text-green-900",
  Anulada: "bg-gray-200 text-gray-500",
  Abierta: "bg-indigo-100 text-indigo-800",
};

// El nombre con que se identifica un proyecto en un titulo: el cliente cuando el proyecto es un pedido de paneles --su
// nombre es generico: "Paneles" o "Pedido NNN"--, y el nombre de la obra, con su cliente, en los demas.
export function etiquetaProyecto(nombre: string | null | undefined, cliente: string | null | undefined): string {
  const n = (nombre ?? "").trim();
  const c = (cliente ?? "").trim();
  if (!n) return c;
  if (!c) return n;
  if (/^(paneles|pedido\s)/i.test(n)) return c;
  return n.toLowerCase() === c.toLowerCase() ? n : `${n} · ${c}`;
}
