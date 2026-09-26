"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "@/lib/formato";
import {
  borrarLinea,
  cuadrarAutomatico,
  desenlazarLinea,
  enlazarLinea,
  importarCartola,
  type Resultado,
} from "@/app/conciliacion/acciones";
import {
  fechaCorta,
  type Cuenta,
  type LineaBanco,
  type Movimiento,
} from "@/lib/finanzas/tipos";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";

const dias = (a: string, b: string) =>
  Math.abs(
    (new Date(a + "T00:00:00Z").getTime() -
      new Date(b + "T00:00:00Z").getTime()) /
      86400000
  );

// Conciliar responde una pregunta simple: cada peso que se movio en el banco,
// tiene un movimiento que lo explique, y al reves? Por eso la pantalla son
// tres listas: lo que esta solo en el banco, lo que esta solo en el sistema, y
// lo que ya calzo.
export default function PanelConciliacion({
  cuentas,
  idCuenta,
  desde,
  hasta,
  lineas,
  movimientos,
  sinLinea,
  puedeConciliar,
}: {
  cuentas: Cuenta[];
  idCuenta: number;
  desde: string;
  hasta: string;
  lineas: LineaBanco[];
  movimientos: Movimiento[];
  sinLinea: Movimiento[];
  puedeConciliar: boolean;
}) {
  const router = useRouter();
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [elegido, setElegido] = useState<Record<number, string>>({});

  const [estadoImportar, importar, importando] = useActionState<
    Resultado | null,
    FormData
  >(importarCartola, null);

  useEffect(() => {
    if (estadoImportar) {
      setAviso({ ok: estadoImportar.ok, texto: estadoImportar.mensaje ?? "" });
      if (estadoImportar.ok) router.refresh();
    }
  }, [estadoImportar, router]);

  function correr(accion: () => Promise<Resultado>) {
    comenzar(async () => {
      const r = await accion();
      setAviso({ ok: r.ok, texto: r.mensaje ?? "" });
      if (r.ok) router.refresh();
    });
  }

  function filtrar(campo: "cuenta" | "desde" | "hasta", valor: string) {
    const p = new URLSearchParams({ cuenta: String(idCuenta), desde, hasta });
    p.set(campo, valor);
    router.push(`/conciliacion?${p.toString()}`);
  }

  const porId = new Map(movimientos.map((m) => [m.id_mov, m]));
  const pendientes = lineas.filter((l) => l.id_mov === null);
  const cuadradas = lineas.filter((l) => l.id_mov !== null);

  const totalBanco = pendientes.reduce(
    (t, l) => t + Number(l.cargo) + Number(l.abono),
    0
  );
  const totalSistema = sinLinea.reduce((t, m) => t + Number(m.monto), 0);

  // Candidatos de una linea: los movimientos sin cuadrar del tipo que
  // corresponde, ordenados por lo cerca que estan en monto y en fecha.
  function candidatos(l: LineaBanco) {
    const tipo = Number(l.cargo) > 0 ? "Egreso" : "Ingreso";
    const monto = Number(l.cargo) + Number(l.abono);
    return sinLinea
      .filter((m) => m.tipo === tipo)
      .map((m) => ({
        mov: m,
        calza: Number(m.monto) === monto,
        distancia: m.fecha ? dias(m.fecha, l.fecha) : 999,
      }))
      .sort(
        (a, b) =>
          Number(b.calza) - Number(a.calza) ||
          a.distancia - b.distancia ||
          Math.abs(Number(a.mov.monto) - monto) -
            Math.abs(Number(b.mov.monto) - monto)
      )
      .slice(0, 25);
  }

  return (
    <>
      {aviso && (
        <p
          className={`text-xs rounded px-3 py-2 border ${
            aviso.ok
              ? "bg-crema border-gray-200 text-gray-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <label className="text-xs">
          <span className={ROTULO}>Cuenta</span>
          <select
            className={CAMPO}
            value={idCuenta}
            onChange={(e) => filtrar("cuenta", e.target.value)}
          >
            {cuentas.map((c) => (
              <option key={c.id_cuenta} value={c.id_cuenta}>
                {c.alias ?? c.banco}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className={ROTULO}>Desde</span>
          <input
            type="date"
            className={CAMPO}
            value={desde}
            onChange={(e) => filtrar("desde", e.target.value)}
          />
        </label>

        <label className="text-xs">
          <span className={ROTULO}>Hasta</span>
          <input
            type="date"
            className={CAMPO}
            value={hasta}
            onChange={(e) => filtrar("hasta", e.target.value)}
          />
        </label>

        {puedeConciliar && (
          <button
            className={BOTON_CLARO}
            disabled={enCurso}
            onClick={() => correr(() => cuadrarAutomatico(idCuenta, desde, hasta))}
          >
            Cuadrar lo evidente
          </button>
        )}
      </div>

      {puedeConciliar && (
        <form
          action={importar}
          className="bg-white border border-gray-200 rounded p-3 grid gap-3 sm:grid-cols-3 items-end"
        >
          <input type="hidden" name="id_cuenta" value={idCuenta} />
          <div className="sm:col-span-2">
            <label className={ROTULO}>Cartola del banco</label>
            <input
              type="file"
              name="archivo"
              className={CAMPO}
              accept=".csv,.txt,.xls,.xlsx"
              required
            />
            <p className="text-[11px] text-gray-600 mt-0.5">
              El archivo tal como lo entrega el banco, en Excel o CSV. Cargar
              dos veces la misma cartola no duplica nada.
            </p>
          </div>
          <button
            type="submit"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
            disabled={importando}
          >
            {importando ? "Cargando..." : "Cargar cartola"}
          </button>
        </form>
      )}

      {/* --- lo que esta solo en el banco --- */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
          En el banco, sin movimiento que lo explique ({pendientes.length}
          {pendientes.length > 0 ? `, ${pesos(totalBanco)}` : ""})
        </h2>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2 w-[10%]">Fecha</th>
                  <th className="text-left px-3 py-2 w-[28%]">Descripcion</th>
                  <th className="text-right px-3 py-2 w-[12%]">Cargo</th>
                  <th className="text-right px-3 py-2 w-[12%]">Abono</th>
                  <th className="text-left px-3 py-2 w-[38%]">
                    Movimiento que lo explica
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendientes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-8">
                      Nada pendiente: todo lo del banco tiene su movimiento.
                    </td>
                  </tr>
                )}

                {pendientes.map((l) => {
                  const opciones = candidatos(l);
                  return (
                    <tr
                      key={l.id_linea}
                      className="border-t border-gray-100 hover:bg-crema"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fechaCorta(l.fecha)}
                      </td>
                      <td className="px-3 py-2 truncate" title={l.descripcion ?? ""}>
                        {l.descripcion}
                        {l.documento && (
                          <span className="block text-[11px] text-gray-500">
                            {l.documento}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(l.cargo) ? pesos(l.cargo) : ""}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(l.abono) ? pesos(l.abono) : ""}
                      </td>
                      <td className="px-3 py-2">
                        {puedeConciliar ? (
                          <div className="flex gap-1.5">
                            <select
                              className={CAMPO}
                              value={elegido[l.id_linea] ?? ""}
                              onChange={(e) =>
                                setElegido((p) => ({
                                  ...p,
                                  [l.id_linea]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Elija el movimiento</option>
                              {opciones.map(({ mov, calza, distancia }) => (
                                <option key={mov.id_mov} value={mov.id_mov}>
                                  {calza ? "= " : ""}
                                  {mov.fecha ? fechaCorta(mov.fecha) : ""}
                                  {" - "}
                                  {pesos(mov.monto)}
                                  {" - "}
                                  {mov.origen_destino ?? ""}
                                  {distancia > 0 && distancia < 900
                                    ? ` (${distancia} d)`
                                    : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              className={BOTON_CLARO}
                              disabled={enCurso || !elegido[l.id_linea]}
                              onClick={() =>
                                correr(() =>
                                  enlazarLinea(
                                    l.id_linea,
                                    Number(elegido[l.id_linea])
                                  )
                                )
                              }
                            >
                              Cuadrar
                            </button>
                            <button
                              className={`${BOTON_CLARO} text-red-700`}
                              disabled={enCurso}
                              title="La linea se cargo por error"
                              onClick={() => correr(() => borrarLinea(l.id_linea))}
                            >
                              Quitar
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">Sin cuadrar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* --- lo que esta solo en el sistema --- */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
          En el sistema, sin respaldo en el banco ({sinLinea.length}
          {sinLinea.length > 0 ? `, ${pesos(totalSistema)}` : ""})
        </h2>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2 w-[12%]">Fecha</th>
                  <th className="text-left px-3 py-2 w-[38%]">Origen / Destino</th>
                  <th className="text-left px-3 py-2 w-[14%]">Tipo</th>
                  <th className="text-right px-3 py-2 w-[18%]">Monto</th>
                  <th className="text-left px-3 py-2 w-[18%]">Documento</th>
                </tr>
              </thead>
              <tbody>
                {sinLinea.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-8">
                      Todo lo registrado aparece en la cartola del banco.
                    </td>
                  </tr>
                )}

                {sinLinea.map((m) => (
                  <tr
                    key={m.id_mov}
                    className="border-t border-gray-100 hover:bg-crema"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {m.fecha ? fechaCorta(m.fecha) : ""}
                    </td>
                    <td className="px-3 py-2 truncate">{m.origen_destino}</td>
                    <td className="px-3 py-2 text-gray-600">{m.tipo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pesos(m.monto)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 truncate">
                      {m.documento}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* --- lo que ya calzo --- */}
      {cuadradas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
            Ya cuadrado ({cuadradas.length})
          </h2>

          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-xs">
                <thead className="bg-verde text-white">
                  <tr>
                    <th className="text-left px-3 py-2 w-[12%]">Fecha</th>
                    <th className="text-left px-3 py-2 w-[30%]">
                      Linea del banco
                    </th>
                    <th className="text-right px-3 py-2 w-[14%]">Monto</th>
                    <th className="text-left px-3 py-2 w-[32%]">Movimiento</th>
                    <th className="px-3 py-2 w-[12%]" />
                  </tr>
                </thead>
                <tbody>
                  {cuadradas.map((l) => {
                    const m = porId.get(l.id_mov!);
                    return (
                      <tr
                        key={l.id_linea}
                        className="border-t border-gray-100 hover:bg-crema"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fechaCorta(l.fecha)}
                        </td>
                        <td className="px-3 py-2 truncate">{l.descripcion}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {pesos(Number(l.cargo) + Number(l.abono))}
                        </td>
                        <td className="px-3 py-2 truncate">
                          {m ? (
                            <>
                              {m.origen_destino}
                              <span className="block text-[11px] text-gray-500">
                                {m.fecha ? fechaCorta(m.fecha) : ""} -{" "}
                                {pesos(m.monto)}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-500">
                              fuera del periodo
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {puedeConciliar && (
                            <button
                              className={BOTON_CLARO}
                              disabled={enCurso}
                              onClick={() =>
                                correr(() => desenlazarLinea(l.id_linea))
                              }
                            >
                              Deshacer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
