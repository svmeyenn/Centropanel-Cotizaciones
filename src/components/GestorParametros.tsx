"use client";

import { useState, useTransition } from "react";
import { guardarParametro } from "@/app/parametros/acciones";
import type { Parametro } from "@/types/database";

// Agrupacion para que la pantalla no sea una lista plana de 28 claves sueltas.
const GRUPOS: { titulo: string; claves: string[] }[] = [
  {
    titulo: "Empresa",
    claves: [
      "EmpresaNombre",
      "EmpresaMarca",
      "EmpresaGiro",
      "EmpresaRUT",
      "EmpresaDireccion",
      "EmpresaFono",
    ],
  },
  {
    titulo: "Datos bancarios",
    claves: ["Banco", "TipoCuenta", "NumeroCuenta", "CorreoConfirmacion"],
  },
  {
    titulo: "Calculo",
    claves: ["MargenObjetivo", "IVA", "AdhesivoRend1Cara", "AdhesivoRend2Caras", "AdhesivoIdMP"],
  },
  {
    titulo: "Cotizacion",
    claves: [
      "ValidezDias",
      "PrefijoCotizacion",
      "MedioPagoDefecto",
      "TiempoEntregaDefecto",
      "NotaTarifas",
      "NotaBodegaje",
      "CondDescarga",
    ],
  },
];

export default function GestorParametros({
  parametros,
}: {
  parametros: Parametro[];
}) {
  const [valores, setValores] = useState<Record<string, Parametro>>(
    Object.fromEntries(parametros.map((p) => [p.clave, p]))
  );
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const usadas = new Set(GRUPOS.flatMap((g) => g.claves));
  const otras = parametros.filter((p) => !usadas.has(p.clave)).map((p) => p.clave);

  function guardar(clave: string) {
    setError(null);
    setGuardado(null);
    const p = valores[clave];
    empezar(async () => {
      const r = await guardarParametro(clave, p.valor_num, p.valor_texto);
      if (r?.error) setError(r.error);
      else setGuardado(clave);
    });
  }

  function fila(clave: string) {
    const p = valores[clave];
    if (!p) return null;
    const esNumerico = p.valor_num != null;

    return (
      <div
        key={clave}
        className="grid md:grid-cols-[220px_1fr_auto] gap-2 items-start py-2 border-t border-gray-100"
      >
        <div>
          <div className="text-sm font-semibold text-gray-800">{clave}</div>
          {p.descripcion && (
            <div className="text-xs text-gray-500">{p.descripcion}</div>
          )}
        </div>
        {esNumerico ? (
          <input
            type="number"
            step="any"
            className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
            value={p.valor_num ?? ""}
            onChange={(e) =>
              setValores({
                ...valores,
                [clave]: {
                  ...p,
                  valor_num: e.target.value === "" ? null : Number(e.target.value),
                },
              })
            }
          />
        ) : (
          <textarea
            rows={(p.valor_texto ?? "").length > 70 ? 2 : 1}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
            value={p.valor_texto ?? ""}
            onChange={(e) =>
              setValores({
                ...valores,
                [clave]: { ...p, valor_texto: e.target.value },
              })
            }
          />
        )}
        <button
          onClick={() => guardar(clave)}
          disabled={pendiente}
          className="border border-verde text-verde text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
        >
          {guardado === clave ? "guardado" : "guardar"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded p-3">
        <strong>Cuidado.</strong> Estos valores cambian el calculo de todo el
        sistema. <code>MargenObjetivo</code> e <code>IVA</code> van como fraccion
        (0,30 = 30 %). Cambiar el margen no recostea los paneles ya guardados: para
        eso use <em>Materias primas → Solo recalcular catalogo</em>.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {GRUPOS.map((g) => (
        <div key={g.titulo} className="bg-white border border-gray-200 rounded">
          <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
            {g.titulo.toUpperCase()}
          </div>
          <div className="px-4 pb-3">{g.claves.map(fila)}</div>
        </div>
      ))}

      {otras.length > 0 && (
        <div className="bg-white border border-gray-200 rounded">
          <div className="bg-gray-500 text-white text-xs font-semibold px-3 py-2">
            OTROS
          </div>
          <div className="px-4 pb-3">{otras.map(fila)}</div>
        </div>
      )}
    </div>
  );
}
