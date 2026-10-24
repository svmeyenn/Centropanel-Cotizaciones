"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import IconoTrabajoPrevio from "@/components/IconoTrabajoPrevio";
import { marcarTrabajoPrevio } from "@/app/leads/edicion-lead";
import { fecha } from "@/lib/formato";

// La marca de "trabajo previo" en la ficha del lead: hay que desarrollar, investigar o hacer calculos
// mas sofisticados antes de dar una respuesta. La nota dice que hay que hacer. Aparece en la lista
// "Leads con trabajo previo" del inicio hasta que se quita.
export default function MarcaTrabajoPrevio({
  idLead,
  marca,
  puedeEditar,
}: {
  idLead: number;
  marca: { nota: string | null; desde: string | null; por: string | null } | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState(marca?.nota ?? "");
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  function enviar(activo: boolean) {
    setError("");
    empezar(async () => {
      const r = await marcarTrabajoPrevio(idLead, activo, nota);
      if (!r.ok) return setError(r.mensaje ?? "No se pudo guardar.");
      setAbierto(false);
      if (!activo) setNota("");
      router.refresh();
    });
  }

  if (!marca && !puedeEditar) return null;

  return (
    <section aria-label="Trabajo previo" className="bg-white border border-gray-200 rounded px-3 py-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`inline-flex items-center gap-1.5 font-semibold ${marca ? "text-dorado-osc" : "text-gray-700"}`}>
          <IconoTrabajoPrevio className="h-4 w-4" />
          Trabajo previo
        </span>
        {marca ? (
          <span className="text-gray-700">
            Marcado{marca.desde ? ` el ${fecha(marca.desde.slice(0, 10))}` : ""}
            {marca.por ? ` por ${marca.por}` : ""}
            {marca.nota ? `: ${marca.nota}` : ""}
          </span>
        ) : (
          <span className="text-gray-500">Desarrollo, investigacion o calculos mas sofisticados antes de responder.</span>
        )}
        {puedeEditar && !abierto && (
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={() => setAbierto(true)} className="border border-gray-300 text-gray-800 font-semibold px-2 py-0.5 rounded bg-white">
              {marca ? "Editar nota" : "Marcar trabajo previo"}
            </button>
            {marca && (
              <button type="button" disabled={pendiente} onClick={() => enviar(false)} className="border border-gray-300 text-gray-800 font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50">
                Quitar marca
              </button>
            )}
          </span>
        )}
      </div>
      {abierto && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[16rem]">
            <label htmlFor={`nota-tp-${idLead}`} className="block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5">
              Que hay que hacer antes de responder
            </label>
            <input
              id={`nota-tp-${idLead}`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={300}
              autoFocus
              placeholder="Por ejemplo: calcular la luz libre del galpon"
              className="border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white"
            />
          </div>
          <button type="button" disabled={pendiente} onClick={() => enviar(true)} className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50">
            {pendiente ? "Guardando..." : marca ? "Guardar nota" : "Marcar"}
          </button>
          <button type="button" disabled={pendiente} onClick={() => { setAbierto(false); setNota(marca?.nota ?? ""); }} className="border border-gray-300 text-gray-800 font-semibold px-2.5 py-1 rounded bg-white">
            Cancelar
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-red-700" role="alert">{error}</p>}
    </section>
  );
}
