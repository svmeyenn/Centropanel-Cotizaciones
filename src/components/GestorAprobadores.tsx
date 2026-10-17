"use client";

import { useState, useTransition } from "react";
import { guardarAprobador, quitarAprobador } from "@/app/compras/acciones";
import { dinero } from "@/lib/formato";

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

export default function GestorAprobadores({
  idPais,
  moneda,
  aprobadores,
  vendedores,
}: {
  idPais: number;
  moneda: string;
  aprobadores: { id: number; id_vendedor: number; nombre: string; monto_desde: number }[];
  vendedores: { id: number; nombre: string }[];
}) {
  const [vend, setVend] = useState("");
  const [monto, setMonto] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function agregar() {
    setError(null);
    if (!vend) return setError("Elija a la persona.");
    empezar(async () => {
      const r = await guardarAprobador({
        id_pais: idPais,
        id_vendedor: Number(vend),
        monto_desde: Number(monto.replace(/\./g, "").replace(",", ".")) || 0,
      });
      if (r?.error) setError(r.error);
      else setVend("");
    });
  }
  function quitar(a: { id: number; nombre: string }) {
    if (aprobadores.length === 1 && !confirm("Es el unico aprobador: sin el, ninguna orden podra aprobarse. Quitarlo?")) return;
    if (!confirm(`Quitar a ${a.nombre}?`)) return;
    empezar(async () => {
      const r = await quitarAprobador(a.id);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-sm text-gray-600">
        Nada sale sin aprobacion: cada orden la aprueba alguien de esta lista cuyo monto de partida sea igual o menor al
        total de la orden. Quien crea una orden no puede aprobarla a menos que figure aqui.
      </div>
      {error && <div className="text-sm text-red-700 font-semibold">{error}</div>}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th className="text-left px-3 py-2">Aprobador</th>
              <th className="text-right px-3 py-2">Aprueba desde</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {aprobadores.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{a.nombre}</td>
                <td className="px-3 py-2 text-right">{a.monto_desde ? dinero(a.monto_desde, moneda) : "Cualquier monto"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => quitar(a)} disabled={pendiente} className="text-red-700 hover:underline">
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {aprobadores.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-red-700">
                  Sin aprobadores: ninguna orden puede aprobarse.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-white border border-gray-200 rounded p-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <label className="text-xs">
          <span className="block font-semibold mb-1">Persona</span>
          <select className={input} value={vend} onChange={(e) => setVend(e.target.value)}>
            <option value="">-- elija --</option>
            {vendedores.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block font-semibold mb-1">Aprueba desde ({moneda})</span>
          <input className={input} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>
        <button
          onClick={agregar}
          disabled={pendiente}
          className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-40"
        >
          Agregar / actualizar
        </button>
      </div>
    </div>
  );
}
