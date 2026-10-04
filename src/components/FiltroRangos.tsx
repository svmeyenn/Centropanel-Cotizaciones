"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { escribirRango, leerRango, type Rango } from "@/lib/ordenTabla";

export type CampoRango = {
  // El parametro en la direccion web, por ejemplo "rg_cot_total".
  param: string;
  texto: string;
  tipo: "fecha" | "numero";
  // Aclaracion bajo el titulo, cuando el rango no se entiende solo.
  nota?: string;
};

// Filtros de rango de un cuadro: un "desde" y un "hasta" por dato. Se pliega
// para no robar espacio, y se despliega solo cuando ya hay un filtro puesto,
// porque un filtro escondido que esta actuando confunde los numeros.
//
// Lo que se filtra viaja a la base junto con el orden: la lista muestra quince
// filas de miles, asi que el recorte tiene que hacerse alla y no aqui.
export default function FiltroRangos({
  campos,
  nFiltrado,
  nTotal,
  unidad,
}: {
  campos: CampoRango[];
  // Para decir en una linea cuanto deja ver el filtro.
  nFiltrado: number;
  nTotal: number;
  unidad: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const qs = params.toString();
  const [pendiente, empezar] = useTransition();

  const puestos: Record<string, Rango> = Object.fromEntries(
    campos.map((c) => [c.param, leerRango(params.get(c.param) ?? undefined)])
  );
  const activos = campos.filter((c) => puestos[c.param].desde || puestos[c.param].hasta);
  const [abierto, setAbierto] = useState(activos.length > 0);
  const [valores, setValores] = useState<Record<string, Rango>>(puestos);

  function aplicar() {
    const s = new URLSearchParams(qs);
    for (const c of campos) {
      const v = escribirRango(valores[c.param]);
      if (v) s.set(c.param, v);
      else s.delete(c.param);
    }
    empezar(() => router.push(`?${s}`, { scroll: false }));
  }

  function limpiar() {
    const s = new URLSearchParams(qs);
    for (const c of campos) s.delete(c.param);
    setValores(Object.fromEntries(campos.map((c) => [c.param, { desde: "", hasta: "" }])));
    empezar(() => router.push(`?${s}`, { scroll: false }));
  }

  return (
    <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 text-[10px]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierto((x) => !x)}
          aria-expanded={abierto}
          className="rounded border border-gray-300 px-1.5 py-0.5 hover:border-verde"
        >
          Filtrar por rango {abierto ? "▴" : "▾"}
        </button>
        {activos.length > 0 && (
          <>
            <span className="text-verde font-semibold">
              {nFiltrado.toLocaleString("es-CL")} de {nTotal.toLocaleString("es-CL")} {unidad}
            </span>
            <button type="button" onClick={limpiar} disabled={pendiente} className="underline text-gray-600">
              Quitar el filtro
            </button>
          </>
        )}
      </div>

      {abierto && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pt-2">
          {campos.map((c) => (
            <div key={c.param} className="flex flex-col gap-0.5">
              <span className="text-gray-700 font-semibold">{c.texto}</span>
              <span className="flex items-center gap-1">
                <Dato
                  etiqueta={`${c.texto}, desde`}
                  tipo={c.tipo}
                  valor={valores[c.param].desde}
                  cambiar={(v) => setValores((x) => ({ ...x, [c.param]: { ...x[c.param], desde: v } }))}
                />
                <span className="text-gray-400">a</span>
                <Dato
                  etiqueta={`${c.texto}, hasta`}
                  tipo={c.tipo}
                  valor={valores[c.param].hasta}
                  cambiar={(v) => setValores((x) => ({ ...x, [c.param]: { ...x[c.param], hasta: v } }))}
                />
              </span>
              {c.nota && <span className="text-gray-500">{c.nota}</span>}
            </div>
          ))}
          <button
            type="button"
            onClick={aplicar}
            disabled={pendiente}
            className="bg-verde text-white font-semibold rounded px-2.5 py-1 disabled:opacity-50"
          >
            {pendiente ? "Filtrando..." : "Aplicar"}
          </button>
        </div>
      )}
    </div>
  );
}

function Dato({
  etiqueta,
  tipo,
  valor,
  cambiar,
}: {
  etiqueta: string;
  tipo: "fecha" | "numero";
  valor: string;
  cambiar: (v: string) => void;
}) {
  return (
    <input
      type={tipo === "fecha" ? "date" : "number"}
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => cambiar(e.target.value)}
      className={`border border-gray-300 rounded px-1.5 py-0.5 bg-white ${
        tipo === "fecha" ? "w-[8.5rem]" : "w-24 text-right tabular-nums"
      }`}
    />
  );
}
