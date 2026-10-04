"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  caducarCompromiso,
  editarCompromiso,
  marcarCompromisoHecho,
  reabrirCompromiso,
  registrarConversacionLead,
  reversarCaducidad,
  reversarRevocacion,
  revocarCompromiso,
  type Resultado,
} from "@/app/clientify/actividad-lead";
import {
  caducarAccion,
  marcarAccionHecha,
  reabrirAccion,
  reasignarTarea,
  revocarCaducidad,
} from "@/app/cotizaciones/actividad";

export type EntradaHistorial = {
  origen: "lead" | "cotizacion";
  id: number;
  id_cotizacion: number | null;
  folio: string | null;
  fecha_hecho: string;
  vendedor_nombre: string;
  id_responsable: number | null;
  responsable_nombre: string | null;
  comentario: string;
  proxima_accion: string | null;
  proxima_fecha: string | null;
  ejecutada_en: string | null;
  ejecutor_nombre: string | null;
  revocada_en: string | null;
  revocador_nombre: string | null;
  motivo_revoca: string | null;
  caducada_en: string | null;
  caducador_nombre: string | null;
  motivo_caduca: string | null;
  estado_proxima: "Vigente" | "Vencida" | "Ejecutada" | "Revocada" | "Caduca" | null;
};

const CAMPO = "border border-gray-300 rounded px-2 py-0.5 text-[11px] w-full bg-white";
const ROTULO = "block text-[11px] font-semibold text-dorado-osc mb-0.5";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";

const TONO: Record<string, string> = {
  Vigente: "bg-crema text-verde border-verde",
  Vencida: "bg-red-50 text-red-700 border-red-300",
  Ejecutada: "bg-verde text-white border-verde",
  Revocada: "bg-gray-100 text-gray-600 border-gray-300",
  Caduca: "bg-gray-100 text-gray-500 border-gray-300 line-through",
};

// Un compromiso sigue abierto mientras no se cumpla, se revoque ni caduque.
const abierto = (e: EntradaHistorial) =>
  e.estado_proxima === "Vigente" || e.estado_proxima === "Vencida";

// Los numeros de las conversaciones del lead y de las tareas de cotizacion se
// repiten entre si: cada registro se distingue por su origen.
const clave = (e: EntradaHistorial) => `${e.origen}-${e.id}`;

const BOTON_ROJO =
  "border border-red-300 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";

const dia = (f: string) => f.slice(0, 10).split("-").reverse().join("-");

const cuando = (f: string) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(f));

