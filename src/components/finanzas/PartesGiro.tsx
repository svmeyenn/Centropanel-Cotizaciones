"use client";

import { useState } from "react";
import { pesosConCentimos as pesos } from "@/lib/formato";
import { leerMontoLibre } from "@/lib/formato";
import {
  etiquetaProyecto,
  type Categoria,
  type Proyecto,
} from "@/lib/finanzas/tipos";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";

export type Parte = {
  // Solo al repartir un giro que ya existe: la parte que se conserva.
  id_mov?: number;
  monto: string;
  id_proyecto: string;
  id_categoria: string;
  comentario: string;
};

const vacia = (): Parte => ({ monto: "", id_proyecto: "", id_categoria: "", comentario: "" });

// Un giro o abono del banco abierto en varias partes: cada una con su monto,
// proyecto y categoria. Viajan como un solo campo `partes` (JSON); la suma es
// lo que ve el banco.
export default function PartesGiro({
  proyectos,
  categorias,
  etiquetaTotal,
  categoriaObligatoria,
  comentarioObligatorio,
  primeras,
  objetivo,
}: {
  proyectos: Proyecto[];
  categorias: Categoria[];
  etiquetaTotal: string;
  categoriaObligatoria: boolean;
  comentarioObligatorio: boolean;
  // Al dividir un movimiento que ya existe: lo que trae la primera parte y el
  // total que las partes deben sumar.
  primeras?: Parte[];
  objetivo?: number;
}) {
  const [partes, setPartes] = useState<Parte[]>(primeras && primeras.length >= 2 ? primeras : [...(primeras ?? [vacia()]), vacia()]);

  const total = partes.reduce((t, p) => {
    const n = leerMontoLibre(p.monto);
    return t + (Number.isFinite(n) ? n : 0);
  }, 0);

  function cambiar(i: number, campo: keyof Parte, valor: string) {
    setPartes((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  }

  return (
    <div className="sm:col-span-2 border border-gray-200 rounded bg-crema px-3 py-2 space-y-2">
      <input type="hidden" name="partes" value={JSON.stringify(partes)} />

      {partes.map((p, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr] items-start border-b border-gray-200 pb-2 last:border-0">
          <div>
            <label className="block text-[11px] font-semibold text-dorado-osc mb-0.5">
              Parte {i + 1} - monto
            </label>
            <input
              inputMode="decimal"
              className={CAMPO}
              value={p.monto}
              onChange={(e) => cambiar(i, "monto", e.target.value)}
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-dorado-osc mb-0.5">Proyecto / Cliente</label>
            <select
              className={CAMPO}
              value={p.id_proyecto}
              onChange={(e) => cambiar(i, "id_proyecto", e.target.value)}
            >
              <option value="">Sin proyecto</option>
              {proyectos.map((pr) => (
                <option key={pr.id_proyecto} value={pr.id_proyecto}>
                  {etiquetaProyecto(pr)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-dorado-osc mb-0.5">
              Categoria{categoriaObligatoria ? " *" : ""}
            </label>
            <select
              className={CAMPO}
              value={p.id_categoria}
              onChange={(e) => cambiar(i, "id_categoria", e.target.value)}
              required={categoriaObligatoria}
            >
              <option value="">{categoriaObligatoria ? "Elija una categoria" : "Sin categoria"}</option>
              {categorias.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3 flex gap-2 items-center">
            <input
              className={CAMPO}
              value={p.comentario}
              onChange={(e) => cambiar(i, "comentario", e.target.value)}
              placeholder={comentarioObligatorio ? "Concepto de esta parte *" : "Concepto de esta parte"}
              required={comentarioObligatorio}
            />
            {partes.length > 2 && i > 0 && (
              <button
                type="button"
                className="text-xs text-red-700 border border-red-300 rounded px-2 py-1 bg-white whitespace-nowrap"
                onClick={() => setPartes((ps) => ps.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs font-semibold border border-gray-300 rounded px-2.5 py-1 bg-white"
          onClick={() => setPartes((ps) => [...ps, vacia()])}
        >
          + Agregar parte
        </button>
        <span className="text-xs">
          {etiquetaTotal}: <strong>{pesos(total)}</strong>
          {objetivo != null && (
            <span className={Math.round(total) === Math.round(objetivo) ? "text-verde" : "text-red-700"}>
              {" "}
              (debe sumar {pesos(objetivo)}
              {Math.round(total) === Math.round(objetivo) ? ": cuadra" : `, faltan ${pesos(objetivo - total)}`})
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
