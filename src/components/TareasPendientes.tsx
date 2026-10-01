"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { caducarAccion, marcarAccionHecha } from "@/app/cotizaciones/actividad";

export type Tarea = {
  id: number;
  id_cotizacion: number;
  num_cotizacion: string | null;
  cliente: string | null;
  vendedor_nombre: string;
  responsable_nombre: string;
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

  // El dia se parte en tres: lo atrasado, lo de hoy y lo que viene. Abierto
  // muestra solo lo primero y lo segundo, que es lo que hay que resolver antes
  // de cerrar la jornada; el resto esta a un clic.
  const vencidas = tareas.filter((t) => t.dias_de_atraso > 0);
  const deHoy = tareas.filter((t) => t.dias_de_atraso === 0);
  const proximas = tareas.filter((t) => t.dias_de_atraso < 0);

  const [tramo, setTramo] = useState<"dia" | "proximas" | "todas">("dia");
  const [caducando, setCaducando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  const visibles =
    tramo === "dia"
      ? [...vencidas, ...deHoy]
      : tramo === "proximas"
        ? proximas
        : tareas;

  function cerrar(t: Tarea) {
    comenzar(async () => {
      const r = await marcarAccionHecha(t.id, t.id_cotizacion);
      setAviso(r.mensaje ?? "");
      router.refresh();
    });
  }

  function caducar(t: Tarea) {
    const texto = motivo;
    setCaducando(null);
    comenzar(async () => {
      const r = await caducarAccion(t.id, t.id_cotizacion, texto);
      setAviso(r.mensaje ?? "");
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex items-center justify-between">
        <span>{soloMias ? "MI DIA" : "EL DIA DEL EQUIPO"}</span>
        <span className="font-normal flex gap-1">
          {(
            [
              ["dia", `Hoy y atrasadas (${vencidas.length + deHoy.length})`],
              ["proximas", `Mas adelante (${proximas.length})`],
              ["todas", `Todas (${tareas.length})`],
            ] as const
          ).map(([k, texto]) => (
            <button
              key={k}
              onClick={() => setTramo(k)}
              className={`rounded px-1.5 py-0.5 ${
                tramo === k ? "bg-white text-verde font-semibold" : "bg-white/15"
              }`}
            >
              {texto}
            </button>
          ))}
        </span>
      </div>

      {aviso && (
        <p className="px-3 py-1.5 text-xs text-gray-700 bg-crema border-b border-gray-200">
          {aviso}
        </p>
      )}

      {/* Caducar no se hace de un clic: hay que decir por que no se va a
          hacer. Queda escrito que se comprometio y no se cumplio, y solo un
          administrador puede deshacerlo. */}
      {caducando !== null && (() => {
        const t = tareas.find((x) => x.id === caducando);
        if (!t) return null;
        return (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-300 space-y-1.5">
            <p className="text-[11px] text-amber-900 font-semibold">
              Dar por caduca: {t.proxima_accion} ({t.num_cotizacion ?? t.id_cotizacion})
            </p>
            <input
              className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white"
              autoFocus
              maxLength={300}
              value={motivo}
              placeholder="Por que ya no se va a hacer. Ej: el cliente compro en otro lado"
              onChange={(e) => setMotivo(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="bg-dorado-osc text-white text-xs font-semibold px-2 py-0.5 rounded disabled:opacity-50"
                disabled={enCurso || !motivo.trim()}
                onClick={() => caducar(t)}
              >
                Darla por caduca
              </button>
              <button
                className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white"
                disabled={enCurso}
                onClick={() => setCaducando(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}

      {visibles.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-gray-400">
          {tramo === "dia"
            ? "Nada vencido ni para hoy."
            : "Nada pendiente. Lo que se comprometa en la bitacora de una cotizacion aparece aqui."}
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
                  A cargo de
                </th>
                {puedeCerrar && <th className="px-3 py-1 w-[14%]" />}
              </tr>
            </thead>
            <tbody>
              {visibles.map((t) => {
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
                      {t.responsable_nombre}
                      {t.responsable_nombre !== t.vendedor_nombre && (
                        <span className="block text-[10px] text-gray-400">
                          la anoto {t.vendedor_nombre}
                        </span>
                      )}
                    </td>
                    {puedeCerrar && (
                      <td className="px-3 py-1 text-right whitespace-nowrap">
                        <button
                          className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50"
                          disabled={enCurso}
                          onClick={() => cerrar(t)}
                        >
                          Ya esta hecha
                        </button>
                        <button
                          className="border border-gray-300 text-gray-500 text-xs px-2 py-0.5 rounded bg-white disabled:opacity-50 ml-1"
                          disabled={enCurso}
                          title="Ya no se va a hacer"
                          onClick={() => {
                            setCaducando(t.id);
                            setMotivo("");
                          }}
                        >
                          Caducar
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