// Las conversaciones con el lead --que paso, cuando y que quedo comprometido--
// junto con lo anotado en sus cotizaciones. El compromiso lo edita solo el
// Administrador; marcarlo hecho, cualquiera que pueda escribir.
export default function HistorialLead({
  idLead,
  entradas,
  hoy,
  puedeEscribir,
  puedeEditarCompromiso,
  puedeAsignarCotizacion,
  equipo,
  yo,
}: {
  idLead: number;
  entradas: EntradaHistorial[];
  hoy: string;
  puedeEscribir: boolean;
  puedeEditarCompromiso: boolean;
  // Pasarle una tarea de cotizacion a otro, o revivir una caduca: quien administra.
  puedeAsignarCotizacion: boolean;
  equipo: { id: number; nombre: string }[];
  yo: number;
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState("");
  const [conCompromiso, setConCompromiso] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [reasignando, setReasignando] = useState<string | null>(null);
  const [nuevoResponsable, setNuevoResponsable] = useState(yo);
  const [edicion, setEdicion] = useState({ accion: "", fecha: "", responsable: yo });
  // Revocar y caducar piden el motivo escrito: el boton no actua de inmediato,
  // abre el campo y recien despues se confirma.
  const [conMotivo, setConMotivo] = useState<{
    clave: string;
    tipo: "revocar" | "caducar" | "caducar_cotizacion";
  } | null>(null);
  const [motivo, setMotivo] = useState("");

  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    registrarConversacionLead,
    null
  );

  useEffect(() => {
    if (estado?.ok) {
      formulario.current?.reset();
      setConCompromiso(false);
      router.refresh();
    }
  }, [estado, router]);

  function correr(accion: () => Promise<Resultado>) {
    comenzar(async () => {
      const r = await accion();
      setAviso(r.mensaje ?? "");
      if (r.ok) {
        setEditando(null);
        setReasignando(null);
        setConMotivo(null);
        setMotivo("");
        router.refresh();
      }
    });
  }

  function abrirEdicion(e: EntradaHistorial) {
    setEditando(clave(e));
    setEdicion({
      accion: e.proxima_accion ?? "",
      fecha: e.proxima_fecha ?? "",
      responsable: e.id_responsable ?? yo,
    });
  }

  const vencidas = entradas.filter(
    (e) => e.origen === "lead" && e.estado_proxima === "Vencida"
  ).length;

  return (
    <div>
      <div className="px-3 py-1.5 border-b border-gray-100 text-[11px] text-gray-600 flex items-center justify-between">
        <span>
          {entradas.length} registro{entradas.length === 1 ? "" : "s"}, incluidos los de sus
          cotizaciones
        </span>
        {vencidas > 0 && (
          <span className="bg-red-50 text-red-700 border border-red-300 rounded px-1.5 py-0.5 font-semibold">
            {vencidas} compromiso{vencidas === 1 ? "" : "s"} vencido{vencidas === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {puedeEscribir && (
        <form
          ref={formulario}
          action={enviar}
          className="border-b border-gray-200 px-3 py-2 grid gap-2 sm:grid-cols-4 items-end bg-gray-50/60"
        >
          <input type="hidden" name="id_clientify" value={idLead} />

          <label className="text-[11px]">
            <span className={ROTULO}>Fecha en que paso *</span>
            <input type="date" name="fecha_hecho" className={CAMPO} defaultValue={hoy} max={hoy} required />
          </label>
          <label className="sm:col-span-3 text-[11px]">
            <span className={ROTULO}>Que paso *</span>
            <input
              name="comentario"
              className={CAMPO}
              placeholder="Hable con el cliente por WhatsApp, pidio cotizar 70 paneles"
              maxLength={1000}
              required
            />
          </label>

          <label className="sm:col-span-4 flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={conCompromiso}
              onChange={(e) => setConCompromiso(e.target.checked)}
            />
            <span>Quedo un compromiso</span>
          </label>

          {conCompromiso && (
            <>
              <label className="sm:col-span-2 text-[11px]">
                <span className={ROTULO}>Compromiso *</span>
                <input
                  name="proxima_accion"
                  className={CAMPO}
                  placeholder="Enviar la cotizacion con el flete"
                  maxLength={200}
                  required
                />
              </label>
              <label className="text-[11px]">
                <span className={ROTULO}>Para cuando *</span>
                <input type="date" name="proxima_fecha" className={CAMPO} min={hoy} required />
              </label>
              {puedeEditarCompromiso ? (
                <label className="text-[11px]">
                  <span className={ROTULO}>Responsable</span>
                  <select name="id_responsable" className={CAMPO} defaultValue={yo}>
                    {equipo.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id === yo ? `${p.nombre} (yo)` : p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-[11px] text-gray-500 pb-1">Quedara a su nombre.</p>
              )}
            </>
          )}

          <div className={conCompromiso ? "sm:col-span-4 flex justify-end" : "sm:col-span-4 flex justify-end"}>
            <button
              type="submit"
              className="bg-verde text-white text-[11px] font-semibold px-3 py-1 rounded disabled:opacity-50"
              disabled={pendiente}
            >
              {pendiente ? "Anotando..." : "Anotar conversacion"}
            </button>
          </div>

          {estado && !estado.ok && (
            <p className="sm:col-span-4 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded px-3 py-1.5">
              {estado.mensaje}
            </p>
          )}
        </form>
      )}

      {aviso && (
        <p className="px-3 py-1.5 text-[11px] text-gray-700 bg-crema border-b border-gray-200">
          {aviso}
        </p>
      )}

      {entradas.length === 0 ? (
        <p className="px-3 py-5 text-center text-[11px] text-gray-400">
          Sin conversaciones todavia. Lo que se converse con este lead se anota aqui.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entradas.map((e) => {
            const propia = e.origen === "lead";
            return (
              <li key={`${e.origen}-${e.id}`} className="px-3 py-2 text-[11px]">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {propia ? (
                    <span className="font-semibold text-verde">Lead</span>
                  ) : (
                    <Link
                      href={`/cotizaciones/${e.id_cotizacion}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-verde underline"
                    >
                      Cotizacion {e.folio}
                    </Link>
                  )}
                  <span className="text-gray-500">{dia(e.fecha_hecho)}</span>
                  <span className="font-semibold">{e.vendedor_nombre}</span>
                </div>

                <p className="text-gray-800 mt-0.5 whitespace-pre-wrap break-words">{e.comentario}</p>

                {e.proxima_accion && editando !== clave(e) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 bg-crema border border-gray-200 rounded px-2 py-1">
                    <span
                      className={`border rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        TONO[e.estado_proxima ?? "Vigente"]
                      }`}
                    >
                      {e.estado_proxima}
                    </span>
                    <span className="font-semibold">{e.proxima_accion}</span>
                    <span className="text-gray-600">para el {dia(e.proxima_fecha ?? "")}</span>
                    {e.responsable_nombre && (
                      <span className="text-gray-600">· {e.responsable_nombre}</span>
                    )}
                    {e.ejecutada_en && (
                      <span className="text-gray-500">
                        · hecha {cuando(e.ejecutada_en)}
                        {e.ejecutor_nombre ? ` por ${e.ejecutor_nombre}` : ""}
                      </span>
                    )}

                    <span className="ml-auto flex flex-wrap items-center gap-1">
                      {propia && abierto(e) && puedeEscribir && (
                        <>
                          <button
                            className={BOTON_CLARO}
                            disabled={enCurso}
                            onClick={() => correr(() => marcarCompromisoHecho(e.id, idLead))}
                          >
                            Cumplida
                          </button>
                          <button
                            className={BOTON_CLARO}
                            disabled={enCurso}
                            onClick={() => {
                              setMotivo("");
                              setConMotivo({ clave: clave(e), tipo: "revocar" });
                            }}
                          >
                            Revocar
                          </button>
                        </>
                      )}
                      {propia && abierto(e) && puedeEditarCompromiso && (
                        <button className={BOTON_CLARO} onClick={() => abrirEdicion(e)}>
                          Editar
                        </button>
                      )}
                      {propia && e.estado_proxima === "Vencida" && puedeEditarCompromiso && (
                        <button
                          className="border border-red-300 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50"
                          disabled={enCurso}
                          onClick={() => {
                            setMotivo("");
                            setConMotivo({ clave: clave(e), tipo: "caducar" });
                          }}
                        >
                          Caducar por incumplimiento
                        </button>
                      )}
                      {propia && e.estado_proxima === "Ejecutada" && puedeEscribir && (
                        <button
                          className={BOTON_CLARO}
                          disabled={enCurso}
                          onClick={() => correr(() => reabrirCompromiso(e.id, idLead))}
                        >
                          Reabrir
                        </button>
                      )}
                      {propia && e.estado_proxima === "Revocada" && puedeEditarCompromiso && (
                        <button
                          className={BOTON_CLARO}
                          disabled={enCurso}
                          onClick={() => correr(() => reversarRevocacion(e.id, idLead))}
                        >
                          Reversar revocacion
                        </button>
                      )}
                      {propia && e.estado_proxima === "Caduca" && puedeEditarCompromiso && (
                        <button
                          className={BOTON_CLARO}
                          disabled={enCurso}
                          onClick={() => correr(() => reversarCaducidad(e.id, idLead))}
                        >
                          Reversar caducidad
                        </button>
                      )}
                      {/* Las tareas de las cotizaciones se gestionan igual desde aqui:
                          las mismas reglas y las mismas acciones que en la cotizacion. */}
                      {!propia && e.id_cotizacion != null && (
                        <>
                          {abierto(e) && puedeEscribir && (
                            <>
                              <button
                                className={BOTON_CLARO}
                                disabled={enCurso}
                                onClick={() =>
                                  correr(() => marcarAccionHecha(e.id, e.id_cotizacion as number))
                                }
                              >
                                Cumplida
                              </button>
                              <button
                                className={BOTON_ROJO}
                                disabled={enCurso}
                                onClick={() => {
                                  setMotivo("");
                                  setConMotivo({ clave: clave(e), tipo: "caducar_cotizacion" });
                                }}
                              >
                                Caducar
                              </button>
                            </>
                          )}
                          {abierto(e) && puedeAsignarCotizacion && (
                            <button
                              className={BOTON_CLARO}
                              onClick={() => {
                                setNuevoResponsable(e.id_responsable ?? yo);
                                setReasignando(clave(e));
                              }}
                            >
                              Reasignar
                            </button>
                          )}
                          {e.estado_proxima === "Ejecutada" && puedeEscribir && (
                            <button
                              className={BOTON_CLARO}
                              disabled={enCurso}
                              onClick={() =>
                                correr(() => reabrirAccion(e.id, e.id_cotizacion as number))
                              }
                            >
                              Reabrir
                            </button>
                          )}
                          {e.estado_proxima === "Caduca" && puedeAsignarCotizacion && (
                            <button
                              className={BOTON_CLARO}
                              disabled={enCurso}
                              onClick={() =>
                                correr(() => revocarCaducidad(e.id, e.id_cotizacion as number))
                              }
                            >
                              Reversar caducidad
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                )}

                {e.revocada_en && (
                  <p className="mt-1 text-gray-600">
                    <span className="font-semibold">Revocada</span> {cuando(e.revocada_en)}
                    {e.revocador_nombre ? ` por ${e.revocador_nombre}` : ""}. Motivo: {e.motivo_revoca}
                  </p>
                )}
                {e.caducada_en && (
                  <p className="mt-1 text-gray-600">
                    <span className="font-semibold">Caduca por incumplimiento</span> {cuando(e.caducada_en)}
                    {e.caducador_nombre ? ` por ${e.caducador_nombre}` : ""}. Motivo: {e.motivo_caduca}
                  </p>
                )}

                {conMotivo?.clave === clave(e) && (
                  <div className="mt-1 flex flex-wrap items-end gap-2 bg-crema border border-gray-200 rounded px-2 py-2">
                    <label className="flex-1 min-w-60">
                      <span className={ROTULO}>
                        {conMotivo.tipo === "revocar"
                          ? "Por que se revoca *"
                          : conMotivo.tipo === "caducar"
                            ? "Motivo del incumplimiento *"
                            : "Por que ya no se va a hacer *"}
                      </span>
                      <input
                        className={CAMPO}
                        value={motivo}
                        maxLength={300}
                        autoFocus
                        placeholder={
                          conMotivo.tipo === "revocar"
                            ? "El cliente desistio del proyecto"
                            : conMotivo.tipo === "caducar"
                              ? "Prometio enviar el plano y no lo hizo"
                              : "El cliente compro en otro lado"
                        }
                        onChange={(x) => setMotivo(x.target.value)}
                      />
                    </label>
                    <button className={BOTON_CLARO} onClick={() => setConMotivo(null)}>
                      Cancelar
                    </button>
                    <button
                      className="bg-verde text-white text-[11px] font-semibold px-3 py-0.5 rounded disabled:opacity-50"
                      disabled={enCurso || !motivo.trim()}
                      onClick={() =>
                        correr(() =>
                          conMotivo.tipo === "revocar"
                            ? revocarCompromiso(e.id, idLead, motivo)
                            : conMotivo.tipo === "caducar"
                              ? caducarCompromiso(e.id, idLead, motivo)
                              : caducarAccion(e.id, e.id_cotizacion as number, motivo)
                        )
                      }
                    >
                      {conMotivo.tipo === "revocar" ? "Revocar compromiso" : "Caducar compromiso"}
                    </button>
                  </div>
                )}

                {reasignando === clave(e) && e.id_cotizacion != null && (
                  <div className="mt-1 flex flex-wrap items-end gap-2 bg-crema border border-gray-200 rounded px-2 py-2">
                    <label className="min-w-48">
                      <span className={ROTULO}>Pasarsela a</span>
                      <select
                        className={CAMPO}
                        value={nuevoResponsable}
                        onChange={(x) => setNuevoResponsable(Number(x.target.value))}
                      >
                        {equipo.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className={BOTON_CLARO} onClick={() => setReasignando(null)}>
                      Cancelar
                    </button>
                    <button
                      className="bg-verde text-white text-[11px] font-semibold px-3 py-0.5 rounded disabled:opacity-50"
                      disabled={enCurso}
                      onClick={() =>
                        correr(() =>
                          reasignarTarea(e.id, e.id_cotizacion as number, nuevoResponsable)
                        )
                      }
                    >
                      Reasignar tarea
                    </button>
                  </div>
                )}

                {e.proxima_accion && editando === clave(e) && (
                  <div className="mt-1 grid gap-2 sm:grid-cols-4 items-end bg-crema border border-gray-200 rounded px-2 py-2">
                    <label className="sm:col-span-2">
                      <span className={ROTULO}>Compromiso</span>
                      <input
                        className={CAMPO}
                        value={edicion.accion}
                        maxLength={200}
                        onChange={(x) => setEdicion({ ...edicion, accion: x.target.value })}
                      />
                    </label>
                    <label>
                      <span className={ROTULO}>Para cuando</span>
                      <input
                        type="date"
                        className={CAMPO}
                        value={edicion.fecha}
                        onChange={(x) => setEdicion({ ...edicion, fecha: x.target.value })}
                      />
                    </label>
                    <label>
                      <span className={ROTULO}>Responsable</span>
                      <select
                        className={CAMPO}
                        value={edicion.responsable}
                        onChange={(x) =>
                          setEdicion({ ...edicion, responsable: Number(x.target.value) })
                        }
                      >
                        {equipo.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="sm:col-span-4 flex justify-end gap-2">
                      <button className={BOTON_CLARO} onClick={() => setEditando(null)}>
                        Cancelar
                      </button>
                      <button
                        className="bg-verde text-white text-[11px] font-semibold px-3 py-0.5 rounded disabled:opacity-50"
                        disabled={enCurso}
                        onClick={() =>
                          correr(() =>
                            editarCompromiso(
                              e.id,
                              idLead,
                              edicion.accion,
                              edicion.fecha,
                              edicion.responsable
                            )
                          )
                        }
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
