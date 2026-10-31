"use client";

import { Fragment, useMemo } from "react";
import { useRouter } from "next/navigation";
import { importe } from "@/lib/formato";
import { nombrePeriodo } from "@/lib/rrhh";

export interface FilaPlanilla {
  destino: string;
  concepto: string;
  tipo: string;
  persona: string;
  rut: string;
  monto: number;
  moneda: string;
}

const campo = "border border-gray-300 rounded px-2 py-1.5 text-sm bg-white";

export default function PlanillaPrevisional({
  periodo,
  idPais,
  paises,
  filas,
}: {
  periodo: string;
  idPais: number;
  paises: { id: number; nombre: string }[];
  filas: FilaPlanilla[];
}) {
  const router = useRouter();
  const moneda = filas[0]?.moneda ?? (idPais === 2 ? "PEN" : "CLP");

  const grupos = useMemo(() => {
    const m = new Map<string, { destino: string; tipo: string; total: number; detalle: FilaPlanilla[] }>();
    for (const f of filas) {
      const k = `${f.tipo}|${f.destino}`;
      const g = m.get(k) ?? { destino: f.destino, tipo: f.tipo, total: 0, detalle: [] };
      g.total += f.monto;
      g.detalle.push(f);
      m.set(k, g);
    }
    return Array.from(m.values()).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.destino.localeCompare(b.destino, "es"));
  }, [filas]);

  const total = (tipo: string) => grupos.filter((g) => g.tipo === tipo).reduce((s, g) => s + g.total, 0);

  function url(p: string, pais: number) {
    return `/rrhh/planilla?periodo=${p}${paises.length ? `&pais=${pais}` : ""}`;
  }

  function descargar() {
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const lineas = [["Tipo", "Destino", "Concepto", "Persona", "RUT / documento", "Monto"].map(esc).join(";")];
    for (const g of grupos) for (const f of g.detalle) lineas.push([g.tipo === "Aporte" ? "Aporte empleador" : "Descuento trabajador", g.destino, f.concepto, f.persona, f.rut, f.monto].map(esc).join(";"));
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `planilla-previsional-${periodo.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Mes</span>
          <input type="month" className={campo} value={periodo.slice(0, 7)} onChange={(e) => e.target.value && router.push(url(e.target.value, idPais))} />
        </label>
        {paises.length > 0 && (
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">Mercado</span>
            <select className={campo} value={idPais} onChange={(e) => router.push(url(periodo.slice(0, 7), Number(e.target.value)))}>
              {paises.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
        )}
        <button onClick={descargar} disabled={filas.length === 0} className="bg-verde text-white text-xs font-semibold px-3 py-2 rounded disabled:opacity-40">
          Descargar CSV
        </button>
        <span className="text-xs text-gray-500 ml-auto">Solo liquidaciones aprobadas y pagadas de {nombrePeriodo(periodo)}.</span>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Institucion o concepto</th>
                <th scope="col" className="text-left px-3 py-2">Origen</th>
                <th scope="col" className="text-right px-3 py-2">Personas</th>
                <th scope="col" className="text-right px-3 py-2">Total a pagar</th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 py-8">Sin liquidaciones aprobadas en el mes.</td>
                </tr>
              )}
              {grupos.map((g) => (
                <Fragment key={`${g.tipo}|${g.destino}`}>
                  <tr className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-2 font-semibold">{g.destino}</td>
                    <td className="px-3 py-2 text-gray-600">{g.tipo === "Aporte" ? "Aporte del empleador" : "Descontado al trabajador"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{new Set(g.detalle.map((d) => d.rut || d.persona)).size}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{importe(g.total, moneda)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            {grupos.length > 0 && (
              <tfoot className="border-t-2 border-gray-300 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right">Descontado a los trabajadores</td>
                  <td className="px-3 py-2 text-right tabular-nums">{importe(total("Descuento"), moneda)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right">Aportes del empleador</td>
                  <td className="px-3 py-2 text-right tabular-nums">{importe(total("Aporte"), moneda)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-500">El CSV trae el detalle por persona para cargar en el portal de cotizaciones. No reemplaza al archivo oficial de cada institucion (Previred, PDT-PLAME).</p>
    </div>
  );
}
