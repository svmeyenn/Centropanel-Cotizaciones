"use client";

import { useState, useTransition } from "react";
import { guardarActivo } from "@/app/libro-diario/acciones";

interface Activo {
  id: number;
  nombre: string;
  fechaCompra: string;
  costo: number;
  residual: number;
  vidaMeses: number;
  centro: number | null;
  idMov: number | null;
  activo: boolean;
}

const campo = "border border-gray-300 rounded px-2 py-1 text-sm bg-white w-full";
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

function vacio(): Activo {
  return { id: 0, nombre: "", fechaCompra: new Date().toISOString().slice(0, 10), costo: 0, residual: 0, vidaMeses: 60, centro: null, idMov: null, activo: true };
}

export default function PanelActivos({
  pais,
  paises,
  activos,
  centros,
  puedeEditar,
}: {
  pais: { id: number; nombre: string; moneda: string; codigo: string };
  paises: { codigo: string; nombre: string }[];
  activos: Activo[];
  centros: { id: number; codigo: string; nombre: string }[];
  puedeEditar: boolean;
}) {
  const [form, setForm] = useState<Activo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const mensual = (a: Activo) => Math.round((a.costo - a.residual) / a.vidaMeses);

  function guardar() {
    if (!form) return;
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await guardarActivo({
        id: form.id || null,
        idPais: pais.id,
        nombre: form.nombre,
        fechaCompra: form.fechaCompra,
        costo: form.costo,
        residual: form.residual,
        vidaMeses: form.vidaMeses,
        centro: form.centro,
        idMov: form.idMov,
        activo: form.activo,
      });
      if (r?.error) setError(r.error);
      else {
        setAviso("Activo guardado. Contabiliza el mercado en el Libro diario para que entre a los estados.");
        setForm(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
        La depreciación es lineal con vida útil financiera: (costo − valor residual) ÷ meses, desde el mes de la compra,
        con la primera cuota al cierre de ese mes. Si el activo viene de un egreso ya registrado como compra de maquinaria (concepto F2.01), anota el
        número del movimiento para no contarlo dos veces; si ya lo tenías antes de usar el sistema, déjalo vacío y
        entra como saldo inicial.
      </div>

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
      {aviso && <div role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">{aviso}</div>}

      <div className="flex flex-wrap items-end gap-3 text-xs">
        {paises.length > 1 && (
          <form method="get" className="flex items-end gap-2">
            <label>
              <span className="block text-dorado-osc font-semibold mb-1">Mercado</span>
              <select id="pais" name="pais" defaultValue={pais.codigo} className="border border-gray-300 rounded px-2 py-1 text-xs bg-white">
                {paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
              </select>
            </label>
            <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">Ver</button>
          </form>
        )}
        {puedeEditar && (
          <button onClick={() => setForm(vacio())} className="ml-auto bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">
            + Nuevo activo
          </button>
        )}
      </div>

      {form && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">{form.id ? "Modificar activo" : "Nuevo activo"} · {pais.nombre} ({pais.moneda})</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-sm sm:col-span-2">
              <span className="block text-dorado-osc font-semibold mb-1">Nombre</span>
              <input id="af-nombre" className={campo} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Fecha de compra</span>
              <input id="af-fecha" type="date" className={campo} value={form.fechaCompra} onChange={(e) => setForm({ ...form, fechaCompra: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Costo</span>
              <input id="af-costo" inputMode="decimal" className={`${campo} text-right`} value={form.costo || ""} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Valor residual</span>
              <input id="af-residual" inputMode="decimal" className={`${campo} text-right`} value={form.residual || ""} onChange={(e) => setForm({ ...form, residual: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Vida útil (meses)</span>
              <input id="af-vida" inputMode="numeric" className={`${campo} text-right`} value={form.vidaMeses || ""} onChange={(e) => setForm({ ...form, vidaMeses: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Centro de costo</span>
              <select id="af-centro" className={campo} value={form.centro ?? ""} onChange={(e) => setForm({ ...form, centro: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Sin centro</option>
                {centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">N° de egreso de la compra</span>
              <input id="af-mov" inputMode="numeric" className={campo} placeholder="Ninguno" value={form.idMov ?? ""} onChange={(e) => setForm({ ...form, idMov: e.target.value ? Number(e.target.value) : null })} />
            </label>
            <label className="text-sm flex items-end gap-2 pb-1">
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              <span className="text-gray-700">Se sigue depreciando</span>
            </label>
          </div>
          {form.costo > 0 && form.vidaMeses > 0 && form.residual < form.costo && (
            <p className="text-xs text-gray-600 tabular-nums">Depreciación mensual: {num(mensual(form))} {pais.moneda}</p>
          )}
          <div className="flex gap-2">
            <button onClick={guardar} disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50">
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button onClick={() => setForm(null)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Activo</th>
                <th scope="col" className="text-left px-3 py-2">Compra</th>
                <th scope="col" className="text-right px-3 py-2">Costo</th>
                <th scope="col" className="text-right px-3 py-2">Residual</th>
                <th scope="col" className="text-right px-3 py-2">Vida (meses)</th>
                <th scope="col" className="text-right px-3 py-2">Cuota mensual</th>
                <th scope="col" className="text-left px-3 py-2">Centro</th>
                <th scope="col" className="text-left px-3 py-2">Estado</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {activos.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-4 text-gray-500">No hay activos fijos registrados en {pais.nombre}.</td></tr>
              )}
              {activos.map((a) => (
                <tr key={a.id} className="border-t border-gray-100 hover:bg-crema">
                  <th scope="row" className="text-left px-3 py-1.5 font-semibold">{a.nombre}</th>
                  <td className="px-3 py-1.5">{a.fechaCompra}</td>
                  <td className="px-3 py-1.5 text-right">{num(a.costo)}</td>
                  <td className="px-3 py-1.5 text-right">{num(a.residual)}</td>
                  <td className="px-3 py-1.5 text-right">{a.vidaMeses}</td>
                  <td className="px-3 py-1.5 text-right">{num(mensual(a))}</td>
                  <td className="px-3 py-1.5">{centros.find((c) => c.id === a.centro)?.codigo ?? "—"}</td>
                  <td className="px-3 py-1.5">{a.activo ? "Depreciando" : "Dado de baja"}{a.idMov ? ` · egreso ${a.idMov}` : ""}</td>
                  <td className="px-2 py-1.5 text-right">
                    {puedeEditar && <button onClick={() => setForm(a)} className="text-verde underline">editar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
