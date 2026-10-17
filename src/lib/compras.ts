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
