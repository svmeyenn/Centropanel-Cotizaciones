"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// De quien es la gestion que se mira. Solo lo ve quien dirige o consulta: un
// vendedor siempre ve lo suyo, y eso lo decide la base, no esta lista.
export default function SelectorAlcance({
  valor,
  yo,
  equipo,
}: {
  // "equipo", "yo" o el id de una persona.
  valor: string;
  yo: number;
  equipo: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-600">
      <span>Ver la gestion de</span>
      <select
        value={valor}
        disabled={pendiente}
        onChange={(e) =>
          empezar(() =>
            router.push(e.target.value === "equipo" ? "/" : `/?quien=${e.target.value}`, { scroll: false })
          )
        }
        className="border border-gray-300 rounded bg-white px-2 py-0.5 text-xs disabled:opacity-60"
      >
        <option value="equipo">Todo el equipo</option>
        <option value="yo">Mi propia gestion</option>
        {equipo
          .filter((p) => p.id !== yo)
          .map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.nombre}
            </option>
          ))}
      </select>
    </label>
  );
}
