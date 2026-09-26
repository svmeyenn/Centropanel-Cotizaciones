"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { pesos } from "@/lib/formato";
import Ventana from "@/components/Ventana";
import { crearRendicion, type ResultadoRendicion } from "@/app/rendiciones/acciones";
import {
  desenlaceRendicion,
  etiquetaInterlocutor,
  fechaCorta,
  type Interlocutor,
  type Rendicion,
} from "@/lib/finanzas/tipos";
import ChipEstado from "./EstadoRendicion";

const ESTADOS = [
  "Borrador",
  "Enviada",
  "Aprobada",
  "Pagada",
  "Incompleta",
  "Rechazada",
];

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const primeroDelMes = () => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
};

export default function PanelRendiciones({
  rendiciones,
  interlocutores,
  puedePagar,
}: {
  rendiciones: Rendicion[];
  interlocutores: Interlocutor[];
  puedePagar: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [creando, setCreando] = useState(false);
  const [estado, enviar, pendiente] = useActionState<
    ResultadoRendicion | null,
    FormData
  >(crearRendicion, null);

  // Recien creada se abre sola: lo siguiente es cargarle las boletas.
  useEffect(() => {
    if (estado?.ok && estado.id_rendicion) {
      setCreando(false);
      router.push(`/rendiciones/${estado.id_rendicion}`);
    }
  }, [estado, router]);

  function filtrarPorEstado(valor: string) {
    const nuevo = new URLSearchParams(params.toString());
    if (valor) nuevo.set("estado", valor);
    else nuevo.delete("estado");
    const cola = nuevo.toString();
    router.push(cola ? `/rendiciones?${cola}` : "/rendiciones");
  }

  const activos = interlocutores.filter((i) => !i.borrado);
  const totalRendido = rendiciones.reduce(
    (t, r) => t + Number(r.total_rendido),
    0
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className={ROTULO}>Estado</span>
            <select
              className={`${CAMPO} w-44`}
              value={params.get("estado") ?? ""}
              onChange={(e) => filtrarPorEstado(e.target.value)}
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <span className="text-xs text-gray-600 pb-1.5">
            <strong className="text-negro">{rendiciones.length}</strong>{" "}
            rendiciones, rendido{" "}
            <strong className="text-negro tabular-nums">
              {pesos(totalRendido)}
            </strong>
          </span>
        </div>

        <button
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          onClick={() => setCreando(true)}
        >
          Nueva rendicion
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2 w-[18%]">Periodo</th>
                <th className="text-left px-3 py-2 w-[20%]">Rinde</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell w-[16%]">
                  Cargada por
                </th>
                <th className="text-right px-3 py-2 w-[13%]">Rendido</th>
                <th className="text-right px-3 py-2 hidden md:table-cell w-[13%]">
                  Anticipos
                </th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[14%]">
                  Resultado
                </th>
                <th className="text-left px-3 py-2 w-[12%]">Estado</th>
                <th className="px-3 py-2 w-[9%] min-w-[5rem]" />
              </tr>
            </thead>
            <tbody>
              {rendiciones.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">
                    No hay rendiciones que mostrar.
                  </td>
                </tr>
              )}

              {rendiciones.map((r) => {
                const d = desenlaceRendicion(Number(r.saldo), r.estado);
                return (
                  <tr
                    key={r.id_rendicion}
                    className="border-t border-gray-100 hover:bg-crema"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fechaCorta(r.periodo_desde)} a{" "}
                      {fechaCorta(r.periodo_hasta)}
                    </td>
                    <td className="px-3 py-2 truncate">
                      {etiquetaInterlocutor(r.razon_social, r.nombre_referencia)}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-gray-600 truncate">
                      {r.vendedor_nombre}
                      {r.cargada_por_tercero && (
                        <span className="block text-[11px] text-dorado-osc">
                          en nombre de un tercero
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {pesos(r.total_rendido)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell text-gray-600">
                      {pesos(r.total_anticipos)}
                    </td>
                    <td
                      className={`px-3 py-2 hidden md:table-cell ${
                        d.retiene ? "text-red-700" : "text-gray-600"
                      }`}
                    >
                      {d.texto}
                      {Number(r.saldo) !== 0 && (
                        <span className="block text-[11px] tabular-nums">
                          {pesos(Math.abs(Number(r.saldo)))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ChipEstado estado={r.estado} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/rendiciones/${r.id_rendicion}`}
                        className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {creando && (
        <Ventana
          titulo="Nueva rendicion"
          subtitulo="El periodo puede ser un mes, un viaje o una obra"
          onCerrar={() => setCreando(false)}
          ancho="max-w-lg"
        >
          <form action={enviar} className="grid gap-3 sm:grid-cols-2">
            {/* Quien solo rinde, rinde para si mismo: el destinatario sale de
                su ficha y no se elige. Transcribir boletas de otro es cosa de
                quien paga. */}
            {puedePagar ? (
              <div className="sm:col-span-2">
                <label className={ROTULO}>Quien rinde *</label>
                <select
                  name="id_interlocutor"
                  className={CAMPO}
                  required
                  autoFocus
                  defaultValue=""
                >
                  <option value="">Elija a la persona</option>
                  {activos.map((i) => (
                    <option key={i.id_interlocutor} value={i.id_interlocutor}>
                      {etiquetaInterlocutor(i.razon_social, i.nombre_referencia)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="sm:col-span-2 text-xs text-gray-600 bg-crema border border-gray-200 rounded px-3 py-2">
                La rendicion queda a su nombre.
              </p>
            )}

            <div>
              <label className={ROTULO}>Desde *</label>
              <input
                type="date"
                name="periodo_desde"
                className={CAMPO}
                defaultValue={primeroDelMes()}
                required
              />
            </div>
            <div>
              <label className={ROTULO}>Hasta *</label>
              <input
                type="date"
                name="periodo_hasta"
                className={CAMPO}
                defaultValue={iso(new Date())}
                required
              />
            </div>

            {estado && !estado.ok && (
              <p className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
                {estado.mensaje}
              </p>
            )}

            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button
                type="button"
                className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
                onClick={() => setCreando(false)}
                disabled={pendiente}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                disabled={pendiente}
              >
                {pendiente ? "Creando..." : "Crear"}
              </button>
            </div>
          </form>
        </Ventana>
      )}
    </>
  );
}
