"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanderaDe } from "@/components/Bandera";
import Ventana from "@/components/Ventana";
import ListaBuscable from "@/components/transportes/ListaBuscable";
import { importe, monedaDelPais } from "@/lib/formato";
import { COLOR_ESTADO_LIQ, folioLiquidacion, nombrePeriodo } from "@/lib/rrhh";
import { crearLiquidacion, generarLiquidaciones } from "@/app/rrhh/acciones";
import type { Pais } from "@/types/database";

export interface FilaLiquidacion {
  id: number;
  id_pais: number;
  id_personal: number;
  nombre: string;
  clase: string;
  tipo: string;
  estado: string;
  liquido: number | null;
  costo: number | null;
  moneda: string | null;
  calculada: boolean;
}

interface Pendiente {
  id: number;
  id_pais: number;
  texto: string;
  honorarios: boolean;
}

const campo = "border border-gray-300 rounded px-2 py-1.5 text-sm bg-white";

export default function GestorLiquidaciones({
  periodo,
  filas,
  pendientes,
  paises,
  esAdminGeneral,
  puedeOperar,
}: {
  periodo: string;
  filas: FilaLiquidacion[];
  pendientes: Pendiente[];
  paises: Pais[];
  esAdminGeneral: boolean;
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [idPais, setIdPais] = useState<number>(paises[0]?.id ?? 1);
  const [aviso, setAviso] = useState<{ creadas: number; errores: { nombre: string; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [individual, setIndividual] = useState(false);
  const [persona, setPersona] = useState<number | null>(null);
  const [dias, setDias] = useState("30");
  const [bruto, setBruto] = useState("");

  const sel = pendientes.find((p) => p.id === persona) ?? null;
  const paisesConDatos = Array.from(new Set(filas.map((f) => f.id_pais)));
  const totales = new Map<string, { liquido: number; costo: number }>();
  for (const f of filas) {
    const m = f.moneda ?? monedaDelPais(f.id_pais);
    const t = totales.get(m) ?? { liquido: 0, costo: 0 };
    t.liquido += f.liquido ?? 0;
    t.costo += f.costo ?? 0;
    totales.set(m, t);
  }
  const resumenEstados = ["Borrador", "Aprobada", "Pagada"].map((e) => [e, filas.filter((f) => f.estado === e).length] as const);

  function cambiarPeriodo(valor: string) {
    if (valor) router.push(`/rrhh/liquidaciones?periodo=${valor}`);
  }

  function generar() {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await generarLiquidaciones(idPais, periodo);
      if ("error" in r) setError(r.error);
      else {
        setAviso({ creadas: r.creadas, errores: r.errores });
        router.refresh();
      }
    });
  }

  function crearUna() {
    if (!sel) return;
    setError(null);
    empezar(async () => {
      const r = await crearLiquidacion(sel.id, periodo, Number(dias), bruto.trim() ? Number(bruto) : null);
      if ("error" in r) setError(r.error);
      else router.push(`/rrhh/liquidaciones/${r.id}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Mes</span>
          <input type="month" className={campo} value={periodo.slice(0, 7)} onChange={(e) => cambiarPeriodo(e.target.value)} />
        </label>
        {puedeOperar && (
          <>
            {esAdminGeneral && paises.length > 1 && (
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Mercado</span>
                <select className={campo} value={idPais} onChange={(e) => setIdPais(Number(e.target.value))}>
                  {paises.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={generar} disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-3 py-2 rounded disabled:opacity-40">
              {pendiente ? "Generando..." : `Generar las de ${nombrePeriodo(periodo)}`}
            </button>
            <button onClick={() => { setError(null); setIndividual(true); }} className="bg-verde text-white text-xs font-semibold px-3 py-2 rounded">
              Emitir una
            </button>
          </>
        )}
        <div className="ml-auto flex gap-4 text-xs text-gray-600">
          {resumenEstados.map(([e, n]) => (
            <span key={e}><strong className="tabular-nums">{n}</strong> {e.toLowerCase()}{n === 1 ? "" : "s"}</span>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
      {aviso && (
        <div role="status" className="bg-white border border-gray-200 rounded p-3 text-sm space-y-1">
          <div><strong>{aviso.creadas}</strong> {aviso.creadas === 1 ? "liquidacion creada" : "liquidaciones creadas"} en borrador.</div>
          {aviso.errores.length > 0 && (
            <div className="text-red-700">
              <div className="font-semibold">No se pudieron crear {aviso.errores.length}:</div>
              <ul className="list-disc ml-5 text-xs">
                {aviso.errores.map((e, i) => (
                  <li key={i}><strong>{e.nombre}</strong>: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {individual && (
        <Ventana titulo="Emitir una liquidacion o boleta" subtitulo={nombrePeriodo(periodo)} onCerrar={() => setIndividual(false)} ancho="max-w-xl">
          <div className="space-y-3">
            <div>
              <span className="block text-dorado-osc font-semibold text-sm mb-1">Persona *</span>
              <ListaBuscable etiqueta="Persona" placeholder="Escribir para buscar" opciones={pendientes.map((p) => ({ id: p.id, texto: p.texto }))} valor={persona} onChange={setPersona} />
              {pendientes.length === 0 && <p className="text-xs text-gray-500 mt-1">Todo el personal activo ya tiene liquidacion este mes.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Dias trabajados</span>
                <input type="number" className={`${campo} w-full`} value={dias} onChange={(e) => setDias(e.target.value)} />
              </label>
              {sel?.honorarios && (
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">Bruto de la boleta (si difiere)</span>
                  <input type="number" className={`${campo} w-full`} value={bruto} onChange={(e) => setBruto(e.target.value)} />
                </label>
              )}
            </div>
            {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
            <div className="flex gap-2">
              <button onClick={crearUna} disabled={!sel || pendiente} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40">Emitir</button>
              <button onClick={() => setIndividual(false)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">Cancelar</button>
            </div>
          </div>
        </Ventana>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Documento</th>
                <th scope="col" className="text-left px-3 py-2">Persona</th>
                <th scope="col" className="text-left px-3 py-2">Tipo</th>
                <th scope="col" className="text-left px-3 py-2">Estado</th>
                <th scope="col" className="text-right px-3 py-2">Liquido a pagar</th>
                <th scope="col" className="text-right px-3 py-2">Costo empresa</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-8">
                    Sin liquidaciones en {nombrePeriodo(periodo)}. {pendientes.length > 0 && `${pendientes.length} personas activas por liquidar.`}
                  </td>
                </tr>
              )}
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-2">
                    <BanderaDe idPais={f.id_pais} />
                    <Link href={`/rrhh/liquidaciones/${f.id}`} className="text-verde font-semibold underline">{folioLiquidacion(f.tipo, f.id)}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/rrhh/${f.id_personal}`} className="underline">{f.nombre}</Link>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{f.tipo === "Honorarios" ? "Boleta de honorarios" : "Liquidacion de sueldo"} · {f.clase === "Obra" ? "Obra" : "Oficina"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${COLOR_ESTADO_LIQ[f.estado] ?? ""}`}>{f.estado}</span>
                    {!f.calculada && <span className="ml-2 text-amber-700">sin calcular</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.liquido != null ? importe(f.liquido, f.moneda ?? monedaDelPais(f.id_pais)) : ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.costo != null ? importe(f.costo, f.moneda ?? monedaDelPais(f.id_pais)) : ""}</td>
                </tr>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="border-t-2 border-gray-300 font-semibold">
                {Array.from(totales.entries()).map(([m, t]) => (
                  <tr key={m}>
                    <td colSpan={4} className="px-3 py-2 text-right">Total {m}{paisesConDatos.length > 1 ? "" : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{importe(t.liquido, m)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{importe(t.costo, m)}</td>
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
