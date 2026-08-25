"use client";

// Barra que ve el cliente. No lleva navegacion al sistema: quien abre este
// enlace no tiene cuenta ni nada que hacer dentro. print:hidden para que no
// salga en el papel.
export default function BarraDescarga({ num }: { num: string }) {
  return (
    <div className="print:hidden bg-crema border-b border-gray-200 px-6 py-3 flex flex-wrap gap-3 items-center">
      <span className="text-sm text-gray-700">
        Cotizacion <strong className="text-verde">{num}</strong>
      </span>
      <button
        onClick={() => window.print()}
        className="bg-verde text-white text-sm font-semibold px-4 py-1.5 rounded"
      >
        Descargar PDF
      </button>
      <span className="text-xs text-gray-500">
        En el dialogo elija &quot;Guardar como PDF&quot;.
      </span>
    </div>
  );
}
