"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarPedido } from "@/app/pedidos/acciones";

// Eliminar el pedido desde su propia ficha: se borra estando adentro, viendo
// lo que se lleva por delante --las lineas y las solicitudes a proveedores--,
// y no de pasada en un listado.
//
// Hay que escribir el folio para confirmar. No es burocracia: el borrado no se
// puede deshacer, y un clic de mas en la fila equivocada no tiene vuelta.
export default function BorrarPedido({
  id,
  num,
  solicitudes,
}: {
  id: number;
  num: string;
  solicitudes: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const calza = texto.trim().toUpperCase() === num.trim().toUpperCase();

  return (
    <div className="bg-white border border-red-200 rounded overflow-hidden">
      <div className="bg-red-700 text-white text-xs font-semibold px-3 py-2">
        ELIMINAR EL PEDIDO
      </div>

      <div className="p-3 space-y-2">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
            {error}
          </div>
        )}

        {!abierto ? (
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-xs text-gray-600">
              Para el pedido emitido por error. La cotizacion queda aceptada y
              sin pedido, lista para volver a generarlo.
            </span>
            <button
              onClick={() => {
                setError(null);
                setTexto("");
                setAbierto(true);
              }}
              className="bg-red-700 text-white text-xs font-semibold px-3 py-1 rounded ml-auto"
            >
              Eliminar este pedido
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-700">
              Se elimina <strong>{num}</strong> con sus lineas
              {solicitudes > 0 && (
                <>
                  {" "}
                  y sus <strong>{solicitudes}</strong> solicitud(es) a
                  proveedores
                </>
              )}
              . No se puede deshacer. Si el pedido tiene pagos o documentos
              tributarios, primero hay que anularlos.
            </p>
            <label className="text-xs block">
              <span className="block text-dorado-osc font-semibold mb-1">
                Escriba {num} para confirmar
              </span>
              <input
                className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
                value={texto}
                autoFocus
                onChange={(e) => setTexto(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                disabled={!calza || pendiente}
                onClick={() =>
                  empezar(async () => {
                    setError(null);
                    const r = await eliminarPedido(id);
                    if (r?.error) {
                      setError(r.error);
                      return;
                    }
                    // La ficha ya no existe: se vuelve al listado.
                    router.push("/pedidos");
                  })
                }
                className="bg-red-700 text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
              >
                {pendiente ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
              <button
                onClick={() => setAbierto(false)}
                disabled={pendiente}
                className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
