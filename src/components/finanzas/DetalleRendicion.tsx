"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pesos } from "@/lib/formato";
import Ventana from "@/components/Ventana";
import {
  aprobarRendicion,
  borrarRendicion,
  devolverABorrador,
  enviarRendicion,
  rechazarRendicion,
  resolverBoleta,
  type Resultado,
} from "@/app/rendiciones/acciones";
import {
  desenlaceRendicion,
  etiquetaInterlocutor,
  fechaCorta,
  type AnticipoAplicado,
  type BoletaRendicion,
  type Categoria,
  type Cuenta,
  type Proyecto,
  type Rendicion,
} from "@/lib/finanzas/tipos";
import ChipEstado from "./EstadoRendicion";
import FormularioBoleta from "./FormularioBoleta";
import PanelAnticipos, { type AnticipoDisponible } from "./PanelAnticipos";

const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white disabled:opacity-50";
const BOTON_VERDE =
  "bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50";
const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

// Mientras es Borrador la arma quien rinde; despues pasa a revision y deja de
// tocarse.
const editableAun = (estado: Rendicion["estado"]) => estado === "Borrador";
const enRevision = (estado: Rendicion["estado"]) => estado === "Enviada";

export default function DetalleRendicion({
  rendicion,
  boletas,
  anticipos,
  anticiposDisponibles,
  categorias,
  proyectos,
  cuentas,
  puedePagar,
  enlaces,
}: {
  rendicion: Rendicion;
  boletas: BoletaRendicion[];
  anticipos: AnticipoAplicado[];
  anticiposDisponibles: AnticipoDisponible[];
  categorias: Categoria[];
  proyectos: Proyecto[];
  cuentas: Cuenta[];
  puedePagar: boolean;
  enlaces: Record<number, string>;
}) {
  const router = useRouter();
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [editando, setEditando] = useState<BoletaRendicion | "nueva" | null>(null);
  const [aprobando, setAprobando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [rechazandoBoleta, setRechazandoBoleta] = useState<BoletaRendicion | null>(
    null
  );
  const [motivoBoleta, setMotivoBoleta] = useState("");

  const editable = editableAun(rendicion.estado) || puedePagar;
  const puedeAgregar = editableAun(rendicion.estado);
  // Solo vacia: sin boletas, anticipos ni reintegro. La base exige lo mismo.
  const vacia =
    boletas.length === 0 && anticipos.length === 0 && !rendicion.id_mov_reintegro;
  const puedeEliminar = vacia && (puedePagar || editableAun(rendicion.estado));

  const saldo = Number(rendicion.saldo);
  const desenlace = desenlaceRendicion(saldo, rendicion.estado);

  const nombreProyecto = (id: number | null) => {
    const p = proyectos.find((x) => x.id_proyecto === id);
    return p ? (p.cliente ? `${p.nombre} - ${p.cliente}` : p.nombre) : "";
  };
  const nombreCategoria = (id: number | null) =>
    categorias.find((c) => c.id_categoria === id)?.nombre ?? "";

  function correr(accion: () => Promise<Resultado>) {
    comenzar(async () => {
      const r = await accion();
      setAviso({ ok: r.ok, texto: r.mensaje ?? "" });
      if (r.ok) router.refresh();
    });
  }

  function eliminar() {
    comenzar(async () => {
      const r = await borrarRendicion(rendicion.id_rendicion);
      if (r.ok) {
        router.push("/rendiciones");
        return;
      }
      setConfirmandoBorrado(false);
      setAviso({ ok: false, texto: r.mensaje ?? "" });
    });
  }

  function cerrarDialogo(mensaje?: string) {
    setEditando(null);
    if (mensaje) {
      setAviso({ ok: true, texto: mensaje });
      router.refresh();
    }
  }

  return (
    <>
      {aviso && (
        <p
          className={`text-xs rounded px-3 py-2 border ${
            aviso.ok
              ? "bg-crema border-gray-200 text-gray-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* --- cabecera --- */}
      <section className="bg-white border border-gray-200 rounded p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wide text-dorado-osc font-semibold">
              Rinde
            </span>
            <h1 className="font-semibold text-base">
              {etiquetaInterlocutor(
                rendicion.razon_social,
                rendicion.nombre_referencia
              )}
            </h1>
            <p className="text-xs text-gray-600">
              Del {fechaCorta(rendicion.periodo_desde)} al{" "}
              {fechaCorta(rendicion.periodo_hasta)}
            </p>
          </div>
          <ChipEstado estado={rendicion.estado} />
        </div>

        {/* Quien rinde y quien carga no siempre son la misma persona: alguien
            de adentro puede transcribir boletas ajenas, y que eso quede a la
            vista es justamente el punto. */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span>
            <span className="text-gray-500">Cargada por </span>
            <strong>{rendicion.vendedor_nombre}</strong>
            {rendicion.cargada_por_tercero && (
              <span className="ml-2 border border-dorado text-dorado-osc rounded px-1.5 py-0.5 text-[10px] font-semibold">
                EN NOMBRE DE UN TERCERO
              </span>
            )}
          </span>
          {rendicion.aprobador_nombre && (
            <span>
              <span className="text-gray-500">Revisada por </span>
              <strong>{rendicion.aprobador_nombre}</strong>
              {rendicion.aprobada_en && (
                <span className="text-gray-500">
                  {" "}
                  el {fechaCorta(rendicion.aprobada_en.slice(0, 10))}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-4 text-xs">
          <Dato
            rotulo="Rendido aceptado"
            valor={pesos(rendicion.total_rendido)}
            nota={`${rendicion.boletas_aceptadas} boleta${
              Number(rendicion.boletas_aceptadas) === 1 ? "" : "s"
            }`}
          />
          <Dato
            rotulo="Rechazado"
            valor={pesos(rendicion.total_rechazado)}
            nota={`${rendicion.boletas_rechazadas} boleta${
              Number(rendicion.boletas_rechazadas) === 1 ? "" : "s"
            }`}
          />
          <Dato
            rotulo="Anticipos aplicados"
            valor={pesos(rendicion.total_anticipos)}
          />
          <Dato
            rotulo="Resultado"
            valor={desenlace.texto}
            nota={saldo !== 0 ? pesos(Math.abs(saldo)) : undefined}
            rojo={desenlace.retiene}
          />
        </div>

        {rendicion.motivo_rechazo && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            <strong>Rechazada:</strong> {rendicion.motivo_rechazo}
          </p>
        )}

        {/* Aprobar no paga: manda el reintegro a Egresos. Decir donde quedo
            evita que alguien lo busque aqui. */}
        {rendicion.id_mov_reintegro && (
          <p className="bg-crema border border-gray-200 text-xs rounded px-3 py-2">
            {rendicion.reintegro_estado === "Pagado" ? (
              <>
                Reintegro de <strong>{pesos(Math.abs(saldo))}</strong> pagado.
              </>
            ) : (
              <>
                Reintegro de <strong>{pesos(Math.abs(saldo))}</strong>{" "}
                <strong>pendiente de pago en Egresos</strong>. Se cierra sola
                cuando ese egreso se marque pagado.
              </>
            )}{" "}
            <Link href="/egresos" className="text-verde font-semibold underline">
              Ir a Egresos
            </Link>
          </p>
        )}

        {rendicion.estado === "Incompleta" && (
          <p className="bg-crema border border-gray-200 text-xs rounded px-3 py-2">
            Rindio menos de lo que se le adelanto. Queda pendiente de resolver: o
            rinde la diferencia en otra rendicion, o devuelve{" "}
            {pesos(Math.abs(saldo))} y eso entra como ingreso.
          </p>
        )}

        {/* --- acciones --- */}
        <div className="flex flex-wrap gap-2 pt-1">
          {puedeAgregar && (
            <button
              className={BOTON_VERDE}
              onClick={() => setEditando("nueva")}
              disabled={enCurso}
            >
              Agregar boleta
            </button>
          )}

          {editableAun(rendicion.estado) && boletas.length > 0 && (
            <button
              className={BOTON_CLARO}
              disabled={enCurso}
              onClick={() => correr(() => enviarRendicion(rendicion.id_rendicion))}
            >
              Enviar a revision
            </button>
          )}

          {puedePagar && enRevision(rendicion.estado) && (
            <>
              <button
                className={BOTON_VERDE}
                disabled={enCurso}
                onClick={() => setAprobando(true)}
              >
                Aprobar
              </button>
              <button
                className={BOTON_CLARO}
                disabled={enCurso}
                onClick={() =>
                  correr(() => devolverABorrador(rendicion.id_rendicion))
                }
              >
                Devolver a borrador
              </button>
              <button
                className={`${BOTON_CLARO} text-red-700`}
                disabled={enCurso}
                onClick={() => setRechazando(true)}
              >
                Rechazar
              </button>
            </>
          )}

          {/* Sin esto una Incompleta quedaba sin salida: si aparecen las
              boletas que faltaban, hay que poder reabrirla. */}
          {puedePagar &&
            (rendicion.estado === "Incompleta" ||
              rendicion.estado === "Rechazada") && (
              <button
                className={BOTON_VERDE}
                disabled={enCurso}
                onClick={() =>
                  correr(() => devolverABorrador(rendicion.id_rendicion))
                }
              >
                Reabrir para completar
              </button>
            )}

          {puedeEliminar && (
            <button
              className={`${BOTON_CLARO} text-red-700`}
              disabled={enCurso}
              onClick={() => setConfirmandoBorrado(true)}
            >
              Eliminar rendicion
            </button>
          )}
        </div>
      </section>

      {/* --- boletas --- */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2 w-[10%]">Fecha</th>
                <th className="text-left px-3 py-2 w-[20%]">Comercio</th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[12%]">
                  Categoria
                </th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[15%]">
                  Proyecto
                </th>
                <th className="text-right px-3 py-2 w-[11%]">Monto</th>
                <th className="text-left px-3 py-2 w-[9%]">Boleta</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell w-[11%]">
                  Cargo
                </th>
                <th className="text-left px-3 py-2 w-[10%]">Estado</th>
                <th className="px-3 py-2 w-[14%] min-w-[8rem]" />
              </tr>
            </thead>
            <tbody>
              {boletas.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8">
                    Todavia no hay boletas en esta rendicion.
                  </td>
                </tr>
              )}

              {boletas.map((b) => (
                <tr
                  key={b.id_gasto}
                  className={`border-t border-gray-100 hover:bg-crema ${
                    b.estado === "Rechazado" ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fechaCorta(b.fecha)}
                  </td>
                  <td className="px-3 py-2 truncate" title={b.comercio}>
                    {b.comercio}
                    {b.comentario && (
                      <span className="block text-[11px] text-gray-500 truncate">
                        {b.comentario}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-gray-600 truncate">
                    {nombreCategoria(b.id_categoria)}
                  </td>
                  <td
                    className="px-3 py-2 hidden md:table-cell text-gray-600 truncate"
                    title={nombreProyecto(b.id_proyecto)}
                  >
                    {nombreProyecto(b.id_proyecto)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {pesos(b.monto)}
                  </td>
                  <td className="px-3 py-2">
                    {enlaces[b.id_gasto] ? (
                      <a
                        href={enlaces[b.id_gasto]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-verde font-semibold underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    <span className="block text-[11px] text-gray-500 truncate">
                      {b.documento}
                    </span>
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell text-gray-600 truncate">
                    {b.vendedor_nombre}
                  </td>
                  <td className="px-3 py-2">
                    {b.estado === "Rechazado" ? (
                      <span
                        className="text-red-700"
                        title={b.motivo_rechazo ?? ""}
                      >
                        Rechazada
                      </span>
                    ) : (
                      <span>Aceptada</span>
                    )}
                    {/* La marca la pone la base al guardar, comparando con el
                        tope de la categoria: no bloquea, le dice a quien
                        revisa donde mirar. */}
                    {b.fuera_politica && (
                      <span
                        className="block mt-1 border border-dorado text-dorado-osc rounded px-1 py-0.5 text-[10px] font-semibold"
                        title={b.politica_motivo ?? ""}
                      >
                        FUERA DE POLITICA
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {editable && (
                        <button
                          className={BOTON_CLARO}
                          onClick={() => setEditando(b)}
                          disabled={enCurso}
                        >
                          Editar
                        </button>
                      )}
                      {puedePagar &&
                        enRevision(rendicion.estado) &&
                        (b.estado === "Aceptado" ? (
                          <button
                            className={`${BOTON_CLARO} text-red-700`}
                            disabled={enCurso}
                            onClick={() => {
                              setMotivoBoleta("");
                              setRechazandoBoleta(b);
                            }}
                          >
                            Rechazar
                          </button>
                        ) : (
                          <button
                            className={BOTON_CLARO}
                            disabled={enCurso}
                            onClick={() =>
                              correr(() =>
                                resolverBoleta(b.id_gasto, "Aceptado", null)
                              )
                            }
                          >
                            Aceptar
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {puedePagar && (
        <PanelAnticipos
          idRendicion={rendicion.id_rendicion}
          asociados={anticipos}
          disponibles={anticiposDisponibles}
          editable={
            rendicion.estado !== "Pagada" && rendicion.estado !== "Rechazada"
          }
        />
      )}

      {editando !== null && (
        <FormularioBoleta
          idRendicion={rendicion.id_rendicion}
          periodoDesde={fechaCorta(rendicion.periodo_desde)}
          periodoHasta={fechaCorta(rendicion.periodo_hasta)}
          boleta={editando === "nueva" ? null : editando}
          categorias={categorias}
          proyectos={proyectos}
          alCerrar={cerrarDialogo}
        />
      )}

      {aprobando && (
        <DialogoAprobar
          rendicion={rendicion}
          cuentas={cuentas}
          alCerrar={(mensaje) => {
            setAprobando(false);
            if (mensaje) {
              setAviso({ ok: true, texto: mensaje });
              router.refresh();
            }
          }}
        />
      )}

      {rechazando && (
        <DialogoRechazar
          idRendicion={rendicion.id_rendicion}
          alCerrar={(mensaje) => {
            setRechazando(false);
            if (mensaje) {
              setAviso({ ok: true, texto: mensaje });
              router.refresh();
            }
          }}
        />
      )}

      {rechazandoBoleta && (
        <Ventana
          titulo="Rechazar la boleta"
          subtitulo={rechazandoBoleta.comercio}
          onCerrar={() => setRechazandoBoleta(null)}
          ancho="max-w-lg"
        >
          <div className="space-y-3">
            <label className={ROTULO}>Por que se rechaza *</label>
            <textarea
              className={`${CAMPO} h-24`}
              value={motivoBoleta}
              onChange={(e) => setMotivoBoleta(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-gray-600">
              Lo va a leer quien rindio: rechazar una boleta no rechaza la
              rendicion entera.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className={BOTON_CLARO}
                onClick={() => setRechazandoBoleta(null)}
                disabled={enCurso}
              >
                Cancelar
              </button>
              <button
                className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                disabled={enCurso || motivoBoleta.trim() === ""}
                onClick={() => {
                  const b = rechazandoBoleta;
                  setRechazandoBoleta(null);
                  correr(() =>
                    resolverBoleta(b.id_gasto, "Rechazado", motivoBoleta)
                  );
                }}
              >
                Rechazar boleta
              </button>
            </div>
          </div>
        </Ventana>
      )}

      {confirmandoBorrado && (
        <Ventana
          titulo="Eliminar la rendicion"
          onCerrar={() => setConfirmandoBorrado(false)}
          ancho="max-w-lg"
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-700">
              No tiene boletas ni anticipos, asi que no se pierde nada mas.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className={BOTON_CLARO}
                onClick={() => setConfirmandoBorrado(false)}
                disabled={enCurso}
              >
                Cancelar
              </button>
              <button
                className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                onClick={eliminar}
                disabled={enCurso}
              >
                Eliminar
              </button>
            </div>
          </div>
        </Ventana>
      )}
    </>
  );
}

function Dato({
  rotulo,
  valor,
  nota,
  rojo,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  rojo?: boolean;
}) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wide text-dorado-osc font-semibold">
        {rotulo}
      </span>
      <strong className={`tabular-nums ${rojo ? "text-red-700" : ""}`}>
        {valor}
      </strong>
      {nota && <span className="block text-[11px] text-gray-500">{nota}</span>}
    </div>
  );
}

// Aprobar cierra la revision y deja el reintegro listo para pagarse en
// Egresos. La cuenta se elige aqui solo para que el egreso nazca con ella.
function DialogoAprobar({
  rendicion,
  cuentas,
  alCerrar,
}: {
  rendicion: Rendicion;
  cuentas: Cuenta[];
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    aprobarRendicion,
    null
  );

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  const saldo = Number(rendicion.saldo);
  const activas = cuentas.filter((c) => c.activa);

  return (
    <Ventana
      titulo="Aprobar la rendicion"
      subtitulo={etiquetaInterlocutor(
        rendicion.razon_social,
        rendicion.nombre_referencia
      )}
      onCerrar={() => alCerrar()}
      ancho="max-w-lg"
    >
      <form action={enviar} className="space-y-3">
        <input
          type="hidden"
          name="id_rendicion"
          value={rendicion.id_rendicion}
        />

        <div className="bg-crema border border-gray-200 rounded px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Rendido aceptado</span>
            <strong className="tabular-nums">
              {pesos(rendicion.total_rendido)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Anticipos aplicados</span>
            <strong className="tabular-nums">
              {pesos(rendicion.total_anticipos)}
            </strong>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1">
            <span>{saldo >= 0 ? "Se le reintegra" : "Queda debiendo"}</span>
            <strong
              className={`tabular-nums ${saldo < 0 ? "text-red-700" : ""}`}
            >
              {pesos(Math.abs(saldo))}
            </strong>
          </div>
        </div>

        {saldo > 0 && (
          <div>
            <label className={ROTULO}>Cuenta desde la que se pagara</label>
            <select name="id_cuenta" className={CAMPO} defaultValue="">
              <option value="">Se decide al pagar</option>
              {activas.map((c) => (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.alias ?? c.banco}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-600 mt-0.5">
              El reintegro queda pendiente en Egresos: aprobar no paga.
            </p>
          </div>
        )}

        {saldo < 0 && (
          <p className="text-xs text-gray-700">
            Rindio menos de lo que se le adelanto: la rendicion queda{" "}
            <strong>Incompleta</strong> y la diferencia sigue a su nombre.
          </p>
        )}

        {estado && !estado.ok && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {estado.mensaje}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className={BOTON_CLARO}
            onClick={() => alCerrar()}
            disabled={pendiente}
          >
            Cancelar
          </button>
          <button type="submit" className={BOTON_VERDE} disabled={pendiente}>
            {pendiente ? "Aprobando..." : "Aprobar"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}

function DialogoRechazar({
  idRendicion,
  alCerrar,
}: {
  idRendicion: number;
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    rechazarRendicion,
    null
  );

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  return (
    <Ventana
      titulo="Rechazar la rendicion"
      subtitulo="Vuelve a quien la presento, con el motivo"
      onCerrar={() => alCerrar()}
      ancho="max-w-lg"
    >
      <form action={enviar} className="space-y-3">
        <input type="hidden" name="id_rendicion" value={idRendicion} />

        <div>
          <label className={ROTULO}>Por que se rechaza *</label>
          <textarea name="motivo" className={`${CAMPO} h-24`} required autoFocus />
        </div>

        {estado && !estado.ok && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {estado.mensaje}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className={BOTON_CLARO}
            onClick={() => alCerrar()}
            disabled={pendiente}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
            disabled={pendiente}
          >
            {pendiente ? "Rechazando..." : "Rechazar"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
