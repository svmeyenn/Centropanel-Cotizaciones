"use client";

import { useState, useTransition } from "react";
import { ponerEnEspera, retomarEspera } from "@/app/espera/acciones";
import type { EsperaVigente } from "@/lib/espera";

// Dejar un lead o una cotizacion en espera del cliente, o retomarlo. Va arriba de
// la ficha: es lo que se decide justo despues de hablar con el cliente.
export default function ControlEspera({
  idLead,
  idCot,
  vigente,
  puedeEditar,
  zona,
}: {
  idLead: number | null;
  idCot: number | null;
  vigente: EsperaVigente | null;
  puedeEditar: boolean;
  zona: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  if (vigente) {
    const desde = new Date(vigente.desde).toLocaleDateString("es-CL", { timeZone: zona });
    const propia = vigente.tipo === "lead" ? idLead != null : idCot != null;
    return (
      <section aria-label="En espera del cliente" className="bg-amber-50 border border-amber-300 rounded px-3 py-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-amber-900">En espera del cliente</span>
          <span className="text-gray-700">
            desde el {desde}
            {vigente.quien ? ` · lo dejo ${vigente.quien}` : ""}
            {!propia && (vigente.tipo === "cotizacion" ? " · en una cotizacion de este lead" : " · en el lead de esta cotizacion")}
          </span>
          {puedeEditar && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setError("");
                  const r = await retomarEspera(vigente.id, vigente.id_clientify, vigente.id_cotizacion);
                  if (!r.ok) setError(r.mensaje ?? "No se pudo retomar.");
                })
              }
              className="ml-auto bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-60"
            >
              {pendiente ? "Retomando…" : "Retomar"}
            </button>
          )}
        </div>
        {vigente.motivo && <p className="mt-1 text-gray-800 whitespace-pre-wrap break-words">{vigente.motivo}</p>}
        <p className="mt-1 text-[10px] text-gray-600">
          Mientras este asi no sale en los pendientes del inicio ni en sus compromisos. Agendar un compromiso nuevo lo retoma.
        </p>
        {error && (
          <p className="mt-1 text-red-700" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (!puedeEditar) return null;

  return (
    <section aria-label="Dejar en espera" className="text-[11px]">
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="border border-amber-400 text-amber-900 bg-amber-50 font-semibold px-2.5 py-1 rounded"
        >
          Dejar en espera del cliente
        </button>
      ) : (
        <form
          className="bg-amber-50 border border-amber-300 rounded px-3 py-2 space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            empezar(async () => {
              setError("");
              const r = await ponerEnEspera(idLead, idCot, motivo);
              if (!r.ok) setError(r.mensaje ?? "No se pudo dejar en espera.");
              else {
                setAbierto(false);
                setMotivo("");
              }
            });
          }}
        >
          <label htmlFor={`motivo-espera-${idLead ?? "c"}${idCot ?? ""}`} className="block font-semibold text-amber-900">
            Dejar en espera del cliente
          </label>
          <p className="text-[10px] text-gray-700">
            Para cuando el cliente pidio que no lo molesten y se espera su respuesta. Sale de los pendientes del inicio y
            queda en el cuadro &quot;En espera del cliente&quot;. Sus compromisos sin cumplir dejan de aparecer en la agenda
            mientras tanto.
          </p>
          <textarea
            id={`motivo-espera-${idLead ?? "c"}${idCot ?? ""}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Que dijo el cliente (opcional)"
            className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pendiente} className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-60">
              {pendiente ? "Guardando…" : "Dejar en espera"}
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                setAbierto(false);
                setError("");
              }}
              className="border border-gray-300 px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
          {error && (
            <p className="text-red-700" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
