"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Bandera from "@/components/Bandera";
import { elegirMercado } from "@/app/mercado/acciones";

// Selector de mercado para quien trabaja los dos paises. Son botones y no un
// desplegable porque un desplegable nativo no puede mostrar las banderas.
export default function SelectorMercado({
  paises,
  activo,
}: {
  paises: { codigo: string; nombre: string }[];
  activo: string | null;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const opciones = [
    ...paises.map((p) => ({ codigo: p.codigo, nombre: p.nombre })),
    { codigo: "todos", nombre: "Todos" },
  ];

  return (
    <div
      className={`flex items-center gap-1 ${pendiente ? "opacity-60" : ""}`}
      title="Mercado en que esta trabajando"
    >
      {opciones.map((o) => {
        const elegido = (activo ?? "todos") === o.codigo;
        return (
          <button
            key={o.codigo}
            type="button"
            disabled={pendiente || elegido}
            onClick={() =>
              empezar(async () => {
                await elegirMercado(o.codigo as "CL" | "PE" | "todos");
                router.refresh();
              })
            }
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded ${
              elegido
                ? "bg-white text-verde"
                : "bg-verde text-white ring-1 ring-white/40 hover:ring-white"
            }`}
          >
            <Bandera codigo={o.codigo} />
            {o.nombre}
          </button>
        );
      })}
    </div>
  );
}
