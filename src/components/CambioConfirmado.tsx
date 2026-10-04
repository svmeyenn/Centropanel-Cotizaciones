"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Resultado } from "@/app/clientify/actividad-lead";

// Un valor que se cambia por su cuenta --el estado del lead, su linea--. El
// cambio no se aplica al elegir: primero se muestra de que a que, y solo se
// confirma con un segundo clic. Equivocarse de opcion no cuesta nada.
export default function CambioConfirmado({
  etiqueta,
  actual,
  nota,
  claveActual,
  opciones,
  puedeEditar,
  aviso,
  accion,
}: {
  etiqueta: string;
  // Lo que se lee hoy, ya en palabras.
  actual: string;
  // Aclaracion bajo el valor: de donde sale.
  nota?: string;
  // Cual de las opciones es la vigente.
  claveActual: string;
  opciones: { valor: string; texto: string }[];
  puedeEditar: boolean;
  // Lo que se le dice a quien va a confirmar.
  aviso: (desde: string, hasta: string) => string;
  accion: (valor: string) => Promise<Resultado>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(claveActual);
  const [error, setError] = useState("");
  const [pendiente, comenzar] = useTransition();

  const cambia = elegido !== claveActual;
  const textoDe = (valor: string) => opciones.find((o) => o.valor === valor)?.texto ?? valor;

  function cerrar() {
    setAbierto(false);
    setElegido(claveActual);
    setError("");
  }

  function confirmar() {
    setError("");
    comenzar(async () => {
      const r = await accion(elegido);
      if (!r.ok) {
        setError(r.mensaje ?? "No se pudo cambiar.");
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="text-[10px] font-semibold text-dorado-osc uppercase tracking-wide">
        {etiqueta}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="inline-block bg-crema border border-verde text-verde font-semibold rounded px-1.5 py-px">
          {actual || "—"}
        </span>
        {puedeEditar && !abierto && (
          <button
            type="button"
            onClick={() => {
              setElegido(claveActual);
              setAbierto(true);
            }}
            className="text-verde underline text-[10px]"
          >
            Cambiar
          </button>
        )}
      </div>
      {nota && !abierto && <div className="text-[10px] text-gray-500 mt-0.5">{nota}</div>}

      {abierto && (
        <div className="mt-1 space-y-1.5 rounded border border-gray-200 bg-crema px-2 py-1.5">
          <label className="block">
            <span className="sr-only">{etiqueta}</span>
            <select
              className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] w-full bg-white"
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              disabled={pendiente}
            >
              {opciones.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                  {o.valor === claveActual ? " (vigente)" : ""}
                </option>
              ))}
            </select>
          </label>

          {cambia ? (
            <p className="text-[11px] text-gray-800" role="status">
              {aviso(textoDe(claveActual), textoDe(elegido))}
            </p>
          ) : (
            <p className="text-[10px] text-gray-500">Elija el nuevo valor.</p>
          )}
          {error && (
            <p className="text-[11px] text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={cerrar}
              disabled={pendiente}
              className="border border-gray-300 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={!cambia || pendiente}
              className="bg-verde text-white text-[11px] font-semibold px-2.5 py-0.5 rounded disabled:opacity-50"
            >
              {pendiente ? "Guardando..." : "Confirmar cambio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
