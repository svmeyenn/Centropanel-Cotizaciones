"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Bitacora from "@/components/Bitacora";
import {
  caducarAccion,
  marcarAccionHecha,
  reabrirAccion,
  reasignarTarea,
  registrarActividad,
  revocarCaducidad,
  type Resultado,
} from "@/app/cotizaciones/actividad";

export type Actividad = {
  id: number;
  id_cotizacion: number;
  id_vendedor: number;
  vendedor_nombre: string;
  id_responsable: number | null;
  responsable_nombre: string | null;
  fecha_registro: string;
  comentario: string;
  proxima_accion: string | null;
  proxima_fecha: string | null;
  ejecutada_en: string | null;
  ejecutor_nombre: string | null;
  caducada_en: string | null;
  caducador_nombre: string | null;
  motivo_caduca: string | null;
  estado_proxima: "Vigente" | "Vencida" | "Ejecutada" | "Caduca" | null;
};

const CAMPO = "border border-gray-300 rounded px-2 py-0.5 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";

const TONO: Record<string, string> = {
  Vigente: "bg-crema text-verde border-verde",
  Vencida: "bg-red-50 text-red-700 border-red-300",
  Ejecutada: "bg-verde text-white border-verde",
  Caduca: "bg-gray-100 text-gray-500 border-gray-300 line-through",
};

// Fecha y hora en que quedo escrito, en hora de Chile: el registro se guarda
// en UTC y a las nueve de la noche ya seria mañana.
const cuando = (f: string, zona: string) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: zona,
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
  puedeAsignar,
  equipo,
  yo,
  zona = "America/Santiago",
}: {
  idCotizacion: number;
  actividad: Actividad[];
  puedeEscribir: boolean;
  // Asignarle la tarea a otro es cosa de quien administra.
  puedeAsignar: boolean;
  equipo: { id: number; nombre: string }[];
  yo: number;
  // Hora en que se muestra lo escrito: la del pais de la cotizacion.
  zona?: string;
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState("");
  const [conAccion, setConAccion] = useState(false);
  // Caducar pide un motivo escrito, asi que el boton no actua de inmediato:
  // abre el campo para esa accion y recien despues se confirma.
  const [caducando, setCaducando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

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

              {puedeAsignar && (
                <label className="text-xs">
                  <span className={ROTULO}>Quien la hace</span>
                  <select name="id_responsable" className={CAMPO} defaultValue={yo}>
                    {equipo.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id === yo ? `${p.nombre} (yo)` : p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
                <span className="text-gray-500">Anotó</span>
                <span className="font-semibold">{a.vendedor_nombre}</span>
                <span className="text-gray-500">{cuando(a.fecha_registro, zona)}</span>
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

                  {/* De quien es. Mientras no se asigne a otro, de quien la
                      anoto, que es como se leia antes de que existiera el
                      responsable. */}
                  {puedeAsignar && a.estado_proxima !== "Ejecutada" ? (
                    <select
                      className="border border-gray-300 rounded px-1 py-0.5 text-[11px] bg-white"
                      value={a.id_responsable ?? a.id_vendedor}
                      disabled={enCurso}
                      onChange={(e) =>
                        correr(() =>
                          reasignarTarea(
                            a.id,
                            idCotizacion,
                            Number(e.target.value)
                          )
                        )
                      }
                    >
                      {equipo.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id === yo ? `${p.nombre} (yo)` : p.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-gray-600">
                      a cargo de{" "}
                      <strong>
                        {a.responsable_nombre ?? a.vendedor_nombre}
                      </strong>
                    </span>
                  )}

                  {puedeEscribir && (
                    <span className="ml-auto flex gap-1.5">
                      {a.estado_proxima === "Ejecutada" && (
                        <button
                          className={BOTON_CLARO}
                          disabled={enCurso}
                          onClick={() =>
                            correr(() => reabrirAccion(a.id, idCotizacion))
                          }
                        >
                          Reabrir
                        </button>
                      )}

                      {/* Revivir una accion caduca la vuelve a dejar
                          pendiente. Solo quien administra: caducar es dejar
                          escrito que algo no se hizo, y si cualquiera pudiera
                          borrar ese registro no valdria como registro. */}
                      {a.estado_proxima === "Caduca" && puedeAsignar && (
                        <button
                          className={BOTON_CLARO}
                          disabled={enCurso}
                          onClick={() =>
                            correr(() => revocarCaducidad(a.id, idCotizacion))
                          }
                        >
                          Revivir
                        </button>
                      )}

                      {(a.estado_proxima === "Vigente" ||
                        a.estado_proxima === "Vencida") && (
                        <>
                          <button
                            className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded disabled:opacity-50"
                            disabled={enCurso}
                            onClick={() =>
                              correr(() => marcarAccionHecha(a.id, idCotizacion))
                            }
                          >
                            Ya esta hecha
                          </button>
                          <button
                            className={BOTON_CLARO}
                            disabled={enCurso}
                            onClick={() => {
                              setCaducando(a.id);
                              setMotivo("");
                            }}
                          >
                            Dar por caduca
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Caducar no se hace de un clic: hay que decir por que no se
                  va a hacer. Dentro de seis meses "no se hizo" no le sirve a
                  nadie. */}
              {caducando === a.id && (
                <div className="mt-1 bg-amber-50 border border-amber-300 rounded px-2 py-1.5 space-y-1.5">
                  <label className="block text-[11px] text-amber-900 font-semibold">
                    Por que esta accion ya no se va a hacer
                  </label>
                  <input
                    className={CAMPO}
                    autoFocus
                    value={motivo}
                    maxLength={300}
                    placeholder="El cliente compro en otro lado"
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <p className="text-[11px] text-amber-900">
                    Queda escrito que se comprometio y no se cumplio. Solo un
                    administrador puede deshacerlo.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="bg-dorado-osc text-white text-xs font-semibold px-2 py-0.5 rounded disabled:opacity-50"
                      disabled={enCurso || !motivo.trim()}
                      onClick={() => {
                        setCaducando(null);
                        correr(() => caducarAccion(a.id, idCotizacion, motivo));
                      }}
                    >
                      Darla por caduca
                    </button>
                    <button
                      className={BOTON_CLARO}
                      disabled={enCurso}
                      onClick={() => setCaducando(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {a.estado_proxima === "Caduca" && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Caduca: {a.motivo_caduca}
                  {a.caducador_nombre ? ` (${a.caducador_nombre}` : ""}
                  {a.caducador_nombre && a.caducada_en
                    ? `, ${soloDia(a.caducada_en)})`
                    : a.caducador_nombre
                      ? ")"
                      : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Lo que se hablo con el cliente y lo que le paso al documento son dos
          mitades de la misma historia: el precio que se bajo el martes explica
          la llamada del jueves. El enlace las junta sin llenar esta lista de
          anotaciones automaticas. */}
      <div className="border-t border-gray-200 px-3 py-1.5">
        <Bitacora
          tabla="cotizaciones"
          id={idCotizacion}
          etiqueta="Ver que cambio en el documento (precios, estado, fechas)"
        />
      </div>
    </div>
  );
}
