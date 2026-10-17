"use client";

import { useState, useTransition } from "react";
import { borrarPartida, guardarPartida } from "@/app/proyectos/acciones";
import { dinero } from "@/lib/formato";

export const CATEGORIAS = ["Materiales", "Mano de obra", "Subcontratos", "Transporte", "Equipos", "Otros"];

export interface FilaPartida {
  id: number;
  codigo: string | null;
  nombre: string;
  categoria: string;
  presupuesto: number;
  comprometido: number;
  por_aprobar: number;
}

const input = "border border-gray-300 rounded px-2 py-1 text-xs w-full";

export default function PresupuestoProyecto({
  idProyecto,
  partidas,
  moneda,
  puedeEditar,
}: {
  idProyecto: number;
  partidas: FilaPartida[];
  moneda: string;
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<number | null>(null);
  const [f, setF] = useState({ codigo: "", nombre: "", categoria: "Materiales", monto: "" });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const tot = partidas.reduce(
    (a, p) => ({
      pres: a.pres + p.presupuesto,
      comp: a.comp + p.comprometido,
      apr: a.apr + p.por_aprobar,
    }),
    { pres: 0, comp: 0, apr: 0 }
  );

  function nueva() {
    setEditando(0);
    setError(null);
    setF({ codigo: "", nombre: "", categoria: "Materiales", monto: "" });
  }
  function editar(p: FilaPartida) {
    setEditando(p.id);
    setError(null);
    setF({ codigo: p.codigo ?? "", nombre: p.nombre, categoria: p.categoria, monto: String(p.presupuesto) });
  }
  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await guardarPartida(idProyecto, editando || null, {
        codigo: f.codigo,
        nombre: f.nombre,
        categoria: f.categoria,
        monto_presupuestado: Number(f.monto.replace(/\./g, "").replace(",", ".")) || 0,
      });
      if (r?.error) setError(r.error);
      else setEditando(null);
    });
  }
  function borrar(p: FilaPartida) {
    if (!confirm(`Borrar la partida "${p.nombre}"?`)) return;
    empezar(async () => {
      const r = await borrarPartida(idProyecto, p.id);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {puedeEditar && (
        <div className="flex justify-end">
          <button onClick={nueva} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
            Nueva partida
          </button>
        </div>
      )}
      {editando !== null && (
        <div className="bg-white border border-gray-200 rounded p-3 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <label className="text-xs">
            <span className="block font-semibold mb-1">Codigo</span>
            <input className={input} value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
          </label>
          <label className="text-xs md:col-span-2">
            <span className="block font-semibold mb-1">Partida *</span>
            <input className={input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
          <label className="text-xs">
            <span className="block font-semibold mb-1">Categoria</span>
            <select className={input} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block font-semibold mb-1">Presupuesto ({moneda})</span>
            <input
              className={input}
              inputMode="decimal"
              value={f.monto}
              onChange={(e) => setF({ ...f, monto: e.target.value })}
            />
          </label>
          <div className="col-span-2 md:col-span-5 flex gap-2">
            <button
              onClick={guardar}
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
            >
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button
              onClick={() => setEditando(null)}
              className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <div className="text-sm text-red-700 font-semibold">{error}</div>}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Codigo</th>
                <th className="text-left px-3 py-2">Partida</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-right px-3 py-2">Presupuesto</th>
                <th className="text-right px-3 py-2">Comprometido</th>
                <th className="text-right px-3 py-2">Por aprobar</th>
                <th className="text-right px-3 py-2">Disponible</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {partidas.map((p) => {
                const disp = p.presupuesto - p.comprometido;
                return (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{p.codigo}</td>
                    <td className="px-3 py-2 font-semibold">{p.nombre}</td>
                    <td className="px-3 py-2">{p.categoria}</td>
                    <td className="px-3 py-2 text-right">{dinero(p.presupuesto, moneda)}</td>
                    <td className="px-3 py-2 text-right">{dinero(p.comprometido, moneda)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {p.por_aprobar ? dinero(p.por_aprobar, moneda) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${disp < 0 ? "text-red-700" : ""}`}>
                      {dinero(disp, moneda)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {puedeEditar && (
                        <>
                          <button onClick={() => editar(p)} className="text-verde hover:underline mr-3">
                            Editar
                          </button>
                          <button onClick={() => borrar(p)} className="text-red-700 hover:underline">
                            Borrar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {partidas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    Sin partidas. Cree las partidas del presupuesto de la obra.
                  </td>
                </tr>
              )}
            </tbody>
            {partidas.length > 0 && (
              <tfoot className="bg-gray-50 font-bold">
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="px-3 py-2">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right">{dinero(tot.pres, moneda)}</td>
                  <td className="px-3 py-2 text-right">{dinero(tot.comp, moneda)}</td>
                  <td className="px-3 py-2 text-right">{tot.apr ? dinero(tot.apr, moneda) : "—"}</td>
                  <td className={`px-3 py-2 text-right ${tot.pres - tot.comp < 0 ? "text-red-700" : ""}`}>
                    {dinero(tot.pres - tot.comp, moneda)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
