"use client";

import { useActionState, useEffect, useState } from "react";
import Ventana from "@/components/Ventana";
import {
  borrarEgreso,
  crearSolicitudEgreso,
  editarSolicitudEgreso,
  type Resultado,
} from "@/app/egresos/acciones";
import { pesos } from "@/lib/formato";
import type {
  Categoria,
  Cuenta,
  Interlocutor,
  Movimiento,
  Proyecto,
} from "@/lib/finanzas/tipos";
import SelectorInterlocutor from "./SelectorInterlocutor";
import ListaAdjuntos from "./ListaAdjuntos";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

// Solicitud de gasto: sin fecha ni estado --los fija quien paga-- y con
// respaldo obligatorio al crearla.
export default function FormularioEgreso({
  movimiento,
  cuentas,
  proyectos,
  categorias,
  interlocutores,
  puedePagar,
  alCerrar,
}: {
  movimiento: Movimiento | null;
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  categorias: Categoria[];
  interlocutores: Interlocutor[];
  puedePagar: boolean;
  alCerrar: (mensaje?: string) => void;
}) {
  const accion = movimiento ? editarSolicitudEgreso : crearSolicitudEgreso;
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    accion,
    null
  );

  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState("");

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  async function borrar() {
    if (!movimiento) return;
    setBorrando(true);
    const r = await borrarEgreso(movimiento.id_mov);
    setBorrando(false);
    if (r.ok) {
      alCerrar(r.mensaje);
    } else {
      setConfirmandoBorrado(false);
      setErrorBorrado(r.mensaje ?? "No se pudo eliminar.");
    }
  }

  const propias = categorias.filter(
    (c) =>
      c.tipo === "Egreso" &&
      (!c.borrado || c.id_categoria === movimiento?.id_categoria)
  );
  const proyectosDisponibles = proyectos.filter(
    (p) => (p.activo && !p.borrado) || p.id_proyecto === movimiento?.id_proyecto
  );

  return (
    <Ventana
      titulo={movimiento ? "Editar solicitud" : "Nueva solicitud de gasto"}
      subtitulo={
        movimiento
          ? undefined
          : "Queda pendiente y sin fecha de pago: la fija quien la pague"
      }
      onCerrar={() => alCerrar()}
      ancho="max-w-2xl"
    >
      <form action={enviar} className="grid gap-3 sm:grid-cols-2">
        {movimiento && (
          <input type="hidden" name="id_mov" value={movimiento.id_mov} />
        )}

        {/* La fecha de pago la fija quien paga, no quien solicita: no existe al
            crear la solicitud ni mientras siga pendiente. Una vez pagado, aqui
            mismo se corrige. */}
        {movimiento?.estado_pago === "Pagado" && puedePagar && (
          <div className="sm:col-span-2">
            <label className={ROTULO}>Fecha de pago</label>
            <input
              type="date"
              name="fecha"
              className={CAMPO}
              defaultValue={movimiento.fecha?.slice(0, 10) ?? ""}
              required
            />
          </div>
        )}

        <div>
          <label className={ROTULO}>Monto *</label>
          <input
            name="monto"
            inputMode="decimal"
            className={CAMPO}
            defaultValue={movimiento ? String(movimiento.monto) : ""}
            placeholder="0"
            required
          />
        </div>

        <div>
          <label className={ROTULO}>Cuenta *</label>
          <select
            name="id_cuenta"
            className={CAMPO}
            defaultValue={movimiento?.id_cuenta ?? ""}
            required
          >
            <option value="">Elija una cuenta</option>
            {cuentas.map((c) => (
              <option key={c.id_cuenta} value={c.id_cuenta}>
                {c.alias ?? c.banco}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <SelectorInterlocutor
            etiqueta="Destino"
            interlocutores={interlocutores}
            valorInicial={movimiento?.id_interlocutor ?? null}
          />
        </div>

        <div>
          <label className={ROTULO}>Proyecto / Cliente</label>
          <select
            name="id_proyecto"
            className={CAMPO}
            defaultValue={movimiento?.id_proyecto ?? ""}
          >
            <option value="">Sin proyecto</option>
            {proyectosDisponibles.map((p) => (
              <option key={p.id_proyecto} value={p.id_proyecto}>
                {p.nombre}
                {p.cliente ? ` - ${p.cliente}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ROTULO}>Categoria *</label>
          <select
            name="id_categoria"
            className={CAMPO}
            defaultValue={movimiento?.id_categoria ?? ""}
            required
          >
            <option value="">Elija una categoria</option>
            {propias.map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={ROTULO}>N cotizacion o factura</label>
          <input
            name="documento"
            className={CAMPO}
            defaultValue={movimiento?.documento ?? ""}
            maxLength={40}
          />
        </div>

        <div className="sm:col-span-2 bg-crema border border-gray-200 rounded px-3 py-2">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              name="es_anticipo"
              className="mt-0.5"
              defaultChecked={movimiento?.es_anticipo ?? false}
            />
            <span>
              Es un <strong>anticipo o fondo a rendir</strong>
              <span className="block text-[11px] text-gray-600">
                Plata que se entrega para que la persona gaste, no el pago de
                algo ya comprado. No cuenta como gasto del proyecto: el gasto
                aparece cuando rinde sus boletas.
              </span>
            </span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className={ROTULO}>Comentario *</label>
          <textarea
            name="comentario"
            className={CAMPO}
            rows={2}
            defaultValue={movimiento?.comentario ?? ""}
            required
          />
        </div>

        {movimiento && (
          <div className="sm:col-span-2">
            <label className={ROTULO}>Respaldos ya cargados</label>
            <ListaAdjuntos idMov={movimiento.id_mov} puedeQuitar={true} />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={ROTULO}>
            {movimiento
              ? "Agregar mas respaldo (opcional)"
              : "Respaldo: cotizacion o factura (obligatorio)"}
          </label>
          <input
            type="file"
            name="adjuntos"
            className="text-xs w-full"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            required={!movimiento}
          />
        </div>

        {estado && !estado.ok && (
          <p className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {estado.mensaje}
          </p>
        )}

        {errorBorrado && (
          <p className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {errorBorrado}
          </p>
        )}

        <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
          {movimiento && (
            <button
              type="button"
              className="border border-red-300 text-red-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
              onClick={() => setConfirmandoBorrado(true)}
              disabled={pendiente}
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
            onClick={() => alCerrar()}
            disabled={pendiente}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
            disabled={pendiente}
          >
            {pendiente ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      {confirmandoBorrado && movimiento && (
        <Ventana
          titulo="Eliminar solicitud"
          onCerrar={() => setConfirmandoBorrado(false)}
          ancho="max-w-sm"
        >
          <p className="text-xs text-gray-700 mb-4">
            Se eliminara la solicitud de{" "}
            <strong>{pesos(movimiento.monto)}</strong> y sus respaldos. No se
            puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
              onClick={() => setConfirmandoBorrado(false)}
              disabled={borrando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
              onClick={borrar}
              disabled={borrando}
            >
              {borrando ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </Ventana>
      )}
    </Ventana>
  );
}
