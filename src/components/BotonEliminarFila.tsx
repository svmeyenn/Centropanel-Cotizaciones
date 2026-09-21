"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarCotizacion } from "@/app/cotizaciones/acciones";
import { eliminarPedido } from "@/app/pedidos/acciones";

// Eliminar desde el listado, que es donde se ve que un documento sobra. Pide
// confirmacion en la misma fila y solo lo ve el administrador. Lo que impide
// el borrado --un pedido ya generado, pagos o factura-- lo decide la base.
export default function BotonEliminarFila({
  tipo,
  id,
  num,
}: {
  tipo: "cotizacion" | "pedido";
  id: number;
  num: string;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  if (error) {
    return (
      <span className="text-red-700" title={error}>
        no se pudo{" "}
        <button
          onClick={() => setError(null)}
          className="underline text-gray-500"
        >
          ver
        </button>
      </span>
    );
  }

  if (!confirmar) {
    return (
      <button
        onClick={() => setConfirmar(true)}
        className="text-red-700 underline"
        title={`Eliminar ${num} definitivamente`}
      >
        eliminar
      </button>
    );
  }

  return (
    <span className="inline-flex gap-1.5 items-center">
      <button
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            const r =
              tipo === "cotizacion"
                ? await eliminarCotizacion(id)
                : await eliminarPedido(id);
            if (r?.error) {
              setError(r.error);
              setConfirmar(false);
              return;
            }
            router.refresh();
          })
        }
        className="bg-red-700 text-white font-semibold px-2 py-0.5 rounded disabled:opacity-50"
      >
        {pendiente ? "..." : "si"}
      </button>
      <button onClick={() => setConfirmar(false)} className="text-gray-600 underline">
        no
      </button>
    </span>
  );
}
