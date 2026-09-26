"use client";

import { Fragment, useState } from "react";
import { pesos } from "@/lib/formato";
import type { FilaResumenProyecto } from "@/lib/finanzas/tipos";

// Un proyecto puede llevarse varias veces con clientes distintos --"Paneles"
// son diez--, asi que las filas se agrupan por nombre y el detalle por cliente
// se abre dentro. Con un solo cliente no hay nada que abrir.
type Grupo = {
  nombre: string;
  filas: FilaResumenProyecto[];
  ingresos: number;
  egresos: number;
  resultado: number;
  pendiente: number;
  movimientos: number;
};

function agrupar(filas: FilaResumenProyecto[]): Grupo[] {
  const mapa = new Map<string, Grupo>();

  for (const f of filas) {
    const g = mapa.get(f.proyecto) ?? {
      nombre: f.proyecto,
      filas: [],
      ingresos: 0,
      egresos: 0,
      resultado: 0,
      pendiente: 0,
      movimientos: 0,
    };
    g.filas.push(f);
    g.ingresos += Number(f.ingresos);
    g.egresos += Number(f.egresos);
    g.resultado += Number(f.resultado);
    g.pendiente += Number(f.pendiente);
    g.movimientos += Number(f.movimientos);
    mapa.set(f.proyecto, g);
  }

  return [...mapa.values()].sort((a, b) => a.resultado - b.resultado);
}

const Monto = ({ v, resalta }: { v: number; resalta?: boolean }) => (
  <td
    className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${
      resalta ? "font-semibold " : ""
    }${resalta && v < 0 ? "text-red-700" : resalta ? "text-verde" : ""}`}
  >
    {pesos(v)}
  </td>
);

export default function TablaResumenProyecto({
  filas,
}: {
  filas: FilaResumenProyecto[];
}) {
  const grupos = agrupar(filas);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  function alternar(nombre: string) {
    setAbiertos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(nombre)) nuevo.delete(nombre);
      else nuevo.add(nombre);
      return nuevo;
    });
  }

  const total = grupos.reduce(
    (t, g) => ({
      ingresos: t.ingresos + g.ingresos,
      egresos: t.egresos + g.egresos,
      resultado: t.resultado + g.resultado,
      pendiente: t.pendiente + g.pendiente,
    }),
    { ingresos: 0, egresos: 0, resultado: 0, pendiente: 0 }
  );

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th className="text-left px-3 py-2">Proyecto</th>
              <th className="text-right px-3 py-2 hidden sm:table-cell w-20">
                Movs.
              </th>
              <th className="text-right px-3 py-2 w-32">Ingresos</th>
              <th className="text-right px-3 py-2 w-32">Egresos</th>
              <th className="text-right px-3 py-2 w-32">Resultado</th>
              <th className="text-right px-3 py-2 hidden md:table-cell w-32">
                Pendiente
              </th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">
                  Sin movimientos en el periodo.
                </td>
              </tr>
            )}

            {grupos.map((g) => {
              const varios = g.filas.length > 1;
              const abierto = abiertos.has(g.nombre);

              return (
                <Fragment key={g.nombre}>
                  <tr className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-2">
                      {varios ? (
                        <button
                          type="button"
                          className="font-semibold text-left"
                          onClick={() => alternar(g.nombre)}
                        >
                          {abierto ? "▾" : "▸"} {g.nombre}
                          <span className="ml-2 font-normal text-gray-500">
                            {g.filas.length} clientes
                          </span>
                        </button>
                      ) : (
                        <>
                          <span className="font-semibold">{g.nombre}</span>
                          {g.filas[0].cliente && (
                            <span className="text-gray-500">
                              {" "}
                              - {g.filas[0].cliente}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell text-gray-600">
                      {g.movimientos}
                    </td>
                    <Monto v={g.ingresos} />
                    <Monto v={g.egresos} />
                    <Monto v={g.resultado} resalta />
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell text-gray-600">
                      {pesos(g.pendiente)}
                    </td>
                  </tr>

                  {varios &&
                    abierto &&
                    g.filas.map((f) => (
                      <tr
                        key={f.id_proyecto}
                        className="border-t border-gray-100 bg-crema/40"
                      >
                        <td className="px-3 py-1.5 pl-8 text-gray-700">
                          {f.cliente ?? "Sin cliente"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums hidden sm:table-cell text-gray-600">
                          {f.movimientos}
                        </td>
                        <Monto v={Number(f.ingresos)} />
                        <Monto v={Number(f.egresos)} />
                        <Monto v={Number(f.resultado)} resalta />
                        <td className="px-3 py-1.5 text-right tabular-nums hidden md:table-cell text-gray-600">
                          {pesos(f.pendiente)}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}

            {grupos.length > 0 && (
              <tr className="border-t-2 border-verde bg-crema font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="hidden sm:table-cell" />
                <Monto v={total.ingresos} />
                <Monto v={total.egresos} />
                <Monto v={total.resultado} resalta />
                <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                  {pesos(total.pendiente)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
