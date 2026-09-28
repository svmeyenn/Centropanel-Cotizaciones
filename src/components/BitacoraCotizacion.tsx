"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  marcarAccionHecha,
  reabrirAccion,
  registrarActividad,
  type Resultado,
} from "@/app/cotizaciones/actividad";

export type Actividad = {
  id: number;
  id_cotizacion: number;
  vendedor_nombre: string;
  fecha_registro: string;
  comentario: string;
  proxima_accion: string | null;
  proxima_fecha: string | null;
  ejecutada_en: string | null;
  ejecutor_nombre: string | null;
  estado_proxima: "Vigente" | "Vencida" | "Ejecutada" | null;
};

const CAMPO = "border border-gray-300 rounded px-2 py-0.5 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";

const TONO: Record<string, string> = {
  Vigente: "bg-crema text-verde border-verde",
  Vencida: "bg-red-50 text-red-700 border-red-300",
  Ejecutada: "bg-verde text-white border-verde",
};

// Fecha y hora en que quedo escrito, en hora de Chile: el registro se guarda
// en UTC y a las nueve de la noche ya seria mañana.
const cuando = (f: string) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(f));

const soloDia = (f: string) => f.slice(0, 10).split("-").reverse().join("-");

// La bitacora de la cotizacion: que se hablo, cuando, y que viene despues.
// Lo que hoy vive en la cabeza del vendedor y se pierde cuando sale de
// vacaciones.
export default function BitacoraCotizacion({
  idCotizacion,
  actividad,
  puedeEscribir,
}: {
  idCotizacion: number;
  actividad: Actividad[];
  puedeEscribir: boolean;
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState("");
  const [conAccion, setConAccion] = useState(false);

  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    registrarActividad,
    null
  );

  useEffect(() => {
    if (estado?.ok) {
      formulario.current?.reset();
      setConAccion(false);
      router.refresh();
    }
  }, [estado, router]);

  function correr(accion: () => Promise<Resultado>) {
    comenzar(async () => {
      const r = await accion();
      setAviso(r.mensaje ?? "");
      if (r.ok) router.refresh();
    });
  }

  // Lo que quedo comprometido y todavia no se hace: es lo primero que hay que
  // ver al abrir la cotizacion.
  const pendientes = actividad.filter(
    (a) => a.estado_proxima === "Vencida" || a.estado_proxima === "Vigente"
  );
  const vencidas = pendientes.filter((a) => a.estado_proxima === "Vencida");

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex items-center justify-between">
        <span>BITACORA DE LA COTIZACION</span>
        <span className="font-normal">
          {actividad.length} registro{actividad.length === 1 ? "" : "s"}
          {vencidas.length > 0 && (
            <span className="ml-2 bg-white text-red-700 rounded px-1.5 py-0.5 font-semibold">
              {vencidas.length} vencida{vencidas.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </div>

      {puedeEscribir && (
        <form
          ref={formulario}
          action={enviar}
          className="border-b border-gray-200 px-3 py-2 grid gap-2 sm:grid-cols-4 items-end"
        >
          <input type="hidden" name="id_cotizacion" value={idCotizacion} />

          <label className="sm:col-span-4 text-xs">
            <span className={ROTULO}>Que paso *</span>
            <input
              name="comentario"
              className={CAMPO}
              placeholder="Llame al cliente, quedo de revisarlo con su arquitecto"
              maxLength={500}
              required
            />
          </label>

          <label className="sm:col-span-4 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={conAccion}
              onChange={(e) => setConAccion(e.target.checked)}
            />
            <span>Queda algo pendiente que hacer</span>
          </label>

          {conAccion && (
            <>
              <label className="sm:col-span-2 text-xs">
                <span className={ROTULO}>Proxima accion *</span>
                <input
                  name="proxima_accion"
                  className={CAMPO}
                  placeholder="Llamar para cerrar"
                  maxLength={200}
                  required
                />
              </label>
              <label className="text-xs">
                <span className={ROTULO}>Para cuando *</span>
                <input
                  type="date"
                  name="proxima_fecha"
                  className={CAMPO}
                  required
                />
              </label>
            </>
          )}

          <div className={conAccion ? "" : "sm:col-span-4 flex justify-end"}>
            <button
              type="submit"
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
              disabled={pendiente}
            >
              {pendiente ? "Anotando..." : "Anotar"}
            </button>
          </div>

          {estado && !estado.ok && (
            <p className="sm:col-span-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-1.5">
              {estado.mensaje}
            </p>
          )}
        </form>
      )}

      {aviso && (
        <p className="px-3 py-1.5 text-xs text-gray-700 bg-crema border-b border-gray-200">
          {aviso}
        </p>
      )}

      {actividad.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-gray-400">
          Sin registros todavia. Lo que se converse con el cliente se anota aqui.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {actividad.map((a) => (
            <li key={a.id} className="px-3 py-2 text-xs">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{a.vendedor_nombre}</span>
                <span className="text-gray-500">{cuando(a.fecha_registro)}</span>
              </div>

              <p className="text-gray-800 mt-0.5">{a.comentario}</p>

              {a.proxima_accion && (
                <div className="mt-1 flex flex-wrap items-center gap-2 bg-crema border border-gray-200 rounded px-2 py-1">
                  <span
                    className={`border rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      TONO[a.estado_proxima ?? "Vigente"]
                    }`}
                  >
                    {a.estado_proxima}
                  </span>
                  <span className="font-semibold">{a.proxima_accion}</span>
                  <span className="text-gray-600">
                    {a.estado_proxima === "Ejecutada" && a.ejecutada_en
                      ? `comprometida para el ${soloDia(a.proxima_fecha!)}, hecha el ${soloDia(a.ejecutada_en)}`
                      : `para el ${soloDia(a.proxima_fecha!)}`}
                    {a.ejecutor_nombre ? ` por ${a.ejecutor_nombre}` : ""}
                  </span>

                  {puedeEscribir && (
                    <span className="ml-auto">
                      {a.estado_proxima === "Ejecutada" ? (
                        <button
                          className={BOTON_CLARO}
                          disabled={enCurso}
                          onClick={() =>
                            correr(() => reabrirAccion(a.id, idCotizacion))
                          }
                        >
                          Reabrir
                        </button>
                      ) : (
                        <button
                          className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded disabled:opacity-50"
                          disabled={enCurso}
                          onClick={() =>
                            correr(() => marcarAccionHecha(a.id, idCotizacion))
                          }
                        >
                          Ya esta hecha
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
