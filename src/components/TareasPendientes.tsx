"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marcarAccionHecha } from "@/app/cotizaciones/actividad";

export type Tarea = {
  id: number;
  id_cotizacion: number;
  num_cotizacion: string | null;
  cliente: string | null;
  vendedor_nombre: string;
  comentario: string;
  proxima_accion: string;
  proxima_fecha: string;
  estado_proxima: "Vigente" | "Vencida";
  dias_de_atraso: number;
};

const dia = (f: string) => f.slice(0, 10).split("-").reverse().join("-");

// Cuanto falta o cuanto lleva esperando, dicho como se dice: "hoy", "en 3
// dias", "hace 5 dias". Un numero de dias suelto obliga a hacer la cuenta.
function plazo(dias: number) {
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias === -1) return "mañana";
  return dias > 0 ? `hace ${dias} dias` : `en ${-dias} dias`;
}

// Lo que quedo comprometido con los clientes y todavia no se hace. Al final de
// la portada, porque es lo ultimo que uno quiere ver antes de cerrar el dia.
export default function TareasPendientes({
  tareas,
  puedeCerrar,
  soloMias,
}: {
  tareas: Tarea[];
  puedeCerrar: boolean;
  // Un vendedor ve sus compromisos; quien dirige ve los del equipo.
  soloMias: boolean;
}) {
  const router = useRouter();
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState("");

  const vencidas = tareas.filter((t) => t.estado_proxima === "Vencida");

  function cerrar(t: Tarea) {
    comenzar(async () => {
      const r = await marcarAccionHecha(t.id, t.id_cotizacion);
      setAviso(r.mensaje ?? "");
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex items-center justify-between">
        <span>
          {soloMias ? "MIS TAREAS PENDIENTES" : "TAREAS PENDIENTES DEL EQUIPO"}
        </span>
        <span className="font-normal">
          {tareas.length}
          {vencidas.length > 0 && (
            <span className="ml-2 bg-white text-red-700 rounded px-1.5 py-0.5 font-semibold">
              {vencidas.length} vencida{vencidas.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </div>

      {aviso && (
        <p className="px-3 py-1.5 text-xs text-gray-700 bg-crema border-b border-gray-200">
          {aviso}
        </p>
      )}

      {tareas.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-gray-400">
          Nada pendiente. Lo que se comprometa en la bitacora de una cotizacion
          aparece aqui.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-1 w-[11%]">Para cuando</th>
                <th className="text-left px-3 py-1 w-[26%]">Que hay que hacer</th>
                <th className="text-left px-3 py-1 w-[14%]">Cotizacion</th>
                <th className="text-left px-3 py-1 w-[20%]">Cliente</th>
                <th className="text-left px-3 py-1 hidden lg:table-cell w-[15%]">
                  Quien la comprometio
                </th>
                {puedeCerrar && <th className="px-3 py-1 w-[14%]" />}
              </tr>
            </thead>
            <tbody>
              {tareas.map((t) => {
                const vencida = t.estado_proxima === "Vencida";
                return (
                  <tr
                    key={t.id}
                    className="border-t border-gray-100 hover:bg-crema"
                  >
                    <td className="px-3 py-1 whitespace-nowrap">
                      <span
                        className={vencida ? "text-red-700 font-semibold" : ""}
                      >
                        {dia(t.proxima_fecha)}
                      </span>
                      <span className="block text-[10px] text-gray-500">
                        {plazo(t.dias_de_atraso)}
                      </span>
                    </td>
                    <td className="px-3 py-1 truncate" title={t.comentario}>
                      {t.proxima_accion}
                      <span className="block text-[10px] text-gray-500 truncate">
                        {t.comentario}
                      </span>
                    </td>
                    <td className="px-3 py-1 truncate">
                      <Link
                        href={`/cotizaciones/${t.id_cotizacion}`}
                        className="text-verde font-semibold underline"
                      >
                        {t.num_cotizacion ?? `#${t.id_cotizacion}`}
                      </Link>
                    </td>
                    <td className="px-3 py-1 truncate" title={t.cliente ?? ""}>
                      {t.cliente}
                    </td>
                    <td className="px-3 py-1 hidden lg:table-cell truncate text-gray-600">
                      {t.vendedor_nombre}
                    </td>
                    {puedeCerrar && (
                      <td className="px-3 py-1 text-right">
                        <button
                          className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50"
                          disabled={enCurso}
                          onClick={() => cerrar(t)}
                        >
                          Ya esta hecha
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
