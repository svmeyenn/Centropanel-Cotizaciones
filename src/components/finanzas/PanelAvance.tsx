"use client";

import { useState, useTransition } from "react";
import { guardarAvance } from "@/app/libro-diario/acciones";

interface Obra {
  id: number;
  nombre: string;
  cliente: string | null;
  contrato: number;
  ultimaFecha: string | null;
  ultimoPct: number | null;
}

const campo = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

export default function PanelAvance({
  pais,
  paises,
  obras,
  hoy,
  puedeEditar,
}: {
  pais: { nombre: string; moneda: string; codigo: string };
  paises: { codigo: string; nombre: string }[];
  obras: Obra[];
  hoy: string;
  puedeEditar: boolean;
}) {
  const [fechas, setFechas] = useState<Record<number, string>>({});
  const [pcts, setPcts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function guardar(o: Obra) {
    setError(null);
    setAviso(null);
    const pct = Number((pcts[o.id] ?? "").replace(",", "."));
    if ((pcts[o.id] ?? "") === "" || Number.isNaN(pct)) {
      setError(`Indique el avance de ${o.nombre}.`);
      return;
    }
    empezar(async () => {
      const r = await guardarAvance(o.id, fechas[o.id] ?? hoy, pct);
      if (r?.error) setError(r.error);
      else setAviso(`Avance de ${o.nombre} guardado. Contabiliza el mercado en el Libro diario para reconocer el ingreso.`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
        El ingreso reconocido es el avance acumulado por el precio del contrato (los pedidos de la obra, sin IVA). Lo que se
        factura de más queda como pasivo del contrato y lo que falta por facturar, como activo. Una obra sin avance
        registrado reconoce su ingreso al facturar.
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
      {aviso && <div role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">{aviso}</div>}

      {paises.length > 1 && (
        <form method="get" className="flex items-end gap-2 text-xs">
          <label>
            <span className="block text-dorado-osc font-semibold mb-1">Mercado</span>
            <select id="pais" name="pais" defaultValue={pais.codigo} className={campo}>
              {paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
            </select>
          </label>
          <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">Ver</button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Obra</th>
                <th scope="col" className="text-right px-3 py-2">Contrato ({pais.moneda})</th>
                <th scope="col" className="text-right px-3 py-2">Último avance</th>
                <th scope="col" className="text-right px-3 py-2">Ingreso reconocido</th>
                {puedeEditar && <th scope="col" className="text-left px-3 py-2 w-72">Nuevo avance</th>}
              </tr>
            </thead>
            <tbody>
              {obras.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-gray-500">No hay obras activas en {pais.nombre}.</td></tr>
              )}
              {obras.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-crema">
                  <th scope="row" className="text-left px-3 py-1.5">
                    <div className="font-semibold">{o.nombre}</div>
                    {o.cliente && <div className="text-gray-500 font-normal">{o.cliente}</div>}
                  </th>
                  <td className="px-3 py-1.5 text-right">{o.contrato ? num(o.contrato) : <span className="text-gray-400">sin pedido</span>}</td>
                  <td className="px-3 py-1.5 text-right">{o.ultimoPct == null ? "—" : `${o.ultimoPct}% · ${o.ultimaFecha}`}</td>
                  <td className="px-3 py-1.5 text-right">{o.ultimoPct == null ? "—" : num((o.contrato * o.ultimoPct) / 100)}</td>
                  {puedeEditar && (
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1.5">
                        <input aria-label={`Fecha del avance de ${o.nombre}`} type="date" className={campo} value={fechas[o.id] ?? hoy} onChange={(e) => setFechas({ ...fechas, [o.id]: e.target.value })} />
                        <input aria-label={`Porcentaje de avance de ${o.nombre}`} inputMode="decimal" placeholder="% acumulado" className={`${campo} w-24 text-right`} value={pcts[o.id] ?? ""} onChange={(e) => setPcts({ ...pcts, [o.id]: e.target.value })} />
                        <button onClick={() => guardar(o)} disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50">guardar</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
