"use client";

import { useState, useTransition } from "react";
import { sincronizarClientify } from "@/app/leads/acciones";

export default function BotonSincronizarClientify({
  deshabilitado,
  motivo,
}: {
  deshabilitado: boolean;
  motivo?: string;
}) {
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  function sincronizar() {
    setMensaje(null);
    empezar(async () => {
      const r = await sincronizarClientify();
      setMensaje(
        r.error
          ? { texto: r.error, error: true }
          : {
              texto: `Listo: ${r.leidos} contactos leidos, ${r.quitados} quitados.`,
              error: false,
            }
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={sincronizar}
        disabled={deshabilitado || pendiente}
        title={deshabilitado ? motivo : undefined}
        className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
      {pendiente && (
        <span className="text-xs text-gray-500">Puede tardar un minuto; no cierre la pagina.</span>
      )}
      {mensaje && (
        <span
          className={`text-xs ${mensaje.error ? "text-red-600" : "text-green-700"}`}
          role="status"
        >
          {mensaje.texto}
        </span>
      )}
    </div>
  );
}
