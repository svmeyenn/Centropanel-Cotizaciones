"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicarCotizacion } from "@/app/cotizaciones/acciones";
import { duplicarPedido } from "@/app/pedidos/acciones";

// Repetir una venta sin volver a armarla. Se copian cliente, condiciones e
// items con sus cantidades; el precio y el costo se toman frescos del
// catalogo, porque lo que se repite es lo que se vende, no lo que valia.
//
// Pide confirmar: crea un documento nuevo con su propio folio, y hacerlo sin
// querer deja un numero suelto que despues hay que explicar.
export default function BotonDuplicar({
  tipo,
  id,
}: {
  tipo: "cotizacion" | "pedido";
  id: number;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const esCot = tipo === "cotizacion";
  const nombre = esCot ? "cotizacion" : "pedido";

  function duplicar() {
    empezar(async () => {
      setError(null);
      const r = esCot ? await duplicarCotizacion(id) : await duplicarPedido(id);
      if (r?.error) {
        setError(r.error);
        setConfirmar(false);
        return;
      }
      router.push(esCot ? `/cotizaciones/${r.id}` : `/pedidos/${r.id}`);
    });
  }

  if (error) {
    return (
      <span className="text-xs text-red-700">
        {error}{" "}
        <button
          onClick={() => setError(null)}
          className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded ml-1"
        >
          reintentar
        </button>
      </span>
    );
  }

  if (confirmar) {
    return (
      <>
        <button
          onClick={duplicar}
          disabled={pendiente}
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
        >
          {pendiente ? "Duplicando..." : `Si, crear otro ${nombre}`}
        </button>
        <button
          onClick={() => setConfirmar(false)}
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
        >
          Cancelar
        </button>
      </>
    );
  }

  return (
    <button
      onClick={() => setConfirmar(true)}
      className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
      title={`Crea otro ${nombre} con los mismos productos y cantidades, con precios y costos actualizados`}
    >
      Duplicar {nombre}
    </button>
  );
}
