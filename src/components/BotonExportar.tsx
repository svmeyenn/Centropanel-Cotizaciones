"use client";

// Descarga lo que se esta viendo (ya filtrado) a una planilla que Excel abre
// directo. Es CSV con BOM y punto y coma, que es lo que Excel en español
// espera; un .xlsx de verdad obligaria a sumar una libreria para lo mismo.
export type Columna<T> = {
  titulo: string;
  valor: (f: T) => string | number | null | undefined;
};

function celda(v: string | number | null | undefined) {
  if (v == null) return "";
  const t = String(v);
  // Excel corta la celda en el separador y en el salto de linea si no va
  // entre comillas; las comillas propias se duplican.
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function descargarPlanilla<T>(
  nombre: string,
  columnas: Columna<T>[],
  filas: T[]
) {
  const lineas = [
    columnas.map((c) => celda(c.titulo)).join(";"),
    ...filas.map((f) => columnas.map((c) => celda(c.valor(f))).join(";")),
  ];
  const blob = new Blob(["﻿" + lineas.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const hoy = new Date().toISOString().slice(0, 10);
  a.download = `${nombre}-${hoy}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BotonExportar<T>({
  nombre,
  columnas,
  filas,
  className = "",
}: {
  // Nombre del archivo, sin fecha ni extension.
  nombre: string;
  columnas: Columna<T>[];
  filas: T[];
  className?: string;
}) {
  return (
    <button
      onClick={() => descargarPlanilla(nombre, columnas, filas)}
      disabled={filas.length === 0}
      className={`border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white whitespace-nowrap disabled:opacity-40 ${className}`}
      title="Descargar lo que se esta viendo a una planilla Excel"
    >
      Excel ({filas.length})
    </button>
  );
}
