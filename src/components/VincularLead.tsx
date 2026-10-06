"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buscarCotizacionesParaLead,
  buscarLeadsParaCotizacion,
  desvincularCotizacion,
  vincularCotizacion,
  type CotizacionBuscada,
  type LeadBuscado,
} from "@/app/cotizaciones/vinculo";
import { dinero } from "@/lib/formato";
import { etiquetaDe, type Estado } from "@/lib/catalogoEstados";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white";
const lista = (xs: { email?: string; phone?: string }[] | null) =>
  (xs ?? []).map((x) => x.email ?? x.phone ?? "").filter(Boolean).join(", ");

// Desde una cotizacion: buscar el lead y vincularlo a mano.
export function VincularLeadACotizacion({ idCot, estadosLead }: { idCot: number; estadosLead: Estado[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [leads, setLeads] = useState<LeadBuscado[] | null>(null);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="border border-gray-300 text-gray-700 bg-white text-[11px] font-semibold px-2.5 py-1 rounded">
        Vincular a un lead
      </button>
    );

  return (
    <div className="border border-gray-200 rounded p-2 space-y-1.5 text-[11px]">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          empezar(async () => {
            setError("");
            const r = await buscarLeadsParaCotizacion(idCot, texto);
            if (!r.ok) setError(r.mensaje);
            else setLeads(r.leads);
          });
        }}
      >
        <label htmlFor="vinc-lead-q" className="sr-only">
          Buscar el lead
        </label>
        <input id="vinc-lead-q" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, correo, telefono o empresa del lead" className={CAMPO} />
        <button type="submit" disabled={pendiente || texto.trim().length < 2} className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50">
          Buscar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="underline text-gray-600">
          Cerrar
        </button>
      </form>
      {error && (
        <p className="text-red-700" role="alert">
          {error}
        </p>
      )}
      {leads && leads.length === 0 && <p className="text-gray-500">Ningun lead de este mercado coincide.</p>}
      {leads && leads.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
          {leads.map((l) => (
            <li key={l.id} className="px-2 py-1.5 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{l.nombre}</span>{" "}
                <span className="text-gray-500">{etiquetaDe(estadosLead, l.estado)}</span>
                <p className="text-[10px] text-gray-600 break-words">
                  {[l.empresa, lista(l.emails), lista(l.telefonos), l.propietario].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  empezar(async () => {
                    setError("");
                    const r = await vincularCotizacion(idCot, l.id);
                    if (!r.ok) setError(r.mensaje ?? "No se pudo vincular.");
                    else {
                      setAbierto(false);
                      router.refresh();
                    }
                  })
                }
                className="bg-verde text-white font-semibold px-2 py-0.5 rounded disabled:opacity-50"
              >
                Vincular
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Quitar un vinculo hecho a mano.
export function QuitarVinculo({ idCot, idLead }: { idCot: number; idLead: number | null }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();
  if (!confirmando)
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="text-red-700 underline text-[11px]">
        Quitar vinculo
      </button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px] text-red-700">
      ¿Quitar el vinculo manual?
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            const r = await desvincularCotizacion(idCot, idLead);
            if (!r.ok) setError(r.mensaje ?? "No se pudo quitar.");
            else router.refresh();
          })
        }
        className="bg-red-700 text-white font-semibold px-2 py-0.5 rounded disabled:opacity-50"
      >
        Si
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="underline text-gray-700">
        No
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}

// Desde un lead: buscar la cotizacion y vincularla a mano.
export function VincularCotizacionALead({ idLead, estadosCotizacion }: { idLead: number; estadosCotizacion: Estado[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [cots, setCots] = useState<CotizacionBuscada[] | null>(null);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="border border-gray-300 text-gray-700 bg-white text-[11px] font-semibold px-2.5 py-1 rounded">
        Vincular una cotizacion
      </button>
    );

  return (
    <div className="border border-gray-200 rounded p-2 space-y-1.5 text-[11px] bg-white">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          empezar(async () => {
            setError("");
            const r = await buscarCotizacionesParaLead(idLead, texto);
            if (!r.ok) setError(r.mensaje);
            else setCots(r.cotizaciones);
          });
        }}
      >
        <label htmlFor="vinc-cot-q" className="sr-only">
          Buscar la cotizacion
        </label>
        <input id="vinc-cot-q" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Folio o cliente de la cotizacion" className={CAMPO} />
        <button type="submit" disabled={pendiente || texto.trim().length < 2} className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50">
          Buscar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="underline text-gray-600">
          Cerrar
        </button>
      </form>
      {error && (
        <p className="text-red-700" role="alert">
          {error}
        </p>
      )}
      {cots && cots.length === 0 && <p className="text-gray-500">Ninguna cotizacion de este mercado coincide.</p>}
      {cots && cots.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
          {cots.map((c) => (
            <li key={c.id} className="px-2 py-1.5 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{c.folio ?? c.id}</span>{" "}
                <span className="text-gray-500">{etiquetaDe(estadosCotizacion, c.estado)}</span>
                <p className="text-[10px] text-gray-600 break-words">
                  {[c.cliente, c.fecha?.slice(0, 10), c.total != null ? dinero(c.total, c.moneda ?? "CLP") : null, c.vendedor].filter(Boolean).join(" · ")}
                </p>
                {c.vinculada_a_otro && <p className="text-[10px] text-amber-800">Esta vinculada a mano a otro lead: al vincularla aqui pasa a este.</p>}
              </div>
              {c.ya_vinculada ? (
                <span className="text-green-700">Ya vinculada</span>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() =>
                    empezar(async () => {
                      setError("");
                      const r = await vincularCotizacion(c.id, idLead);
                      if (!r.ok) setError(r.mensaje ?? "No se pudo vincular.");
                      else {
                        setAbierto(false);
                        router.refresh();
                      }
                    })
                  }
                  className="bg-verde text-white font-semibold px-2 py-0.5 rounded disabled:opacity-50"
                >
                  Vincular
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
