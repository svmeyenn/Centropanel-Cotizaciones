"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recostearPedido } from "@/app/pedidos/acciones";
import { importe } from "@/lib/formato";

// Recostea este pedido y solo este: pasa el costo de sus lineas al vigente del catalogo.
// El recosteo general no toca los pedidos; esta es la unica via. Un pedido con facturas
// no se recostea (la base lo rechaza y aqui el boton ni aparece).
export default function BotonRecostearPedido({ id, moneda }: { id: number; moneda: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  function recostear() {
    setMensaje(null);
    empezar(async () => {
      const r = await recostearPedido(id);
      setConfirmando(false);
      if (r.error) setMensaje({ ok: false, texto: r.error });
      else {
        setMensaje({
          ok: true,
          texto:
            r.lineas === 0
              ? "El costo de este pedido ya estaba al dia."
              : `Pedido recosteado: ${r.lineas} linea(s). Costo total ${importe(r.antes, moneda)} → ${importe(r.despues, moneda)}.`,
        });
        router.refresh();
      }
    });
  }

  return (
    <>
      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          title="Lleva el costo de las lineas de este pedido al costo vigente. Solo este pedido."
        >
          Recostear pedido
        </button>
      ) : (
        <span className="inline-flex items-center gap-2 text-xs bg-amber-50 border border-amber-300 text-amber-900 rounded px-2 py-1">
          Se actualizara el costo de este pedido (y su margen) al vigente. No afecta a otros pedidos.
          <button
            onClick={recostear}
            disabled={pendiente}
            className="bg-verde text-white font-semibold px-2.5 py-0.5 rounded disabled:opacity-50"
          >
            {pendiente ? "Recosteando..." : "Recostear"}
          </button>
          <button
            onClick={() => setConfirmando(false)}
            className="border border-gray-300 bg-white text-gray-800 font-semibold px-2.5 py-0.5 rounded"
          >
            Cancelar
          </button>
        </span>
      )}
      {mensaje && (
        <span className={`text-xs font-semibold ${mensaje.ok ? "text-green-700" : "text-red-700"}`}>
          {mensaje.texto}
        </span>
      )}
    </>
  );
}
