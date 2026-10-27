"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Reversa un envio --de una solicitud o de una orden-- tras confirmarlo. Lo ya enviado al proveedor no se puede retirar.
export default function BotonReversar({
  etiqueta = "Reversar envio",
  confirmacion,
  accion,
}: {
  etiqueta?: string;
  confirmacion: string;
  accion: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function reversar() {
    if (!confirm(confirmacion)) return;
    setOcupado(true);
    setError(null);
    const r = await accion();
    setOcupado(false);
    if (!r.ok) return setError(r.error ?? "No se pudo reversar.");
    router.refresh();
  }
  return (
    <>
      <button type="button" onClick={reversar} disabled={ocupado} className="border border-red-300 bg-white text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40">
        {ocupado ? "Reversando..." : etiqueta}
      </button>
      {error && <span className="text-red-700 text-[11px]" role="alert">{error}</span>}
    </>
  );
}
