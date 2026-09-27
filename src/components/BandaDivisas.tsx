import type { Paridad } from "@/lib/divisas";

export type BandaPais = {
  codigo: string;
  nombre: string;
  paridades: Paridad[];
};

// La banda de paridades de la portada. Lo primero que se mira en la mañana, y
// por eso va arriba de todo: si el dolar se movio, se movio el costo de los
// paneles.
//
// Quien trabaja los dos mercados ve una banda por pais: el dolar en pesos y el
// dolar en soles son dos numeros distintos y mezclarlos no ayuda a nadie.
export default function BandaDivisas({ bandas }: { bandas: BandaPais[] }) {
  const conDatos = bandas.filter((b) => b.paridades.length > 0);
  if (conDatos.length === 0) return null;

  return (
    <div className="space-y-1">
      {conDatos.map((banda) => (
        <Banda key={banda.codigo} banda={banda} conPais={conDatos.length > 1} />
      ))}
    </div>
  );
}

function Banda({ banda, conPais }: { banda: BandaPais; conPais: boolean }) {
  // El dolar observado del Banco Central sale con un dia de rezago, asi que se
  // dice de cuando es lo que se esta mirando.
  const fechas = [...new Set(banda.paridades.map((p) => p.fecha).filter(Boolean))];

  return (
    <div className="bg-white border border-gray-200 rounded flex items-stretch flex-wrap">
      {conPais && (
        <div className="bg-crema border-r border-gray-200 px-2 flex items-center">
          <span className="text-[10px] font-bold text-verde tracking-wide">
            {banda.codigo}
          </span>
        </div>
      )}

      {banda.paridades.map((p) => (
        <div
          key={p.nombre}
          className="px-3 py-0.5 border-r border-gray-100 last:border-0 flex items-baseline gap-1.5"
        >
          <span className="text-[10px] uppercase tracking-wide text-dorado-osc font-semibold whitespace-nowrap">
            {p.nombre}
          </span>
          <span className="text-xs font-semibold tabular-nums whitespace-nowrap">
            {p.valor}
          </span>
        </div>
      ))}

      {fechas.length > 0 && (
        <div className="px-3 py-0.5 ml-auto flex items-center">
          <span className="text-[10px] text-gray-500 whitespace-nowrap">
            {fechas.length === 1 ? `al ${fechas[0]}` : `al ${fechas.join(" y ")}`}
          </span>
        </div>
      )}
    </div>
  );
}
