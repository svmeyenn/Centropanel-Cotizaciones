"use client";

import { useState, useTransition } from "react";
import { cerrarPeriodo, reabrirPeriodo } from "@/app/periodos/acciones";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const campo = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";

interface Estado {
  estado: string;
  por: string | null;
  en: string | null;
}
interface Historial {
  id: number;
  anio: number;
  mes: number;
  accion: string;
  motivo: string | null;
  por: string;
  en: string;
}

const fechaHora = (s: string) =>
  new Date(s).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

export default function PanelPeriodos({
  pais,
  paises,
  anio,
  anios,
  hoyMes,
  estados,
  historial,
  puedeCerrar,
  puedeReabrir,
}: {
  pais: { id: number; nombre: string; codigo: string };
  paises: { codigo: string; nombre: string }[];
  anio: number;
  anios: number[];
  hoyMes: number;
  estados: Record<number, Estado>;
  historial: Historial[];
  puedeCerrar: boolean;
  puedeReabrir: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reabriendo, setReabriendo] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pendiente, empezar] = useTransition();

  function cerrar(mes: number) {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await cerrarPeriodo(pais.id, anio, mes);
      if (r?.error) setError(r.error);
      else setAviso(`${MESES[mes - 1]} ${anio} quedó cerrado en ${pais.nombre}.`);
    });
  }

  function reabrir(mes: number) {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await reabrirPeriodo(pais.id, anio, mes, motivo);
      if (r?.error) setError(r.error);
      else {
        setAviso(`${MESES[mes - 1]} ${anio} quedó abierto de nuevo. Quedó registrado el motivo.`);
        setReabriendo(null);
        setMotivo("");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
        Un período cerrado bloquea facturas, cobros, pagos y asientos manuales con fecha de ese mes. Los asientos
        automáticos se pueden recalcular igual, sin tocar los meses cerrados. Cierra el contador; solo un socio puede
        reabrir y debe dejar el motivo.
        {!puedeCerrar && " Tu perfil no cierra períodos: aquí solo ves el estado."}
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
        <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">Ver</button>
      </form>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Estado de cada mes de {anio} en {pais.nombre}</caption>
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Mes</th>
                <th scope="col" className="text-left px-3 py-2">Estado</th>
                <th scope="col" className="text-left px-3 py-2">Cerrado por</th>
                <th scope="col" className="text-left px-3 py-2">Fecha</th>
                <th scope="col" className="text-left px-3 py-2 w-80">Acción</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((nombre, i) => {
                const mes = i + 1;
                const e = estados[mes];
                const cerrado = e?.estado === "Cerrado";
                return (
                  <tr key={mes} className="border-t border-gray-100 hover:bg-crema align-top">
                    <th scope="row" className="text-left px-3 py-1.5 font-semibold">{nombre}</th>
                    <td className="px-3 py-1.5">
                      <span className={`inline-block rounded px-2 py-0.5 font-semibold ${cerrado ? "bg-gray-200 text-gray-800" : "bg-green-100 text-green-800"}`}>
                        {cerrado ? "Cerrado" : "Abierto"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{cerrado ? (e.por ?? "—") : "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{cerrado && e.en ? fechaHora(e.en) : "—"}</td>
                    <td className="px-3 py-1.5">
                      {!cerrado && puedeCerrar && mes < hoyMes && (
                        <button onClick={() => cerrar(mes)} disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50">
                          Cerrar {nombre.toLowerCase()}
                        </button>
                      )}
                      {!cerrado && puedeCerrar && mes >= hoyMes && (
                        <span className="text-gray-500">Aún no termina el mes</span>
                      )}
                      {cerrado && puedeReabrir && reabriendo !== mes && (
                        <button onClick={() => { setReabriendo(mes); setMotivo(""); }} className="text-verde underline">
                          Reabrir
                        </button>
                      )}
                      {cerrado && reabriendo === mes && (
                        <div className="flex gap-1.5">
                          <input
                            aria-label={`Motivo para reabrir ${nombre}`}
                            className={`${campo} flex-1`}
                            placeholder="Motivo de la reapertura"
                            value={motivo}
                            onChange={(ev) => setMotivo(ev.target.value)}
                          />
                          <button onClick={() => reabrir(mes)} disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50">
                            Reabrir
                          </button>
                          <button onClick={() => setReabriendo(null)} className="text-gray-600 underline">Cancelar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="px-3 py-2 bg-crema border-b border-gray-200 text-xs text-dorado-osc font-semibold">
          Historial de cierres y reaperturas (últimos 30)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Cuándo</th>
                <th scope="col" className="text-left px-3 py-2">Período</th>
                <th scope="col" className="text-left px-3 py-2">Acción</th>
                <th scope="col" className="text-left px-3 py-2">Quién</th>
                <th scope="col" className="text-left px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-gray-500">Aún no se cierra ningún período en {pais.nombre}.</td></tr>
              )}
              {historial.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 tabular-nums">{fechaHora(h.en)}</td>
                  <td className="px-3 py-1.5">{MESES[h.mes - 1]} {h.anio}</td>
                  <td className="px-3 py-1.5">{h.accion}</td>
                  <td className="px-3 py-1.5">{h.por}</td>
                  <td className="px-3 py-1.5">{h.motivo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
