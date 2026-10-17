"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { asignarAprobador, quitarAprobador } from "@/app/proyectos/acciones";

export default function AprobadoresProyecto({
  idProyecto,
  aprobadores,
  candidatos,
  heredaDe,
  puedeEditar,
}: {
  idProyecto: number;
  aprobadores: { id: number; nombre: string }[];
  // Personas con perfil Administrador que aun no aprueban este proyecto.
  candidatos: { id: number; nombre: string }[];
  // Proyecto cuyos aprobadores valen aqui (los paneles aprueban como uno solo).
  heredaDe: { id: number; nombre: string } | null;
  puedeEditar: boolean;
}) {
  const [elegido, setElegido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  if (heredaDe)
    return (
      <div className="bg-white border border-gray-200 rounded p-4 text-sm">
        <div className="font-semibold text-dorado-osc mb-1">Aprobadores</div>
        Los gastos de este proyecto los aprueban quienes aprueban{" "}
        <Link href={`/proyectos/${heredaDe.id}?tab=datos`} className="text-verde font-semibold hover:underline">
          {heredaDe.nombre}
        </Link>
        : los paneles se aprueban como un solo proyecto.
      </div>
    );

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-2">
      <div className="font-semibold text-dorado-osc text-sm">Aprobadores de gastos</div>
      <div className="text-xs text-gray-600">
        Ninguna orden de compra ni egreso de este proyecto se paga sin la aprobacion de alguien de esta lista. Solo
        pueden ser personas con perfil Administrador.
      </div>
      {error && <div className="text-xs text-red-700 font-semibold">{error}</div>}
      <ul className="text-sm">
        {aprobadores.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-0.5">
            <span className="font-semibold">{a.nombre}</span>
            {puedeEditar && (
              <button
                disabled={pendiente}
                className="text-red-700 text-xs hover:underline"
                onClick={() =>
                  empezar(async () => {
                    setError(null);
                    const r = await quitarAprobador(idProyecto, a.id);
                    if (r?.error) setError(r.error);
                  })
                }
              >
                Quitar
              </button>
            )}
          </li>
        ))}
        {aprobadores.length === 0 && (
          <li className="text-amber-700 text-xs">
            Sin aprobador asignado: mientras tanto aprueba cualquier Administrador.
          </li>
        )}
      </ul>
      {puedeEditar && candidatos.length > 0 && (
        <div className="flex gap-2 items-center">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-xs"
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
          >
            <option value="">Agregar aprobador...</option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {elegido && (
            <button
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
              onClick={() =>
                empezar(async () => {
                  setError(null);
                  const r = await asignarAprobador(idProyecto, Number(elegido));
                  if (r?.error) setError(r.error);
                  else setElegido("");
                })
              }
            >
              Agregar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
