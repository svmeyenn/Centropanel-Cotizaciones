"use client";

import { useActionState, useEffect } from "react";
import Ventana from "@/components/Ventana";
import { reversarEgreso, type Resultado } from "@/app/egresos/acciones";
import { pesosConCentimos as pesos } from "@/lib/formato";
import { fechaCorta, type Movimiento } from "@/lib/finanzas/tipos";

// Deshace el pago de un egreso. Solo lo abre un Administrador. El egreso vuelve a
// Pendiente --aprobado, listo para pagarse otra vez--, sale de la cartola y deja
// anotado quien lo reverso y por que.
export default function DialogoReversar({
  movimiento,
  alCerrar,
}: {
  movimiento: Movimiento;
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    reversarEgreso,
    null
  );

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  return (
    <Ventana
      titulo="Reversar el pago"
      subtitulo="Solo un Administrador puede hacerlo"
      onCerrar={() => alCerrar()}
      ancho="max-w-sm"
    >
      <form action={enviar} className="space-y-3">
        <input type="hidden" name="id_mov" value={movimiento.id_mov} />

        <p className="text-xs text-gray-700">
          {movimiento.origen_destino} —{" "}
          <strong className="text-negro">{pesos(movimiento.monto)}</strong>
          {movimiento.fecha && <> · pagado el {fechaCorta(movimiento.fecha)}</>}
        </p>

        <p className="text-xs text-gray-600">
          El egreso vuelve a Pendiente y sale de la cartola, y el saldo de la cuenta se corrige.
          Queda aprobado para pagarlo de nuevo. No se puede reversar si ya esta conciliado con el
          banco.
        </p>

        <div>
          <label htmlFor="motivo-reversa" className="block text-xs font-semibold text-dorado-osc mb-0.5">
            Motivo de la reversa
          </label>
          <textarea
            id="motivo-reversa"
            name="motivo"
            rows={3}
            required
            minLength={5}
            maxLength={500}
            autoFocus
            className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white"
            placeholder="Por ejemplo: la transferencia fue rechazada por el banco"
          />
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
            className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
            disabled={pendiente}
          >
            {pendiente ? "Reversando..." : "Reversar pago"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
