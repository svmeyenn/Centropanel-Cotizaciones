import type { EstadoRendicion } from "@/lib/finanzas/tipos";

// El estado se lee de un vistazo por su color: lo que espera algo de alguien
// va en dorado, lo cerrado en verde y lo devuelto en rojo.
const TONOS: Record<EstadoRendicion, string> = {
  Borrador: "bg-gray-100 text-gray-700 border-gray-300",
  Enviada: "bg-dorado/20 text-dorado-osc border-dorado",
  Aprobada: "bg-verde/15 text-verde border-verde",
  Pagada: "bg-verde text-white border-verde",
  Incompleta: "bg-dorado/20 text-dorado-osc border-dorado",
  Rechazada: "bg-red-50 text-red-700 border-red-300",
};

export default function ChipEstado({ estado }: { estado: EstadoRendicion }) {
  return (
    <span
      className={`inline-block border rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONOS[estado]}`}
    >
      {estado}
    </span>
  );
}
