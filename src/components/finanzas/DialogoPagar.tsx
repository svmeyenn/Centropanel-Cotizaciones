"use client";

import { useActionState, useEffect } from "react";
import Ventana from "@/components/Ventana";
import { guardarPago, type Resultado } from "@/app/egresos/acciones";
import { pesos } from "@/lib/formato";
import type { Movimiento } from "@/lib/finanzas/tipos";
import ListaAdjuntos from "./ListaAdjuntos";

const hoy = () => new Date().toISOString().slice(0, 10);

// Marca un egreso como pagado, o corrige la fecha de uno ya pagado. La fecha
// viene con hoy y siempre es editable. El respaldo se muestra sin poder
// quitarlo: es lo que se esta revisando antes de pagar.
export default function DialogoPagar({
  movimiento,
  alCerrar,
}: {
  movimiento: Movimiento;
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    guardarPago,
    null
  );
  const yaPagado = movimiento.estado_pago === "Pagado";

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  return (
    <Ventana
      titulo={yaPagado ? "Editar fecha de pago" : "Marcar como pagado"}
      subtitulo="Al pagarlo entra en la cartola y mueve el saldo de la cuenta"
      onCerrar={() => alCerrar()}
      ancho="max-w-sm"
    >
      <form action={enviar} className="space-y-3">
        <input type="hidden" name="id_mov" value={movimiento.id_mov} />

        <p className="text-xs text-gray-700">
          {movimiento.origen_destino} —{" "}
          <strong className="text-negro">{pesos(movimiento.monto)}</strong>
        </p>

        <div>
          <label className="block text-xs font-semibold text-dorado-osc mb-0.5">
            Fecha de pago
          </label>
          <input
            type="date"
            name="fecha"
            className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white"
            defaultValue={movimiento.fecha?.slice(0, 10) ?? hoy()}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-dorado-osc mb-0.5">
            Respaldo
          </label>
          <ListaAdjuntos idMov={movimiento.id_mov} puedeQuitar={false} />
        </div>

        {estado && !estado.ok && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {estado.mensaje}
          </p>
        )}

        <div className="flex gap-2 justify-end pt-1">
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
            {pendiente
              ? "Guardando..."
              : yaPagado
                ? "Guardar fecha"
                : "Confirmar pago"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
