"use client";

import { useActionState, useEffect, useState } from "react";
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
  const pagado = !sinFecha && estadoPago === "Pagado";

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
    <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl my-4">
        <div className="bg-verde px-4 py-3 rounded-t-lg">
          <h2 className="text-white font-semibold">
            {movimiento ? "EDITAR" : "NUEVO"} INGRESO
          </h2>
        </div>

        <form action={enviar} className="p-4 grid gap-3 sm:grid-cols-2">
          {movimiento && (
            <input type="hidden" name="id_mov" value={movimiento.id_mov} />
          )}

          <div>
            <label className="etiqueta">Fecha</label>
            <input
              type="date"
              name="fecha"
              className="campo"
              value={fecha}
              onChange={(e) => cambiarFecha(e.target.value)}
            />
            <p className="text-xs text-gris mt-1">
              {sinFecha
                ? "Sin fecha queda proyectado y no entra en la cartola."
                : "Para dejarlo proyectado, elija ese estado y la fecha se limpia sola."}
            </p>
          </div>

          <div>
            <label className="etiqueta">Monto</label>
            <input
              name="monto"
              inputMode="decimal"
              className="campo"
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
            <label className="etiqueta">Cuenta</label>
            <select
              name="id_cuenta"
              className="campo"
              defaultValue={movimiento?.id_cuenta ?? ""}
            >
              <option value="">(sin cuenta)</option>
              {cuentas.map((c) => (
                <option key={c.id_cuenta} value={c.id_cuenta}>
                  {c.alias ?? c.banco}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiqueta">Proyecto / Cliente</label>
            <select
              name="id_proyecto"
              className="campo"
              defaultValue={movimiento?.id_proyecto ?? ""}
            >
              <option value="">(sin proyecto)</option>
              {proyectosDisponibles.map((p) => (
                <option key={p.id_proyecto} value={p.id_proyecto}>
                  {p.nombre}
                  {p.cliente ? ` — ${p.cliente}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiqueta">Categoria</label>
            <select
              name="id_categoria"
              className="campo"
              defaultValue={movimiento?.id_categoria ?? ""}
            >
              <option value="">(sin categoria)</option>
              {propias.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiqueta">Estado</label>
            <select
              name="estado_pago"
              className="campo"
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
            <label className="etiqueta">Fecha en que se recibio</label>
            <input
              type="date"
              name="fecha_pago"
              className="campo"
              defaultValue={movimiento?.fecha_pago?.slice(0, 10) ?? ""}
              disabled={!pagado}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="etiqueta">Comentario</label>
            <textarea
              name="comentario"
              className="campo"
              rows={2}
              defaultValue={movimiento?.comentario ?? ""}
            />
          </div>

          {estado && !estado.ok && (
            <p className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {estado.mensaje}
            </p>
          )}

          {errorBorrado && (
            <p className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {errorBorrado}
            </p>
          )}

          <div className="sm:col-span-2 flex gap-2 justify-end pt-2">
            {movimiento && (
              <button
                type="button"
                className="btn btn-sec text-red-700"
                onClick={() => setConfirmandoBorrado(true)}
                disabled={pendiente}
              >
                BORRAR
              </button>
            )}
            <button
              type="button"
              className="btn btn-sec"
              onClick={() => alCerrar()}
              disabled={pendiente}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn" disabled={pendiente}>
              {pendiente ? "GUARDANDO..." : "GUARDAR"}
            </button>
          </div>
        </form>
      </div>

      {confirmandoBorrado && movimiento && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg w-full max-w-sm p-4">
            <p className="text-sm mb-4">
              Eliminar este ingreso por{" "}
              <strong>{pesos(movimiento.monto)}</strong>? No se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-sec"
                onClick={() => setConfirmandoBorrado(false)}
                disabled={borrando}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="btn text-red-700"
                onClick={borrar}
                disabled={borrando}
              >
                {borrando ? "ELIMINANDO..." : "ELIMINAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
