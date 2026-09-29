"use client";

import { useActionState, useEffect } from "react";
import Ventana from "@/components/Ventana";
import { pesos } from "@/lib/formato";
import { pasarLineaAlSistema, type Resultado } from "@/app/conciliacion/acciones";
import {
  etiquetaInterlocutor,
  etiquetaProyecto,
  fechaCorta,
  type Categoria,
  type Interlocutor,
  type LineaBanco,
  type Proyecto,
} from "@/lib/finanzas/tipos";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

// La plata se movio en el banco y el sistema no lo sabe. La fecha, el monto y
// el tipo no se preguntan: los dice la cartola. Lo que falta es lo que el banco
// no puede saber --a que proyecto y a que categoria imputarlo.
export default function PasarLineaAlSistema({
  linea,
  categorias,
  proyectos,
  interlocutores,
  alCerrar,
}: {
  linea: LineaBanco;
  categorias: Categoria[];
  proyectos: Proyecto[];
  interlocutores: Interlocutor[];
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    pasarLineaAlSistema,
    null
  );

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  const esEgreso = Number(linea.cargo) > 0;
  const monto = esEgreso ? Number(linea.cargo) : Number(linea.abono);
  const tipo = esEgreso ? "Egreso" : "Ingreso";

  const propias = categorias.filter((c) => c.tipo === tipo && !c.borrado);
  const activos = proyectos.filter((p) => p.activo && !p.borrado);
  const fichas = interlocutores.filter((i) => !i.borrado);

  return (
    <Ventana
      titulo={`Pasar al sistema como ${tipo.toLowerCase()}`}
      subtitulo="La fecha y el monto los pone el banco"
      onCerrar={() => alCerrar()}
      ancho="max-w-2xl"
    >
      <form action={enviar} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id_linea" value={linea.id_linea} />

        <div className="sm:col-span-2 bg-crema border border-gray-200 rounded px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-gray-600">{fechaCorta(linea.fecha)}</span>
            <strong
              className={`tabular-nums ${esEgreso ? "text-red-700" : "text-verde"}`}
            >
              {esEgreso ? "-" : "+"}
              {pesos(monto)}
            </strong>
          </div>
          <div>{linea.descripcion}</div>
          {linea.documento && (
            <div className="text-gray-500">Documento {linea.documento}</div>
          )}
        </div>

        <div>
          <label className={ROTULO}>Categoria</label>
          <select name="id_categoria" className={CAMPO} defaultValue="">
            <option value="">Sin clasificar</option>
            {propias.map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ROTULO}>Proyecto</label>
          <select name="id_proyecto" className={CAMPO} defaultValue="">
            <option value="">Sin proyecto</option>
            {activos.map((p) => (
              <option key={p.id_proyecto} value={p.id_proyecto}>
                {etiquetaProyecto(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={ROTULO}>
            {esEgreso ? "A quien se le pago" : "Quien deposito"}
          </label>
          <select name="id_interlocutor" className={CAMPO} defaultValue="">
            <option value="">Dejar el texto del banco</option>
            {fichas.map((i) => (
              <option key={i.id_interlocutor} value={i.id_interlocutor}>
                {etiquetaInterlocutor(i.razon_social, i.nombre_referencia)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-600 mt-0.5">
            Sin ficha, el movimiento queda con la descripcion del banco. Se puede
            completar despues desde {esEgreso ? "Egresos" : "Ingresos"}.
          </p>
        </div>

        <p className="sm:col-span-2 text-[11px] text-gray-600">
          Nace pagado, con la fecha del banco, y queda cuadrado con esta linea.
          Lo que se deje sin clasificar se puede corregir luego; el movimiento no
          va a faltar.
        </p>

        {estado && !estado.ok && (
          <p className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {estado.mensaje}
          </p>
        )}

        <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
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
            {pendiente ? "Creando..." : `Crear el ${tipo.toLowerCase()}`}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
