"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buscarDuplicados, fusionarLeads, type Candidato } from "@/app/leads/fusion";
import { etiquetaDe, type Estado } from "@/lib/catalogoEstados";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white";

const lista = (xs: { email?: string; phone?: string }[] | null) =>
  (xs ?? []).map((x) => x.email ?? x.phone ?? "").filter(Boolean).join(", ");

// Fusionar un lead duplicado en este: el que se abre se conserva y recibe las
// conversaciones, compromisos, oportunidades, cotizaciones y datos del otro, que
// queda oculto de las listas. Es para quien administra.
export default function FusionLead({ idLead, estados }: { idLead: number; estados: Estado[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendiente, empezar] = useTransition();

  function buscar(q: string) {
    empezar(async () => {
      setError("");
      const r = await buscarDuplicados(idLead, q);
      if (!r.ok) {
        setError(r.mensaje);
        setCandidatos([]);
      } else setCandidatos(r.candidatos);
    });
  }

  // Al abrir se sugieren los que comparten correo, telefono o nombre.
  useEffect(() => {
    if (abierto && candidatos === null) buscar("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  if (aviso)
    return (
      <p className="text-[11px] text-green-700" role="status">
        {aviso}
      </p>
    );

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="border border-gray-300 text-gray-700 bg-white text-[11px] font-semibold px-2.5 py-1 rounded">
        Fusionar con un duplicado
      </button>
    );

  return (
    <section aria-label="Fusionar con un duplicado" className="bg-white border border-gray-200 rounded overflow-hidden text-[11px]">
      <div className="bg-verde text-white px-3 py-1 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase">Fusionar con un duplicado</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[11px] underline">
          Cerrar
        </button>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[10px] text-gray-600">
          Este lead se conserva. El duplicado que elija deja de aparecer en las listas y sus conversaciones, compromisos,
          oportunidades, cotizaciones, archivos y datos que falten pasan a este. Queda anotado en el historial.
        </p>

        {!elegido && (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                buscar(texto);
              }}
            >
              <label htmlFor="fusion-buscar" className="sr-only">
                Buscar el duplicado
              </label>
              <input
                id="fusion-buscar"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por nombre, correo, telefono o empresa"
                className={CAMPO}
              />
              <button type="submit" disabled={pendiente} className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50">
                Buscar
              </button>
            </form>

            {error && (
              <p className="text-red-700" role="alert">
                {error}
              </p>
            )}
            {pendiente && candidatos === null && <p className="text-gray-500">Buscando…</p>}
            {candidatos && candidatos.length === 0 && !pendiente && !error && (
              <p className="text-gray-500">
                {texto.trim() ? "Ningun lead coincide con lo que busco." : "No hay leads con el mismo correo, telefono o nombre. Busque uno a mano."}
              </p>
            )}
            {candidatos && candidatos.length > 0 && (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
                {candidatos.map((c) => (
                  <li key={c.id} className="px-2 py-1.5 flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">{c.nombre}</span>
                        {c.coincide && <span className="text-[10px] border border-amber-400 bg-amber-50 text-amber-900 rounded px-1">{c.coincide}</span>}
                        <span className="text-gray-500">{etiquetaDe(estados, c.estado)}</span>
                      </div>
                      <p className="text-[10px] text-gray-600 break-words">
                        {[c.empresa, lista(c.emails), lista(c.telefonos)].filter(Boolean).join(" · ") || "sin datos de contacto"}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {c.conversaciones} conversaciones · {c.oportunidades} oportunidades
                        {c.propietario ? ` · ${c.propietario}` : ""}
                        {c.creado ? ` · creado ${c.creado.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => setElegido(c)} className="border border-gray-300 font-semibold px-2 py-0.5 rounded">
                      Elegir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {elegido && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              empezar(async () => {
                setError("");
                const r = await fusionarLeads(idLead, elegido.id, motivo);
                if (!r.ok) return setError(r.mensaje ?? "No se pudo fusionar.");
                setAviso(r.mensaje ?? "Leads fusionados.");
                router.refresh();
              });
            }}
          >
            <p className="bg-amber-50 border border-amber-300 rounded px-2 py-1.5 text-amber-900">
              Se fusiona <strong>{elegido.nombre}</strong> ({elegido.conversaciones} conversaciones, {elegido.oportunidades} oportunidades) en este
              lead. Dejara de aparecer en las listas.
            </p>
            <div>
              <label htmlFor="fusion-motivo" className="block text-[11px] font-semibold text-dorado-osc mb-0.5">
                Motivo (opcional)
              </label>
              <input id="fusion-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} className={CAMPO} placeholder="Ej.: mismo cliente cargado dos veces" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pendiente} className="bg-red-700 text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50">
                {pendiente ? "Fusionando…" : "Fusionar"}
              </button>
              <button type="button" disabled={pendiente} onClick={() => setElegido(null)} className="border border-gray-300 px-2.5 py-1 rounded">
                Elegir otro
              </button>
            </div>
            {error && (
              <p className="text-red-700" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
