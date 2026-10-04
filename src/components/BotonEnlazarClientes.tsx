"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enlazarLeadsConClientes } from "@/app/clientify/acciones";

// Enlaza los leads con sus fichas de cliente sin tener que volver a cargar el
// archivo. Solo se ve para el Administrador.
export default function BotonEnlazarClientes() {
  const router = useRouter();
  const [pendiente, comenzar] = useTransition();
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  function enlazar() {
    setMensaje(null);
    comenzar(async () => {
      const r = await enlazarLeadsConClientes();
      setMensaje(
        r.error
          ? { texto: r.error, error: true }
          : {
              texto: `${r.enlazados} leads enlazados con su cliente.${
                r.pendientes > 0 ? ` ${r.pendientes} coinciden solo por telefono y quedan por revisar.` : ""
              }`,
              error: false,
            }
      );
      if (!r.error) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={enlazar}
        disabled={pendiente}
        title="Une cada lead con la ficha de cliente que es la misma persona (mismo email, o mismo telefono y nombre parecido)"
        className="border border-verde text-verde text-xs font-semibold px-3 py-1.5 rounded hover:bg-crema disabled:opacity-50"
      >
        {pendiente ? "Enlazando..." : "Enlazar leads con clientes"}
      </button>
      {mensaje && (
        <span className={`text-xs ${mensaje.error ? "text-red-600" : "text-green-700"}`} role="status">
          {mensaje.texto}
        </span>
      )}
    </div>
  );
}
