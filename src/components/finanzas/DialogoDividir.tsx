"use client";

import { useActionState, useEffect } from "react";
import Ventana from "@/components/Ventana";
import { dividirMovimiento, type Resultado } from "@/app/movimientos/acciones";
import { pesosConCentimos as pesos } from "@/lib/formato";
import type { Categoria, Movimiento, Proyecto } from "@/lib/finanzas/tipos";
import PartesGiro from "./PartesGiro";

// Abre un giro o abono que ya existe en varias partes, sin cambiar su total.
export default function DialogoDividir({
  movimiento,
  proyectos,
  categorias,
  alCerrar,
}: {
  movimiento: Movimiento;
  proyectos: Proyecto[];
  categorias: Categoria[];
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    dividirMovimiento,
    null
  );
  const esEgreso = movimiento.tipo === "Egreso";

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  return (
    <Ventana
      titulo={movimiento.detalle ? (esEgreso ? "Repartir el giro" : "Repartir el abono") : esEgreso ? "Dividir el giro en partes" : "Dividir el abono en partes"}
      subtitulo={`Total ${pesos(movimiento.monto)}: las partes deben sumar lo mismo`}
      onCerrar={() => alCerrar()}
      ancho="max-w-2xl"
    >
      <form action={enviar} className="grid gap-3">
        <input type="hidden" name="id_mov" value={movimiento.id_mov} />
        {movimiento.detalle && movimiento.id_grupo && (
          <input type="hidden" name="id_grupo" value={movimiento.id_grupo} />
        )}
        <PartesGiro
          proyectos={proyectos}
          categorias={categorias}
          etiquetaTotal={esEgreso ? "Total del giro" : "Total del abono"}
          categoriaObligatoria={esEgreso}
          comentarioObligatorio={esEgreso}
          objetivo={Number(movimiento.monto)}
          primeras={(movimiento.detalle ?? [movimiento]).map((x) => ({
            id_mov: movimiento.detalle ? x.id_mov : undefined,
            monto: String(x.monto),
            id_proyecto: x.id_proyecto ? String(x.id_proyecto) : "",
            id_categoria: x.id_categoria ? String(x.id_categoria) : "",
            comentario: x.comentario ?? "",
          }))}
        />
        {esEgreso && movimiento.estado_pago === "Pendiente" && (
          <p className="text-[11px] text-gray-600">
            Si el egreso ya estaba aprobado, cada parte se aprueba de nuevo.
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
            {pendiente ? "Dividiendo..." : "Dividir"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
