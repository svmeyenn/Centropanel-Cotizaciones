"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fecha as fmtFecha, hoyISO, unidades as fmtUnid } from "@/lib/formato";
import { anularDespacho, registrarDespacho } from "@/app/pedidos/acciones";

export interface DespachoVista {
  id: number;
  fecha: string;
  guia: string | null;
  notas: string | null;
  quien: string | null;
  // Es de quien mira: puede anularlo aunque no sea administrador.
  propio: boolean;
  lineas: { id_detalle: number; cantidad: number }[];
}

// Despachos del pedido: el pedido sale en tandas, cada una con su guia y lo que
// lleva de cada producto. La base no deja despachar mas de lo pedido y ajusta el
// estado a Despacho parcial o Despachado, y la fecha de entrega al ultimo despacho.
export default function DespachosPedido({
  idPedido,
  lineas,
  despachos,
  puedeRegistrar,
  esAdmin,
  anulado,
}: {
  idPedido: number;
  lineas: { id: number; sku?: string | null; descripcion: string; unidades: number }[];
  despachos: DespachoVista[];
  puedeRegistrar: boolean;
  esAdmin: boolean;
  anulado: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [guia, setGuia] = useState("");
  const [notas, setNotas] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, string>>({});

  const despachado = new Map<number, number>();
  for (const d of despachos) for (const l of d.lineas) despachado.set(l.id_detalle, (despachado.get(l.id_detalle) ?? 0) + Number(l.cantidad));
  const falta = (l: { id: number; unidades: number }) => Math.max(Number(l.unidades) - (despachado.get(l.id) ?? 0), 0);
  const quedan = lineas.filter((l) => falta(l) > 0);
  const descripcion = new Map(lineas.map((l) => [l.id, l.descripcion]));

  function abrir() {
    setError(null);
    setFecha(hoyISO());
    setGuia("");
    setNotas("");
    // Parte con todo lo pendiente: el caso corriente de la ultima tanda; se corrige lo que no sale.
    setCantidades(Object.fromEntries(quedan.map((l) => [l.id, String(falta(l))])));
    setAbierto(true);
  }

  function guardar() {
    setError(null);
    const sel = Object.entries(cantidades)
      .map(([id, c]) => ({ id_detalle: Number(id), cantidad: Number(String(c).replace(",", ".")) }))
      .filter((x) => x.cantidad > 0);
    if (sel.length === 0) return setError("Indique cuanto sale de al menos un producto.");
    if (Object.values(cantidades).some((c) => c.trim() !== "" && !(Number(c.replace(",", ".")) >= 0))) {
      return setError("Hay una cantidad invalida.");
    }
    empezar(async () => {
      const r = await registrarDespacho(idPedido, { fecha, guia, notas, lineas: sel });
      if (r?.error) return setError(r.error);
      setAbierto(false);
      router.refresh();
    });
  }

  function anular(d: DespachoVista) {
    if (!confirm(`Anular el despacho del ${fmtFecha(d.fecha)}${d.guia ? ` (guia ${d.guia})` : ""}? Sus cantidades vuelven a quedar pendientes.`)) return;
    empezar(async () => {
      setError(null);
      const r = await anularDespacho(d.id, idPedido);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const total = lineas.reduce((a, l) => a + Number(l.unidades), 0);
  const totalDespachado = lineas.reduce((a, l) => a + Math.min(despachado.get(l.id) ?? 0, Number(l.unidades)), 0);

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-verde text-white text-xs font-semibold px-3 py-2 flex items-center gap-2">
        DESPACHOS
        <span className="font-normal text-white/80">
          {despachos.length === 0 ? "sin despachos" : quedan.length === 0 ? "todo despachado" : `${fmtUnid(totalDespachado)} de ${fmtUnid(total)} unidades`}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">{error}</div>}

        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-2 py-1.5">Producto</th>
                <th className="text-right px-2 py-1.5 w-24">Pedido</th>
                <th className="text-right px-2 py-1.5 w-24">Despachado</th>
                <th className="text-right px-2 py-1.5 w-24">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">
                    {l.sku && <span className="text-gray-500 mr-1">{l.sku}</span>}
                    {l.descripcion}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtUnid(l.unidades)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtUnid(despachado.get(l.id) ?? 0)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${falta(l) > 0 ? "font-semibold text-amber-800" : "text-gray-400"}`}>{fmtUnid(falta(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {despachos.length > 0 && (
          <ul className="space-y-1.5">
            {despachos.map((d) => (
              <li key={d.id} className="border border-gray-200 rounded px-2 py-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{fmtFecha(d.fecha)}</span>
                  {d.guia ? <span>Guia {d.guia}</span> : <span className="text-gray-500">sin guia</span>}
                  {d.quien && <span className="text-gray-500">registro {d.quien}</span>}
                  {(esAdmin || d.propio) && (
                    <button type="button" onClick={() => anular(d)} disabled={pendiente} className="ml-auto text-red-700 underline disabled:opacity-40">
                      anular
                    </button>
                  )}
                </div>
                <div className="text-gray-700 mt-0.5">
                  {d.lineas.map((l) => `${fmtUnid(l.cantidad)} ${descripcion.get(l.id_detalle) ?? ""}`).join(" · ")}
                </div>
                {d.notas && <div className="text-gray-500 mt-0.5">{d.notas}</div>}
              </li>
            ))}
          </ul>
        )}

        {puedeRegistrar && !anulado && quedan.length > 0 && !abierto && (
          <button type="button" onClick={abrir} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded">
            Registrar despacho
          </button>
        )}

        {abierto && (
          <div className="border border-gray-200 rounded p-3 space-y-3 bg-crema/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs">
                <span className="block text-dorado-osc font-semibold mb-0.5">Fecha</span>
                <input id="desp-fecha" type="date" className={input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
              <label className="text-xs">
                <span className="block text-dorado-osc font-semibold mb-0.5">Guia de despacho</span>
                <input id="desp-guia" className={input} value={guia} onChange={(e) => setGuia(e.target.value)} placeholder="Numero de la guia" />
              </label>
              <label className="text-xs">
                <span className="block text-dorado-osc font-semibold mb-0.5">Notas</span>
                <input id="desp-notas" className={input} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Camion, quien recibe..." />
              </label>
            </div>
            <table className="w-full text-xs">
              <thead className="text-gray-600">
                <tr>
                  <th className="text-left py-1">Producto</th>
                  <th className="text-right py-1 w-24">Pendiente</th>
                  <th className="text-right py-1 w-28">Sale ahora</th>
                </tr>
              </thead>
              <tbody>
                {quedan.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="py-1">{l.descripcion}</td>
                    <td className="py-1 text-right tabular-nums">{fmtUnid(falta(l))}</td>
                    <td className="py-1 text-right">
                      <label htmlFor={`desp-cant-${l.id}`} className="sr-only">Cantidad de {l.descripcion}</label>
                      <input
                        id={`desp-cant-${l.id}`}
                        inputMode="decimal"
                        className="border border-gray-300 rounded px-2 py-0.5 text-sm w-24 text-right"
                        value={cantidades[l.id] ?? ""}
                        onChange={(e) => setCantidades((c) => ({ ...c, [l.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-500">Deje en 0 o vacio lo que no sale en esta tanda.</p>
            <div className="flex gap-2">
              <button type="button" onClick={guardar} disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40">
                {pendiente ? "Guardando..." : "Guardar despacho"}
              </button>
              <button type="button" onClick={() => setAbierto(false)} disabled={pendiente} className="bg-white border border-gray-300 text-xs px-3 py-1 rounded">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
