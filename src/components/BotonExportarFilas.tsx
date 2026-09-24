"use client";

import { descargarPlanilla } from "@/components/BotonExportar";

// Version para las pantallas que arman la tabla en el servidor: recibe los
// titulos y las filas ya listas, porque de servidor a cliente no se pueden
// mandar funciones.
export default function BotonExportarFilas({
  nombre,
  titulos,
  filas,
  className = "",
}: {
  nombre: string;
  titulos: string[];
  filas: (string | number | null)[][];
  className?: string;
}) {
  return (
    <button
      onClick={() =>
        descargarPlanilla(
          nombre,
          titulos.map((t, i) => ({
            titulo: t,
            valor: (f: (string | number | null)[]) => f[i],
          })),
          filas
        )
      }
      disabled={filas.length === 0}
      className={`border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white whitespace-nowrap disabled:opacity-40 ${className}`}
      title="Descargar lo que se esta viendo a una planilla Excel"
    >
      Excel ({filas.length})
    </button>
  );
}
