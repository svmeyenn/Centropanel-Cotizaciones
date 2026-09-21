"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Bandera from "@/components/Bandera";
import { elegirMercado } from "@/app/mercado/acciones";

// Pais en que se esta trabajando, igual que en la aplicacion de Finanzas: un
// boton con la bandera y el nombre que, al pulsarlo, despliega los paises.
// Quien trabaja uno solo ve el suyo, sin menu.
export default function SelectorMercado({
  paises,
  activo,
  puedeElegir,
}: {
  paises: { codigo: string; nombre: string }[];
  activo: string | null;
  puedeElegir: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, empezar] = useTransition();

  // "Todos" solo existe para quien trabaja los dos paises.
  const opciones = [
    ...paises,
    ...(puedeElegir ? [{ codigo: "todos", nombre: "Todos" }] : []),
  ];
  const actual = opciones.find((o) => o.codigo === (activo ?? "todos")) ?? opciones[0];

  function elegir(codigo: string) {
    setAbierto(false);
    if (codigo === (activo ?? "todos")) return;
    empezar(async () => {
      await elegirMercado(codigo as "CL" | "PE" | "todos");
      // Una ficha abierta (/cotizaciones/12) es de un pais: al cambiar se
      // vuelve al listado de esa seccion, que si existe en el otro.
      const seccion = ruta.split("/").filter(Boolean);
      if (seccion.length > 1) router.push(`/${seccion[0]}`);
      router.refresh();
    });
  }

  const boton =
    "inline-flex items-center gap-1.5 rounded bg-white/15 px-2 py-1 text-white text-xs font-semibold whitespace-nowrap";

  if (!puedeElegir) {
    return (
      <span className={boton} title="Pais en que trabaja su usuario">
        {actual && <Bandera codigo={actual.codigo} />}
        {actual?.nombre.toUpperCase()}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={pendiente}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Cambiar de pais"
        className={`${boton} hover:bg-white/25`}
      >
        {actual && <Bandera codigo={actual.codigo} />}
        {pendiente ? "CAMBIANDO..." : actual?.nombre.toUpperCase()}
        <span aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <ul
          role="menu"
          className="absolute right-0 mt-1 z-50 min-w-36 bg-white border border-gray-200 rounded shadow-md py-1"
        >
          {opciones.map((o) => (
            <li key={o.codigo}>
              <button
                type="button"
                role="menuitem"
                onClick={() => elegir(o.codigo)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-800 hover:bg-crema ${
                  o.codigo === (activo ?? "todos") ? "font-semibold" : ""
                }`}
              >
                <Bandera codigo={o.codigo} />
                {o.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
