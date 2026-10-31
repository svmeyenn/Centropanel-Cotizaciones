"use client";

import { useState, useTransition } from "react";
import { asignarConceptoFlujo } from "@/app/flujo-efectivo/acciones";
import type { MovimientoFlujo } from "@/lib/finanzas/flujo";

interface Concepto {
  codigo: string;
  actividad: string;
  nombre: string;
}

// Los movimientos pagados del periodo con su concepto de flujo. El concepto sale de la
// categoria; aqui se cambia el de un movimiento puntual, p.ej. una maquinaria que se
// registro como herramienta.
export default function TablaConceptosFlujo({
  movimientos,
  conceptos,
}: {
  movimientos: MovimientoFlujo[];
  conceptos: Concepto[];
}) {
  const [abierta, setAbierta] = useState(false);
  const [soloSin, setSoloSin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const efectivo = (m: MovimientoFlujo) => m.concepto_flujo ?? m.concepto_categoria;
  const sin = movimientos.filter((m) => !efectivo(m));
  const lista = soloSin ? sin : movimientos;

  function cambiar(m: MovimientoFlujo, codigo: string) {
    setError(null);
    empezar(async () => {
      const r = await asignarConceptoFlujo(m.id_mov, codigo);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="w-full flex items-center justify-between px-3 py-2 bg-crema text-xs text-dorado-osc font-semibold text-left"
      >
        <span>
          Concepto de flujo de cada movimiento · {sin.length} sin concepto de {movimientos.length}
        </span>
        <span aria-hidden>{abierta ? "−" : "+"}</span>
      </button>
      {abierta && (
        <div className="p-3 space-y-2">
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} />
            Solo los que no tienen concepto
          </label>
          {error && (
            <div role="alert" className="text-xs text-red-700 font-semibold">
              {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-dorado-osc">
                <tr>
                  <th scope="col" className="text-left px-2 py-1">Fecha</th>
                  <th scope="col" className="text-left px-2 py-1">Tipo</th>
                  <th scope="col" className="text-left px-2 py-1">Descripción</th>
                  <th scope="col" className="text-left px-2 py-1">Categoría</th>
                  <th scope="col" className="text-right px-2 py-1">Monto</th>
                  <th scope="col" className="text-left px-2 py-1 w-72">Concepto de flujo</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-gray-500">
                      No hay movimientos que mostrar.
                    </td>
                  </tr>
                )}
                {lista.map((m) => (
                  <tr key={m.id_mov} className="border-t border-gray-100">
                    <td className="px-2 py-1 whitespace-nowrap">{m.fecha}</td>
                    <td className="px-2 py-1">{m.tipo}</td>
                    <td className="px-2 py-1">{m.origen_destino}</td>
                    <td className="px-2 py-1 text-gray-600">{m.categoria}</td>
                    <td className="px-2 py-1 text-right">{m.monto.toLocaleString("es-CL")}</td>
                    <td className="px-2 py-1">
                      <select
                        aria-label={`Concepto de flujo del movimiento ${m.id_mov}`}
                        className="border border-gray-300 rounded px-1 py-0.5 w-full bg-white"
                        value={m.concepto_flujo ?? ""}
                        disabled={pendiente}
                        onChange={(e) => cambiar(m, e.target.value)}
                      >
                        <option value="">
                          {m.concepto_categoria
                            ? `Como su categoría (${m.concepto_categoria})`
                            : "Sin concepto"}
                        </option>
                        {conceptos.map((c) => (
                          <option key={c.codigo} value={c.codigo}>
                            {c.codigo} · {c.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {movimientos.length >= 300 && (
            <p className="text-xs text-gray-500">Se muestran los 300 más recientes del período.</p>
          )}
        </div>
      )}
    </div>
  );
}
