"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generarPedido } from "@/app/pedidos/acciones";

// Emitir el pedido a partir de la cotizacion. Se pide confirmacion porque el
// paso no se deshace desde la aplicacion: la cotizacion queda congelada.
export default function BotonGenerarPedido({
  idCotizacion,
  numCotizacion,
  pedido,
  puede,
}: {
  idCotizacion: number;
  numCotizacion: string;
  pedido: { id: number; num: string } | null;
  puede: boolean;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  if (pedido) {
    return (
      <div className="bg-white border border-verde rounded p-4 text-sm flex flex-wrap items-center gap-3">
        <span className="text-gray-700">
          Esta cotizacion ya genero el pedido{" "}
          <strong className="text-verde">{pedido.num}</strong>, y por eso quedo
          congelada: lo que se edita ahora es el pedido.
        </span>
        <Link
          href={`/pedidos/${pedido.id}`}
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ml-auto"
        >
          Ir al pedido
        </Link>
      </div>
    );
  }

  if (!puede) return null;

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-2">
      <div className="text-sm font-semibold text-verde">Generar pedido</div>
      {!confirmar ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-600">
            Convierte {numCotizacion} en un pedido con las mismas lineas. Desde
            ahi se piden las materias primas a los proveedores.
          </p>
          <button
            onClick={() => setConfirmar(true)}
            className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded ml-auto"
          >
            Generar pedido
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 space-y-2">
          <p className="text-xs text-amber-900">
            Al generar el pedido, <strong>{numCotizacion} pasa a Aceptada y
            deja de poder modificarse</strong>. Lo que se edite despues se edita
            en el pedido. Esto no se deshace desde el sistema.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                empezar(async () => {
                  const r = await generarPedido(idCotizacion);
                  if (r?.error) {
                    setError(r.error);
                    setConfirmar(false);
                    return;
                  }
                  router.push(`/pedidos/${r.id}`);
                })
              }
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Generando..." : "Si, generar el pedido"}
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
