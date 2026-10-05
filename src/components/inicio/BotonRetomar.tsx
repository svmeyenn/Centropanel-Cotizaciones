"use client";

import { useState, useTransition } from "react";
import { retomarEspera } from "@/app/espera/acciones";

export default function BotonRetomar({ id, idLead, idCot }: { id: number; idLead: number | null; idCot: number | null }) {
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            setError("");
            const r = await retomarEspera(id, idLead, idCot);
            if (!r.ok) setError(r.mensaje ?? "No se pudo retomar.");
          })
        }
        className="text-[10px] text-verde underline disabled:opacity-60"
      >
        {pendiente ? "Retomando…" : "Retomar"}
      </button>
      {error && (
        <span className="text-[10px] text-red-700" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
