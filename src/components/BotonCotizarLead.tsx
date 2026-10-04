"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararCotizacionDesdeLead } from "@/app/leads/acciones-lead";

// Lleva a crear una cotizacion con el cliente del lead ya elegido. Si el lead
// todavia no tiene ficha de cliente, la deja lista antes de salir.
export default function BotonCotizarLead({ idLead }: { idLead: number }) {
  const router = useRouter();
  const [pendiente, comenzar] = useTransition();
  const [error, setError] = useState("");

  function ir() {
    setError("");
    comenzar(async () => {
      const r = await prepararCotizacionDesdeLead(idLead);
      if (r.error || !r.id_entidad) {
        setError(r.error ?? "No se pudo preparar el cliente.");
        return;
      }
      router.push(`/cotizaciones/nueva?cliente=${r.id_entidad}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      <button
        onClick={ir}
        disabled={pendiente}
        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
      >
        {pendiente ? "Preparando..." : "Crear cotizacion"}
      </button>
    </div>
  );
}
