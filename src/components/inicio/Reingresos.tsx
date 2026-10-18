"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanderaDe } from "@/components/Bandera";
import { atenderReingreso } from "@/app/leads/reingresos";
import { antiguedad, diasEntre } from "@/components/inicio/tipos";

export type Reingreso = {
  id: number;
  id_lead: number;
  nombre: string;
  propietario: string | null;
  estado: string;
  id_pais: number;
  fecha_meta: string;
  formulario: string | null;
  canal: string | null;
  via: "email" | "telefono";
  con_cotizacion: boolean;
  perdido: boolean;
};

// Contactos que ya eran lead y volvieron a escribir por Meta. Sin esta lista el
// reingreso pasaba inadvertido: el lead no cambiaba y nadie se enteraba.
export default function Reingresos({
  items,
  hoy,
  etiquetasEstado,
  verPropietario,
  puedeEditar,
}: {
  items: Reingreso[];
  hoy: string;
  etiquetasEstado: Record<string, string>;
  verPropietario: boolean;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  if (items.length === 0) return null;

  function atender(x: Reingreso, reabrir: boolean) {
    setError("");
    empezar(async () => {
      const r = await atenderReingreso(x.id, reabrir);
      if (!r.ok) setError(r.mensaje ?? "No se pudo.");
      else router.refresh();
    });
  }

  return (
    <section aria-labelledby="titulo-reingresos" className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-dorado text-white px-3 py-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-reingresos" className="text-[11px] font-semibold uppercase">
          Volvieron a contactar · {items.length}
        </h2>
        <span className="text-[10px] opacity-90">Ya eran leads y escribieron de nuevo por Meta</span>
      </div>
      {error && (
        <p className="px-3 py-1 text-[11px] text-red-700" role="alert">
          {error}
        </p>
      )}
      <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {items.map((x) => {
          const d = diasEntre(x.fecha_meta.slice(0, 10), hoy);
          return (
            <li key={x.id} className="flex flex-wrap items-start gap-x-2 gap-y-0.5 px-3 py-1.5 text-[11px]">
              <BanderaDe idPais={x.id_pais} />
              <div className="min-w-0 flex-1 basis-60">
                <p className="font-semibold break-words">
                  <Link href={`/leads/${x.id_lead}`} className="text-verde underline">
                    {x.nombre}
                  </Link>
                  <span className="ml-2 font-normal text-gray-600">
                    {etiquetasEstado[x.estado] ?? x.estado}
                    {x.con_cotizacion ? " · con cotizacion" : ""}
                  </span>
                </p>
                <p className="text-gray-600 break-words">
                  {[x.formulario, x.canal].filter(Boolean).join(" · ") || "Meta"}
                  {" · coincide por "}
                  {x.via === "email" ? "correo" : "telefono"}
                  {verPropietario && x.propietario ? ` · a cargo de ${x.propietario}` : ""}
                </p>
              </div>
              <span className="shrink-0 tabular-nums text-gray-600">{d <= 0 ? "hoy" : `hace ${antiguedad(d)}`}</span>
              {puedeEditar && (
                <span className="shrink-0 flex gap-1">
                  {x.perdido && (
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => atender(x, true)}
                      title="Devuelve el lead a Contactado"
                      className="rounded px-2 py-0.5 font-semibold bg-verde text-white disabled:opacity-50"
                    >
                      Reabrir
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => atender(x, false)}
                    className="rounded px-2 py-0.5 font-semibold border border-gray-300 text-gray-700 disabled:opacity-50"
                  >
                    Visto
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
