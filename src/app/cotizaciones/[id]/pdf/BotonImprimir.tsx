"use client";

// Barra de acciones del documento. Lleva print:hidden para que no salga en el
// papel: es andamiaje de pantalla, no parte de la cotizacion.
export default function BotonImprimir({ idCotizacion }: { idCotizacion?: number }) {
  return (
    <div className="print:hidden bg-crema border-b border-gray-200 px-6 py-3 flex gap-2 items-center">
      <button
        onClick={() => window.history.back()}
        className="border border-verde text-verde text-xs px-2.5 py-1 rounded"
      >
        ← Volver
      </button>
      {idCotizacion != null && (
        <a
          href={`/cotizaciones/${idCotizacion}`}
          className="border border-verde text-verde text-xs px-2.5 py-1 rounded"
        >
          Ver cotizacion
        </a>
      )}
      <button
        onClick={() => window.print()}
        className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded"
      >
        Imprimir / Guardar como PDF
      </button>
      <span className="text-xs text-gray-500">
        En el dialogo de impresion elija &quot;Guardar como PDF&quot;.
      </span>
    </div>
  );
}
