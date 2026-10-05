"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstado } from "@/app/cotizaciones/acciones";
import { etiquetaDe, ordenados } from "@/lib/catalogoEstados";
import { useCatalogoEstados } from "@/components/ProveedorEstados";

// Estado de una cotizacion, cambiable solo dentro de la cotizacion, junto al
// rotulo "Estado". Elegir un estado no lo graba: pide confirmarlo antes, para
// que un clic equivocado en el desplegable no cambie nada.
export default function SelectorEstado({
  id,
  estado,
  puedeEditar,
}: {
  id: number;
  estado: string;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const { cotizacion } = useCatalogoEstados();
  const [actual, setActual] = useState(estado);
  const [propuesto, setPropuesto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const nombre = (e: string) => etiquetaDe(cotizacion, e);
  if (!puedeEditar) return <span className="font-semibold">{nombre(actual)}</span>;

  // Los que se ofrecen, y el actual aunque ya no se ofrezca, para no cambiarlo
  // sin querer al abrir el desplegable.
  const opciones = ordenados(cotizacion).filter((x) => x.activo || x.codigo === actual);

  function confirmar() {
    if (!propuesto) return;
    const nuevo = propuesto;
    setError(null);
    empezar(async () => {
      const r = await cambiarEstado(id, nuevo);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setActual(nuevo);
      setPropuesto(null);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        value={propuesto ?? actual}
        disabled={pendiente}
        onChange={(e) => {
          setError(null);
          setPropuesto(e.target.value === actual ? null : e.target.value);
        }}
        className="border border-gray-300 rounded bg-white text-sm px-2 py-0.5 font-semibold text-gray-800 disabled:opacity-60"
        title="Cambiar el estado de la cotizacion"
      >
        {opciones.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      {propuesto && (
        <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-xs text-gray-700">
          <span>
            Cambiar de <b>{nombre(actual)}</b> a <b>{nombre(propuesto)}</b>?
          </span>
          <button
            onClick={confirmar}
            disabled={pendiente}
            className="bg-verde text-white font-semibold px-2 py-0.5 rounded disabled:opacity-50"
          >
            {pendiente ? "Cambiando..." : "Confirmar"}
          </button>
          <button
            onClick={() => setPropuesto(null)}
            disabled={pendiente}
            className="border border-gray-300 font-semibold px-2 py-0.5 rounded bg-white"
          >
            Cancelar
          </button>
        </span>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
