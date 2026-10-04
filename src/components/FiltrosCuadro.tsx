"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { escribirRango, leerRango, type Rango } from "@/lib/ordenTabla";

// Un dato por el que se elige un valor de una lista: la linea, el origen, el
// propietario, el estado, el ejecutivo.
export type CampoSeleccion = {
  param: string;
  texto: string;
  opciones: { valor: string; texto: string }[];
};

// Un dato que se acota entre dos extremos: una fecha, un plazo, un monto.
export type CampoRango = {
  param: string;
  texto: string;
  tipo: "fecha" | "numero";
  nota?: string;
};

// Los filtros de un cuadro de Mi gestion, que es donde se trabaja todos los
// dias y donde filtrar vale la pena. Se pliegan para no robar espacio, pero si
// hay algo puesto se abren solos y se nombra: un filtro escondido que esta
// actuando hace desconfiar de los numeros.
//
// Todo se aplica junto, con un boton: armar una vista son tres o cuatro
// elecciones seguidas, y no tiene sentido ir a la base en cada una.
export default function FiltrosCuadro({
  selecciones = [],
  rangos = [],
  nFiltrado,
  nTotal,
  unidad,
}: {
  selecciones?: CampoSeleccion[];
  rangos?: CampoRango[];
  nFiltrado: number;
  nTotal: number;
  unidad: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const qs = params.toString();
  const [pendiente, empezar] = useTransition();

  const puestoSel: Record<string, string> = Object.fromEntries(
    selecciones.map((c) => [c.param, params.get(c.param) ?? ""])
  );
  const puestoRan: Record<string, Rango> = Object.fromEntries(
    rangos.map((c) => [c.param, leerRango(params.get(c.param) ?? undefined)])
  );
  const activos = [
    ...selecciones.filter((c) => puestoSel[c.param]).map((c) => `${c.texto}: ${etiqueta(c, puestoSel[c.param])}`),
    ...rangos.filter((c) => puestoRan[c.param].desde || puestoRan[c.param].hasta).map((c) => c.texto),
  ];

  const [abierto, setAbierto] = useState(activos.length > 0);
  const [sel, setSel] = useState(puestoSel);
  const [ran, setRan] = useState(puestoRan);

  function aplicar() {
    const s = new URLSearchParams(qs);
    for (const c of selecciones) {
      if (sel[c.param]) s.set(c.param, sel[c.param]);
      else s.delete(c.param);
    }
    for (const c of rangos) {
      const v = escribirRango(ran[c.param]);
      if (v) s.set(c.param, v);
      else s.delete(c.param);
    }
    empezar(() => router.push(`?${s}`, { scroll: false }));
  }

  function limpiar() {
    const s = new URLSearchParams(qs);
    for (const c of [...selecciones, ...rangos]) s.delete(c.param);
    setSel(Object.fromEntries(selecciones.map((c) => [c.param, ""])));
    setRan(Object.fromEntries(rangos.map((c) => [c.param, { desde: "", hasta: "" }])));
    empezar(() => router.push(`?${s}`, { scroll: false }));
  }

  return (
    <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 text-[10px]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierto((x) => !x)}
          aria-expanded={abierto}
          className={`rounded border px-1.5 py-0.5 ${
            activos.length > 0 ? "border-verde text-verde font-semibold" : "border-gray-300 hover:border-verde"
          }`}
        >
          Filtrar {abierto ? "▴" : "▾"}
        </button>
        {activos.length > 0 && (
          <>
            <span className="text-verde font-semibold">
              {nFiltrado.toLocaleString("es-CL")} de {nTotal.toLocaleString("es-CL")} {unidad}
            </span>
            <span className="text-gray-600">por {activos.join(" · ")}</span>
            <button type="button" onClick={limpiar} disabled={pendiente} className="underline text-gray-600">
              Quitar
            </button>
          </>
        )}
      </div>

      {abierto && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pt-2">
          {selecciones.map((c) => (
            <label key={c.param} className="flex flex-col gap-0.5">
              <span className="text-gray-700 font-semibold">{c.texto}</span>
              <select
                value={sel[c.param] ?? ""}
                onChange={(e) => setSel((x) => ({ ...x, [c.param]: e.target.value }))}
                className="border border-gray-300 rounded px-1.5 py-0.5 bg-white max-w-[11rem]"
              >
                <option value="">Todos</option>
                {c.opciones.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.texto}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {rangos.map((c) => (
            <div key={c.param} className="flex flex-col gap-0.5">
              <span className="text-gray-700 font-semibold">{c.texto}</span>
              <span className="flex items-center gap-1">
                <Dato
                  etiqueta={`${c.texto}, desde`}
                  tipo={c.tipo}
                  valor={ran[c.param].desde}
                  cambiar={(v) => setRan((x) => ({ ...x, [c.param]: { ...x[c.param], desde: v } }))}
                />
                <span className="text-gray-400">a</span>
                <Dato
                  etiqueta={`${c.texto}, hasta`}
                  tipo={c.tipo}
                  valor={ran[c.param].hasta}
                  cambiar={(v) => setRan((x) => ({ ...x, [c.param]: { ...x[c.param], hasta: v } }))}
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

const etiqueta = (c: CampoSeleccion, v: string) => c.opciones.find((o) => o.valor === v)?.texto ?? v;

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
