"use client";

import { useActionState, useEffect, useState } from "react";
import Ventana from "@/components/Ventana";
import {
  borrarIngreso,
  guardarIngreso,
  type Resultado,
} from "@/app/ingresos/acciones";
import { pesos } from "@/lib/formato";
import type {
  Categoria,
  Cuenta,
  Interlocutor,
  Movimiento,
  Proyecto,
} from "@/lib/finanzas/tipos";
import SelectorInterlocutor from "./SelectorInterlocutor";

const hoy = () => new Date().toISOString().slice(0, 10);
const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

export default function FormularioIngreso({
  movimiento,
  cuentas,
  proyectos,
  categorias,
  interlocutores,
  alCerrar,
}: {
  movimiento: Movimiento | null;
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  categorias: Categoria[];
  interlocutores: Interlocutor[];
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    guardarIngreso,
    null
  );
  const [fecha, setFecha] = useState(movimiento?.fecha?.slice(0, 10) ?? hoy());
  const [estadoPago, setEstadoPago] = useState(
    movimiento?.estado_pago ?? "Pendiente"
  );
  const sinFecha = fecha === "";
  const recibido = !sinFecha && estadoPago === "Pagado";

  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState("");

  // Estado y fecha son dos caras de lo mismo: la fecha es la del cobro, asi que
  // un proyectado no puede tenerla. Se mantienen sincronizados desde cualquiera
  // de los dos campos.
  function cambiarEstado(v: "Pendiente" | "Pagado") {
    setEstadoPago(v);
    if (v === "Pendiente") setFecha("");
    else if (fecha === "") setFecha(hoy());
  }

  function cambiarFecha(v: string) {
    setFecha(v);
    if (v === "") setEstadoPago("Pendiente");
  }

  async function borrar() {
    if (!movimiento) return;
    setBorrando(true);
    const r = await borrarIngreso(movimiento.id_mov);
    setBorrando(false);
    if (r.ok) {
      alCerrar(r.mensaje);
    } else {
      setConfirmandoBorrado(false);
      setErrorBorrado(r.mensaje ?? "No se pudo eliminar.");
    }
  }

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  const propias = categorias.filter(
    (c) =>
      c.tipo === "Ingreso" &&
      (!c.borrado || c.id_categoria === movimiento?.id_categoria)
  );
  // Solo proyectos vigentes, salvo el que ya tenia asignado este movimiento.
  const proyectosDisponibles = proyectos.filter(
    (p) => (p.activo && !p.borrado) || p.id_proyecto === movimiento?.id_proyecto
  );

  return (
    <Ventana
      titulo={movimiento ? "Editar ingreso" : "Nuevo ingreso"}
      subtitulo={
        sinFecha
          ? "Sin fecha queda proyectado y no entra en la cartola"
          : "Con fecha y recibido entra en la cartola y mueve el saldo"
      }
      onCerrar={() => alCerrar()}
      ancho="max-w-2xl"
    >
      <form action={enviar} className="grid gap-3 sm:grid-cols-2">
        {movimiento && (
          <input type="hidden" name="id_mov" value={movimiento.id_mov} />
        )}

        <div>
          <label className={ROTULO}>Fecha</label>
          <input
            type="date"
            name="fecha"
            className={CAMPO}
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
          />
        </div>

        <div>
          <label className={ROTULO}>Monto</label>
          <input
            name="monto"
            inputMode="decimal"
            className={CAMPO}
            defaultValue={movimiento ? String(movimiento.monto) : ""}
            placeholder="0"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <SelectorInterlocutor
            etiqueta="Origen"
            interlocutores={interlocutores}
            valorInicial={movimiento?.id_interlocutor ?? null}
          />
        </div>

        <div>
          <label className={ROTULO}>Cuenta</label>
          <select
            name="id_cuenta"
            className={CAMPO}
            defaultValue={movimiento?.id_cuenta ?? ""}
          >
            <option value="">Sin cuenta</option>
            {cuentas.map((c) => (
              <option key={c.id_cuenta} value={c.id_cuenta}>
                {c.alias ?? c.banco}
              </option>
            ))}
          </select>
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
          <label className={ROTULO}>Categoria</label>
          <select
            name="id_categoria"
            className={CAMPO}
            defaultValue={movimiento?.id_categoria ?? ""}
          >
            <option value="">Sin categoria</option>
            {propias.map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ROTULO}>Estado</label>
          <select
            name="estado_pago"
            className={CAMPO}
            value={estadoPago}
            onChange={(e) =>
              cambiarEstado(e.target.value as "Pendiente" | "Pagado")
            }
          >
            <option value="Pendiente">Proyectado</option>
            <option value="Pagado">Recibido</option>
          </select>
        </div>

        <div>
          <label className={ROTULO}>Fecha en que se recibio</label>
          <input
            type="date"
            name="fecha_pago"
            className={`${CAMPO} disabled:bg-gray-50 disabled:text-gray-400`}
            defaultValue={movimiento?.fecha_pago?.slice(0, 10) ?? ""}
            disabled={!recibido}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={ROTULO}>Comentario</label>
          <textarea
            name="comentario"
            className={CAMPO}
            rows={2}
            defaultValue={movimiento?.comentario ?? ""}
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
          titulo="Eliminar ingreso"
          onCerrar={() => setConfirmandoBorrado(false)}
          ancho="max-w-sm"
        >
          <p className="text-xs text-gray-700 mb-4">
            Se eliminara el ingreso de{" "}
            <strong>{pesos(movimiento.monto)}</strong>. No se puede deshacer.
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
