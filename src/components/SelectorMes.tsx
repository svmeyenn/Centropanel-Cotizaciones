"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function nombreMesLargo(iso: string) {
  const [a, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} ${a}`;
}

// Mes que mira el tablero. Entra con el actual y queda en la direccion, asi
// que el mes elegido sobrevive a recargar y se puede compartir el enlace.
export default function SelectorMes({
  mes,
  meses,
}: {
  mes: string;
  meses: string[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const lista = meses.includes(mes) ? meses : [mes, ...meses];

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-600">
      <span>Mes</span>
      <select
        value={mes}
        disabled={pendiente}
        onChange={(e) =>
          empezar(() => router.push(`/?mes=${e.target.value}`, { scroll: false }))
        }
        className="border border-gray-300 rounded bg-white px-2 py-0.5 text-xs disabled:opacity-60"
      >
        {lista.map((m) => (
          <option key={m} value={m}>
            {nombreMesLargo(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
