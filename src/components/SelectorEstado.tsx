"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstado } from "@/app/cotizaciones/acciones";
import { ESTADOS_COTIZACION } from "@/lib/estados";

// Estado de una cotizacion, cambiable ahi mismo: en el listado y en la
// cotizacion. Antes solo se movia solo (Emitida -> Enviada al enviarla, y a
// Aceptada al generar el pedido); Rechazada no tenia donde marcarse.
export default function SelectorEstado({
  id,
  estado,
  puedeEditar,
  compacto,
}: {
  id: number;
  estado: string;
  puedeEditar: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(estado);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  if (!puedeEditar) return <span>{estado}</span>;

  // Un estado viejo que ya no esta en la lista se ofrece igual, para no
  // cambiarlo sin querer al abrir el desplegable.
  const opciones = ESTADOS_COTIZACION.includes(valor)
    ? ESTADOS_COTIZACION
    : [valor, ...ESTADOS_COTIZACION];

  return (
    <span className="inline-flex flex-col">
      <select
        value={valor}
        disabled={pendiente}
        onChange={(e) => {
          const nuevo = e.target.value;
          const antes = valor;
          setValor(nuevo);
          setError(null);
          empezar(async () => {
            const r = await cambiarEstado(id, nuevo);
            if (r?.error) {
              setValor(antes);
              setError(r.error);
              return;
            }
            router.refresh();
          });
        }}
        className={`border border-gray-300 rounded bg-white disabled:opacity-60 ${
          compacto ? "text-xs px-1 py-0.5" : "text-sm px-2 py-1"
        }`}
        title="Cambiar el estado de la cotizacion"
      >
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </span>
  );
}
