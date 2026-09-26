"use client";

import { Fragment, useState } from "react";
import { pesos } from "@/lib/formato";
import { fechaCorta, type FilaCartola } from "@/lib/finanzas/tipos";

// El movimiento de todas las cuentas en una sola linea de tiempo, con el saldo
// que va dejando cada uno. Se lee de arriba hacia abajo --lo mas reciente
// primero-- y el saldo de la fila de mas arriba de cada cuenta es el saldo de
// hoy de esa cuenta.
export default function TablaCartola({
  grupos,
  saldos,
  hayFiltro,
}: {
  grupos: { mes: string; filas: FilaCartola[] }[];
  // El saldo con que queda cada cuenta, calculado sobre todo el historial y no
  // sobre lo que muestre el filtro.
  saldos: { cuenta: string; saldo: number }[];
  hayFiltro: boolean;
}) {
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  function alternar(mes: string) {
    setColapsados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(mes)) nuevo.delete(mes);
      else nuevo.add(mes);
      return nuevo;
    });
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {saldos.map((s) => (
          <div
            key={s.cuenta}
            className="bg-white border border-gray-200 rounded px-3 py-2"
          >
            <div className="text-[11px] uppercase tracking-wide text-dorado-osc font-semibold">
              {s.cuenta}
            </div>
            <div
              className={`text-sm font-semibold tabular-nums ${
                s.saldo < 0 ? "text-red-700" : "text-negro"
              }`}
            >
              {pesos(s.saldo)}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2 w-24">Fecha</th>
                <th className="text-left px-3 py-2">Origen / Destino</th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-32">
                  Cuenta
                </th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">
                  Proyecto / Cliente
                </th>
                <th className="text-left px-3 py-2 hidden lg:table-cell w-36">
                  Categoria
                </th>
                <th className="text-right px-3 py-2 w-28">Abono</th>
                <th className="text-right px-3 py-2 w-28">Cargo</th>
                <th className="text-right px-3 py-2 w-32">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">
                    {hayFiltro
                      ? "Ningun movimiento coincide con el filtro."
                      : "Todavia no hay movimientos pagados."}
                  </td>
                </tr>
              )}

              {grupos.map((g) => {
                const abonos = g.filas.reduce((t, f) => t + Number(f.abono), 0);
                const cargos = g.filas.reduce((t, f) => t + Number(f.cargo), 0);
                const colapsado = colapsados.has(g.mes);

                return (
                  <Fragment key={g.mes}>
                    <tr>
                      <td colSpan={8} className="p-0 bg-crema">
                        <button
                          type="button"
                          className="w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-verde"
                          onClick={() => alternar(g.mes)}
                        >
                          <span>
                            {colapsado ? "▸" : "▾"} {g.mes}
                          </span>
                          <span className="flex flex-wrap gap-x-4 normal-case font-normal tabular-nums text-gray-700">
                            <span>Abonos {pesos(abonos)}</span>
                            <span>Cargos {pesos(cargos)}</span>
                            <span
                              className={
                                abonos - cargos < 0
                                  ? "text-red-700"
                                  : "text-negro"
                              }
                            >
                              Diferencia {pesos(abonos - cargos)}
                            </span>
                          </span>
                        </button>
                      </td>
                    </tr>

                    {!colapsado &&
                      g.filas.map((f) => (
                        <tr
                          key={f.id_mov}
                          className="border-t border-gray-100 hover:bg-crema"
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {fechaCorta(f.fecha)}
                          </td>
                          <td className="px-3 py-2">
                            {f.origen_destino}
                            {f.comentario && (
                              <span className="block text-[11px] text-gray-500 truncate max-w-xs">
                                {f.comentario}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell text-gray-600">
                            {f.cuenta}
                          </td>
                          <td className="px-3 py-2 hidden lg:table-cell text-gray-600">
                            {f.proyecto}
                            {f.cliente ? ` - ${f.cliente}` : ""}
                          </td>
                          <td className="px-3 py-2 hidden lg:table-cell text-gray-600">
                            {f.categoria}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-verde">
                            {Number(f.abono) ? pesos(f.abono) : ""}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-700">
                            {Number(f.cargo) ? pesos(f.cargo) : ""}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-semibold ${
                              Number(f.saldo) < 0 ? "text-red-700" : ""
                            }`}
                          >
                            {pesos(f.saldo)}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
