import type { Paridad } from "@/lib/divisas";

// La banda de paridades de la portada. Lo primero que se mira en la mañana, y
// por eso va arriba de todo: si el dolar se movio, se movio el costo de los
// paneles.
//
// Sin datos no se dibuja nada: una banda vacia con "sin informacion" repetido
// cinco veces ocupa el mismo espacio y no dice nada.
export default function BandaDivisas({ paridades }: { paridades: Paridad[] }) {
  if (paridades.length === 0) return null;

  // Las fechas de los datos: el dolar observado del Banco Central sale con un
  // dia de rezago, asi que se dice de cuando es lo que se esta mirando.
  const fechas = [...new Set(paridades.map((p) => p.fecha).filter(Boolean))];

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="flex flex-wrap divide-x divide-gray-100">
        {paridades.map((p) => (
          <div key={p.nombre} className="px-3 py-1.5 flex-1 min-w-[7.5rem]">
            <div className="text-[10px] uppercase tracking-wide text-dorado-osc font-semibold whitespace-nowrap">
              {p.nombre}
            </div>
            <div className="text-sm font-semibold tabular-nums whitespace-nowrap">
              {p.valor}
            </div>
          </div>
        ))}
      </div>

      {fechas.length > 0 && (
        <div className="px-3 pb-1 text-[10px] text-gray-500">
          {fechas.length === 1 ? `Al ${fechas[0]}` : `Datos al ${fechas.join(" y ")}`}
        </div>
      )}
    </div>
  );
}
