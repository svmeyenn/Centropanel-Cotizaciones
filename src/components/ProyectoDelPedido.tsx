"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asociarPedidoAProyecto } from "@/app/proyectos/acciones";

// El pedido de venta cuelga de un proyecto: ahi se ve el presupuesto de la obra,
// el cronograma y las compras que la abastecen.
export default function ProyectoDelPedido({
  idPedido,
  actual,
  proyectos,
  puedeEditar,
}: {
  idPedido: number;
  actual: { id: number; nombre: string } | null;
  proyectos: { id: number; nombre: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function asociar(id: number | null) {
    setError(null);
    empezar(async () => {
      const r = await asociarPedidoAProyecto(idPedido, id);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
      <span className="font-semibold text-dorado-osc">Proyecto:</span>
      {actual ? (
        <Link href={`/proyectos/${actual.id}`} className="text-verde font-semibold hover:underline">
          {actual.nombre}
        </Link>
      ) : (
        <span className="text-gray-500">sin proyecto</span>
      )}
      {puedeEditar && (
        <>
          <select
            className="border border-gray-300 rounded px-2 py-1"
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
          >
            <option value="">{actual ? "cambiar a..." : "asociar a..."}</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {elegido && (
            <button
              disabled={pendiente}
              onClick={() => asociar(Number(elegido))}
              className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-40"
            >
              Asociar
            </button>
          )}
          {!actual && (
            <button
              disabled={pendiente}
              onClick={() => asociar(null)}
              className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-40"
            >
              Crear proyecto desde este pedido
            </button>
          )}
        </>
      )}
      {error && <span className="text-red-700 font-semibold">{error}</span>}
    </div>
  );
}
