"use client";

import { useCallback, useEffect, useState } from "react";
import { listarAdjuntos, quitarAdjunto } from "@/app/egresos/acciones";
import type { Adjunto } from "@/lib/finanzas/tipos";

// Respaldos ya cargados de una solicitud de gasto: enlace de descarga --firmado,
// porque el deposito es privado-- y, si corresponde, el boton para quitarlo.
export default function ListaAdjuntos({
  idMov,
  puedeQuitar,
}: {
  idMov: number;
  puedeQuitar: boolean;
}) {
  const [adjuntos, setAdjuntos] = useState<
    (Adjunto & { url: string | null })[] | null
  >(null);
  const [error, setError] = useState("");
  const [confirmando, setConfirmando] = useState<Adjunto | null>(null);

  const cargar = useCallback(async () => {
    const r = await listarAdjuntos(idMov);
    if (r.ok) setAdjuntos(r.adjuntos);
    else setError(r.mensaje);
  }, [idMov]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function quitar(a: Adjunto) {
    setConfirmando(null);
    const r = await quitarAdjunto(a.id_adjunto, a.ruta);
    if (!r.ok) {
      setError(r.mensaje ?? "");
      return;
    }
    cargar();
  }

  if (error) return <p className="text-[11px] text-red-700">{error}</p>;
  if (adjuntos === null)
    return <p className="text-[11px] text-gray-500">Cargando respaldos...</p>;
  if (adjuntos.length === 0)
    return <p className="text-[11px] text-gray-500">Sin respaldos cargados.</p>;

  return (
    <ul className="text-xs space-y-1">
      {adjuntos.map((a) => (
        <li key={a.id_adjunto} className="flex items-center gap-2">
          {a.url ? (
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="text-verde font-semibold underline"
            >
              {a.nombre}
            </a>
          ) : (
            <span>{a.nombre}</span>
          )}
          {puedeQuitar &&
            (confirmando?.id_adjunto === a.id_adjunto ? (
              <span className="flex items-center gap-1 text-[11px]">
                <span className="text-gray-600">quitar?</span>
                <button
                  type="button"
                  className="text-red-700 font-semibold"
                  onClick={() => quitar(a)}
                >
                  si
                </button>
                <button
                  type="button"
                  className="text-gray-600"
                  onClick={() => setConfirmando(null)}
                >
                  no
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="text-[11px] text-gray-500 hover:text-red-700 underline"
                onClick={() => setConfirmando(a)}
              >
                quitar
              </button>
            ))}
        </li>
      ))}
    </ul>
  );
}
