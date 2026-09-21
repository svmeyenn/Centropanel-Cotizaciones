"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarCotizacion } from "@/app/cotizaciones/acciones";
import { eliminarPedido } from "@/app/pedidos/acciones";

// Eliminar una cotizacion o un pedido emitido por error. Solo lo ve el
// administrador y pide confirmacion, porque no se deshace: no hay papelera.
// Lo que impide el borrado --un pedido ya generado, pagos o factura-- lo
// decide la base y llega como mensaje.
export default function BotonEliminarDocumento({
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

  const esCot = tipo === "cotizacion";
  const lista = esCot ? "/cotizaciones" : "/pedidos";
  const arrastra = esCot
    ? "Se borran tambien sus items."
    : "Se borran tambien sus lineas y las solicitudes a proveedores.";

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-2">
      <div className="text-sm font-semibold text-verde">
        Eliminar {esCot ? "la cotizacion" : "el pedido"}
      </div>
      {!confirmar ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-600">
            Para un documento emitido por error o duplicado. {arrastra}
          </p>
          <button
            onClick={() => {
              setError(null);
              setConfirmar(true);
            }}
            className="bg-red-700 text-white text-xs font-semibold px-3 py-1 rounded ml-auto"
          >
            Eliminar
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 space-y-2">
          <p className="text-xs text-amber-900">
            Se eliminara <strong>{num}</strong> de forma definitiva. {arrastra}{" "}
            Esto no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                empezar(async () => {
                  const r = esCot
                    ? await eliminarCotizacion(id)
                    : await eliminarPedido(id);
                  if (r?.error) {
                    setError(r.error);
                    setConfirmar(false);
                    return;
                  }
                  router.push(lista);
                  router.refresh();
                })
              }
              disabled={pendiente}
              className="bg-red-700 text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Eliminando..." : `Si, eliminar ${num}`}
            </button>
            <button
              onClick={() => setConfirmar(false)}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
          {error}
        </div>
      )}
    </div>
  );
}
