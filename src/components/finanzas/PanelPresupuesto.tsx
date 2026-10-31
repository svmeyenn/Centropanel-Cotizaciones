"use client";

import { useState, useTransition } from "react";
import { guardarPresupuesto } from "@/app/presupuesto/acciones";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const campo = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

interface Centro { id: number; codigo: string; nombre: string }
interface Real {
  codigo: string;
  nombre: string;
  presIngreso: number;
  realIngreso: number;
  presGasto: number;
  realGasto: number;
}

export default function PanelPresupuesto({
  pais,
  paises,
  anio,
  anios,
  hasta,
  centros,
  montos,
  real,
  errorReal,
  puedeEditar,
}: {
  pais: { id: number; nombre: string; moneda: string; codigo: string };
  paises: { codigo: string; nombre: string }[];
  anio: number;
  anios: number[];
  hasta: number;
  centros: Centro[];
  montos: Record<string, number[]>;
  real: Real[];
  errorReal: string | null;
  puedeEditar: boolean;
}) {
  const [tipo, setTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [edit, setEdit] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const valores = (c: Centro): string[] =>
    edit[`${c.id}|${tipo}`] ?? (montos[`${c.id}|${tipo}`] ?? Array(12).fill(0)).map((m) => (m ? String(m) : ""));

  function cambiar(c: Centro, i: number, texto: string) {
    const v = [...valores(c)];
    v[i] = texto;
    setEdit({ ...edit, [`${c.id}|${tipo}`]: v });
  }

  function guardar(c: Centro) {
    setError(null);
    setAviso(null);
    const nums = valores(c).map((t) => Number(t.replace(/\./g, "").replace(",", ".")) || 0);
    empezar(async () => {
      const r = await guardarPresupuesto(c.id, anio, tipo, nums);
      if (r?.error) setError(r.error);
      else {
        setAviso(`Presupuesto de ${tipo === "Gasto" ? "gastos" : "ingresos"} de ${c.codigo} guardado.`);
        const sinEdit = { ...edit };
        delete sinEdit[`${c.id}|${tipo}`];
        setEdit(sinEdit);
      }
    });
  }

  const pct = (real: number, pres: number) => (pres > 0 ? `${Math.round((real / pres) * 100)}%` : "—");
  const filas = real.filter((r) => r.presGasto || r.realGasto || r.presIngreso || r.realIngreso);
  const tot = filas.reduce(
    (s, r) => ({
      pi: s.pi + r.presIngreso,
      ri: s.ri + r.realIngreso,
      pg: s.pg + r.presGasto,
      rg: s.rg + r.realGasto,
    }),
    { pi: 0, ri: 0, pg: 0, rg: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
        El presupuesto se carga por centro de costo, mes a mes, en {pais.moneda}. El real sale del libro diario: los
        gastos son las cuentas de costo y gasto, y los ingresos, las de venta. Contabiliza el mercado para que el real
        esté al día.
      </div>

      <div aria-live="polite">
        {error && <div role="alert" className="sticky top-2 z-10 shadow bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
        {aviso && <div role="status" className="sticky top-2 z-10 shadow bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">{aviso}</div>}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-xs">
        {paises.length > 1 && (
          <label>
            <span className="block text-dorado-osc font-semibold mb-1">Mercado</span>
            <select id="pais" name="pais" defaultValue={pais.codigo} className={campo}>
              {paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
            </select>
          </label>
        )}
        <label>
          <span className="block text-dorado-osc font-semibold mb-1">Año</span>
          <select id="anio" name="anio" defaultValue={anio} className={campo}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          <span className="block text-dorado-osc font-semibold mb-1">Real hasta</span>
          <select id="hasta" name="hasta" defaultValue={hasta} className={campo}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">Ver</button>
      </form>

      <section className="bg-white border border-gray-200 rounded overflow-hidden" aria-label="Real contra presupuesto">
        <div className="px-3 py-2 bg-crema border-b border-gray-200 text-xs text-dorado-osc font-semibold">
          Real contra presupuesto, enero a {MESES[hasta - 1].toLowerCase()} de {anio} · {pais.nombre} ({pais.moneda})
        </div>
        {errorReal ? (
          <div role="alert" className="p-3 text-sm text-red-700">{errorReal}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" rowSpan={2} className="text-left px-3 py-2">Centro de costo</th>
                  <th scope="colgroup" colSpan={4} className="text-center px-3 py-1 border-l border-white/30">Gastos</th>
                  <th scope="colgroup" colSpan={4} className="text-center px-3 py-1 border-l border-white/30">Ingresos</th>
                </tr>
                <tr>
                  {["Presupuesto", "Real", "Diferencia", "Ejecución", "Presupuesto", "Real", "Diferencia", "Ejecución"].map((t, i) => (
                    <th key={i} scope="col" className={`text-right px-3 py-1 ${i % 4 === 0 ? "border-l border-white/30" : ""}`}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-4 text-gray-500">Sin presupuesto ni movimiento en el período. Cárgalo abajo.</td></tr>
                )}
                {filas.map((r) => {
                  const dg = r.presGasto - r.realGasto; // positivo = ahorro
                  const di = r.realIngreso - r.presIngreso; // positivo = sobre meta
                  return (
                    <tr key={r.codigo} className="border-t border-gray-100 hover:bg-crema">
                      <th scope="row" className="text-left px-3 py-1.5 font-semibold">{r.codigo} <span className="font-normal text-gray-500">{r.nombre}</span></th>
                      <td className="px-3 py-1.5 text-right border-l border-gray-100">{num(r.presGasto)}</td>
                      <td className="px-3 py-1.5 text-right">{num(r.realGasto)}</td>
                      <td className={`px-3 py-1.5 text-right ${r.presGasto > 0 && dg < 0 ? "text-red-700 font-semibold" : ""}`}>
                        {r.presGasto > 0 && dg < 0 ? `Excede ${num(-dg)}` : num(dg)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{pct(r.realGasto, r.presGasto)}</td>
                      <td className="px-3 py-1.5 text-right border-l border-gray-100">{num(r.presIngreso)}</td>
                      <td className="px-3 py-1.5 text-right">{num(r.realIngreso)}</td>
                      <td className={`px-3 py-1.5 text-right ${r.presIngreso > 0 && di < 0 ? "text-red-700 font-semibold" : ""}`}>
                        {r.presIngreso > 0 && di < 0 ? `Falta ${num(-di)}` : num(di)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{pct(r.realIngreso, r.presIngreso)}</td>
                    </tr>
                  );
                })}
                {filas.length > 0 && (
                  <tr className="border-t-2 border-verde bg-crema font-semibold">
                    <th scope="row" className="text-left px-3 py-1.5">Total</th>
                    <td className="px-3 py-1.5 text-right border-l border-gray-100">{num(tot.pg)}</td>
                    <td className="px-3 py-1.5 text-right">{num(tot.rg)}</td>
                    <td className="px-3 py-1.5 text-right">{num(tot.pg - tot.rg)}</td>
                    <td className="px-3 py-1.5 text-right">{pct(tot.rg, tot.pg)}</td>
                    <td className="px-3 py-1.5 text-right border-l border-gray-100">{num(tot.pi)}</td>
                    <td className="px-3 py-1.5 text-right">{num(tot.ri)}</td>
                    <td className="px-3 py-1.5 text-right">{num(tot.ri - tot.pi)}</td>
                    <td className="px-3 py-1.5 text-right">{pct(tot.ri, tot.pi)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded overflow-hidden" aria-label="Carga del presupuesto">
        <div className="px-3 py-2 bg-crema border-b border-gray-200 flex flex-wrap items-center gap-3">
          <span className="text-xs text-dorado-osc font-semibold">Presupuesto {anio} por mes</span>
          <div role="group" aria-label="Tipo de presupuesto" className="flex gap-1 text-xs">
            {(["Gasto", "Ingreso"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`px-3 py-1 rounded font-semibold border ${tipo === t ? "bg-verde text-white border-verde" : "bg-white text-verde border-gray-300"}`}
              >
                {t === "Gasto" ? "Gastos" : "Ingresos"}
              </button>
            ))}
          </div>
          {!puedeEditar && <span className="text-xs text-gray-600">Solo lectura con tu perfil.</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2 sticky left-0 bg-verde">Centro</th>
                {MESES.map((m) => <th key={m} scope="col" className="text-right px-2 py-2">{m}</th>)}
                <th scope="col" className="text-right px-3 py-2">Año</th>
                {puedeEditar && <th className="w-20" />}
              </tr>
            </thead>
            <tbody>
              {centros.length === 0 && (
                <tr><td colSpan={15} className="px-3 py-4 text-gray-500">No hay centros de costo activos en {pais.nombre}.</td></tr>
              )}
              {centros.map((c) => {
                const v = valores(c);
                const suma = v.reduce((s, t) => s + (Number(t.replace(/\./g, "").replace(",", ".")) || 0), 0);
                const sucio = edit[`${c.id}|${tipo}`] !== undefined;
                return (
                  <tr key={c.id} className="border-t border-gray-100">
                    <th scope="row" className="text-left px-3 py-1 font-semibold sticky left-0 bg-white whitespace-nowrap">{c.codigo}</th>
                    {v.map((t, i) => (
                      <td key={i} className="px-1 py-1">
                        {puedeEditar ? (
                          <input
                            aria-label={`${tipo === "Gasto" ? "Gasto" : "Ingreso"} de ${c.codigo} en ${MESES[i]}`}
                            inputMode="decimal"
                            className="w-20 border border-gray-300 rounded px-1.5 py-1 text-xs text-right bg-white"
                            value={t}
                            onChange={(e) => cambiar(c, i, e.target.value)}
                          />
                        ) : (
                          <span className="block text-right px-1">{t ? num(Number(t)) : "—"}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-1 text-right font-semibold">{num(suma)}</td>
                    {puedeEditar && (
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => guardar(c)}
                          disabled={pendiente || !sucio}
                          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
                        >
                          guardar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
