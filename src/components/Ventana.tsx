"use client";

import { useEffect } from "react";

// Ventana emergente para ver o modificar una ficha --cliente, proveedor,
// materia prima o producto-- sin perder de vista el listado que hay detras.
// Antes el formulario se abria empujando la tabla hacia abajo y habia que
// buscar donde habia quedado la fila.
export default function Ventana({
  titulo,
  subtitulo,
  onCerrar,
  children,
  ancho = "max-w-3xl",
}: {
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: string;
}) {
  // Escape cierra: es lo que espera cualquiera que abra una ventana.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onCerrar}
    >
      <div
        className={`bg-white rounded shadow-lg w-full ${ancho} my-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-verde text-white px-4 py-3 flex items-start justify-between gap-3 rounded-t">
          <div>
            <div className="text-sm font-semibold">{titulo}</div>
            {subtitulo && (
              <div className="text-[11px] text-white/80">{subtitulo}</div>
            )}
          </div>
          <button
            onClick={onCerrar}
            className="text-white/80 hover:text-white text-lg leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
