"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Cuenta, Interlocutor, Proyecto } from "@/lib/finanzas/tipos";
import FiltroInterlocutor from "./FiltroInterlocutor";

// Filtros de los listados de finanzas, con la misma forma que los de
// cotizaciones y pedidos: un formulario que navega con querystring --sin
// javascript-- para que el filtro quede en la direccion y se pueda compartir.
//
// El origen/destino es la excepcion: se elige de una lista que busca mientras
// se escribe, asi que va aparte y se aplica solo.
export default function FiltrosMovimientos({
  base,
  cuentas,
  proyectos,
  interlocutores,
  etiquetaEstados,
  extra,
}: {
  base: string;
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  // Sin esta lista no se dibuja el filtro de origen/destino: la cartola no la
  // pasa, y ahi el filtro no aparece.
  interlocutores?: Interlocutor[];
  // "Recibido / Proyectado" en ingresos, "Pagado / Pendiente" en egresos.
  etiquetaEstados: { pagado: string; pendiente: string };
  extra?: React.ReactNode;
}) {
  const params = useSearchParams();
  const proyectosActivos = proyectos.filter((p) => p.activo && !p.borrado);
  const campo =
    "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";

  // Lo que elige el campo de origen/destino no esta en este formulario: viaja
  // escondido para que filtrar por fecha no lo pierda.
  const interlocutor = params.get("interlocutor") ?? "";
  const destino = params.get("destino") ?? "";
  const hayFiltro = [...params.keys()].length > 0;

  return (
    <div className="space-y-2">
      <form
        className="bg-white border border-gray-200 rounded p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        action={base}
      >
        {interlocutor && (
          <input type="hidden" name="interlocutor" value={interlocutor} />
        )}
        {destino && <input type="hidden" name="destino" value={destino} />}

        <Campo rotulo="Desde">
          <input
            type="date"
            name="desde"
            defaultValue={params.get("desde") ?? ""}
            className={campo}
          />
        </Campo>
        <Campo rotulo="Hasta">
          <input
            type="date"
            name="hasta"
            defaultValue={params.get("hasta") ?? ""}
            className={campo}
          />
        </Campo>
        <Campo rotulo="Cuenta">
          <select
            name="cuenta"
            defaultValue={params.get("cuenta") ?? ""}
            className={campo}
          >
            <option value="">Todas</option>
            {cuentas.map((c) => (
              <option key={c.id_cuenta} value={c.id_cuenta}>
                {c.alias ?? c.banco}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Proyecto">
          <select
            name="proyecto"
            defaultValue={params.get("proyecto") ?? ""}
            className={campo}
          >
            <option value="">Todos</option>
            {proyectosActivos.map((p) => (
              <option key={p.id_proyecto} value={p.id_proyecto}>
                {p.nombre}
                {p.cliente ? ` - ${p.cliente}` : ""}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Estado">
          <select
            name="estado"
            defaultValue={params.get("estado") ?? ""}
            className={campo}
          >
            <option value="">Todos</option>
            <option value="Pagado">{etiquetaEstados.pagado}</option>
            <option value="Pendiente">{etiquetaEstados.pendiente}</option>
          </select>
        </Campo>

        {interlocutores && (
          <FiltroInterlocutor
            interlocutores={interlocutores}
            valorId={interlocutor}
            valorTexto={destino}
          />
        )}

        <div className="flex items-end gap-2">
          <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">
            Filtrar
          </button>
          {hayFiltro && (
            <Link
              href={base}
              className="text-xs text-gray-600 underline self-center pb-1.5"
            >
              limpiar
            </Link>
          )}
          {extra}
        </div>
      </form>
    </div>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs">
      <span className="block text-dorado-osc font-semibold mb-0.5">{rotulo}</span>
      {children}
    </label>
  );
}
