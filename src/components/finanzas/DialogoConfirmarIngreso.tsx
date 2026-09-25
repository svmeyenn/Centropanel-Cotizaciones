"use client";

import { useActionState, useEffect } from "react";
import { confirmarIngreso, type Resultado } from "@/app/ingresos/acciones";
import { pesos } from "@/lib/formato";
import type { Movimiento } from "@/lib/finanzas/tipos";

const hoy = () => new Date().toISOString().slice(0, 10);

// Confirma que un ingreso proyectado se recibio. La fecha viene con hoy y es
// editable, porque lo normal es confirmarlo el mismo dia pero no siempre.
export default function DialogoConfirmarIngreso({
  movimiento,
  alCerrar,
}: {
  movimiento: Movimiento;
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    confirmarIngreso,
    null
  );

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="bg-verde px-4 py-3 rounded-t-lg">
          <h2 className="text-white font-semibold">CONFIRMAR INGRESO RECIBIDO</h2>
        </div>

        <form action={enviar} className="p-4 space-y-3">
          <input type="hidden" name="id_mov" value={movimiento.id_mov} />

          <p className="text-sm">
            {movimiento.origen_destino} —{" "}
            <strong>{pesos(movimiento.monto)}</strong>
          </p>

          <div>
            <label className="etiqueta">Fecha en que se recibio</label>
            <input
              type="date"
              name="fecha"
              className="campo"
              defaultValue={movimiento.fecha?.slice(0, 10) ?? hoy()}
              required
              autoFocus
            />
          </div>

          <p className="text-xs text-gris">
            Al confirmar deja de estar proyectado: entra en la cartola y mueve
            el saldo de la cuenta.
          </p>

          {estado && !estado.ok && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {estado.mensaje}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              className="btn btn-sec"
              onClick={() => alCerrar()}
              disabled={pendiente}
            >
              CANCELAR
            </button>
            <button type="submit" className="btn" disabled={pendiente}>
              {pendiente ? "GUARDANDO..." : "CONFIRMAR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
