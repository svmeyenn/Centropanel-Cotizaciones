"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprobarEgreso, aprobarOrden, rechazarEgreso, rechazarOrden } from "@/app/aprobaciones/acciones";
import { dinero, fecha } from "@/lib/formato";

export interface ItemCola {
  clave: string;
  tipo: "egreso" | "orden";
  id: number;
  titulo: string;
  detalle: string;
  proyecto: string;
  solicita: string;
  fecha: string;
  monto: number;
  moneda: string;
  puede: boolean;
  enlace: string;
  // Enlace al respaldo adjunto, si lo tiene (los egresos).
  adjunto?: string | null;
}

export default function ColaAprobacion({ items }: { items: ItemCola[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function resolver(i: ItemCola, aprobar: boolean) {
    let motivo = "";
    if (!aprobar) {
      motivo = prompt("Motivo del rechazo:") ?? "";
      if (!motivo.trim()) return;
    }
    setError(null);
    empezar(async () => {
      const r =
        i.tipo === "egreso"
          ? aprobar
            ? await aprobarEgreso(i.id)
            : await rechazarEgreso(i.id, motivo)
          : aprobar
            ? await aprobarOrden(i.id)
            : await rechazarOrden(i.id, motivo);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  if (items.length === 0)
    return (
      <div className="bg-white border border-gray-200 rounded p-8 text-center text-gray-500 text-sm">
        No hay nada esperando aprobacion.
      </div>
    );

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Documento</th>
                <th className="text-left px-3 py-2">Proyecto</th>
                <th className="text-left px-3 py-2">Solicita</th>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-right px-3 py-2">Monto</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.clave} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <Link href={i.enlace} className="font-semibold text-verde hover:underline">
                      {i.titulo}
                    </Link>
                    <span className="block text-[11px] text-gray-500">{i.detalle}</span>
                    {i.adjunto && (
                      <a
                        href={i.adjunto}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-0.5 text-[11px] font-semibold text-verde underline underline-offset-2"
                      >
                        Ver documento adjunto
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">{i.proyecto || "Sin proyecto"}</td>
                  <td className="px-3 py-2">{i.solicita}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fecha(i.fecha)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{dinero(i.monto, i.moneda)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {i.puede ? (
                      <>
                        <button
                          disabled={pendiente}
                          onClick={() => resolver(i, true)}
                          className="bg-verde text-white font-semibold px-2.5 py-1 rounded mr-2 disabled:opacity-40"
                        >
                          Aprobar
                        </button>
                        <button
                          disabled={pendiente}
                          onClick={() => resolver(i, false)}
                          className="bg-gray-200 text-gray-700 font-semibold px-2.5 py-1 rounded disabled:opacity-40"
                        >
                          Rechazar
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400">Lo aprueba otra persona</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
