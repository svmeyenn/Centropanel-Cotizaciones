"use client";

// Un error en una pantalla no debe dejar la aplicacion en blanco: se explica y
// se ofrece reintentar o volver al inicio.
export default function ErrorPantalla({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8 max-w-xl mx-auto text-center space-y-3">
      <div className="text-lg font-bold text-verde">Algo salio mal al cargar esta pantalla</div>
      <p className="text-sm text-gray-600">
        Sus datos estan a salvo. Reintente; si el problema sigue, avise indicando que estaba haciendo.
      </p>
      <div className="flex justify-center gap-2">
        <button onClick={reset} className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">
          Reintentar
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded">
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
