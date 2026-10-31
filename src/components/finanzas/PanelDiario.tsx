"use client";

import { Fragment, useState, useTransition } from "react";
import { contabilizar, registrarAsiento, type LineaManual } from "@/app/libro-diario/acciones";

interface Asiento {
  id: number;
  fecha: string;
  glosa: string;
  origen: string;
  asiento_lineas: { id: number; codigo_cuenta: string; debe: number; haber: number; id_centro_costo: number | null }[];
}

const campo = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";
const vacia = (): LineaManual => ({ cuenta: "", debe: 0, haber: 0, centro: "" });
const fmt = (n: number) => (n === 0 ? "" : Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 }));

export default function PanelDiario({
  pais,
  otrosPaises,
  desde,
  hasta,
  hoy,
  plan,
  centros,
  asientos,
  puedeEditar,
}: {
  pais: { id: number; nombre: string; moneda: string; codigo: string };
  otrosPaises: { codigo: string; nombre: string }[];
  desde: string;
  hasta: string;
  hoy: string;
  plan: { codigo: string; nombre: string }[];
  centros: { id: number; codigo: string; nombre: string }[];
  asientos: Asiento[];
  puedeEditar: boolean;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [fechaAsiento, setFechaAsiento] = useState(hoy);
  const [glosa, setGlosa] = useState("");
  const [lineas, setLineas] = useState<LineaManual[]>([vacia(), vacia()]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const debe = lineas.reduce((s, l) => s + (l.debe || 0), 0);
  const haber = lineas.reduce((s, l) => s + (l.haber || 0), 0);
  const nombreCuenta = (c: string) => plan.find((p) => p.codigo === c)?.nombre ?? "";
  const nombreCentro = (id: number | null) => centros.find((c) => c.id === id)?.codigo ?? "";

  function recontabilizar() {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await contabilizar(pais.id, hoy);
      if (r?.error) setError(r.error);
      else setAviso(`Listo: ${r.asientos} asientos automáticos generados hasta hoy. Los manuales no se tocan.`);
    });
  }

  function cambiar(i: number, parte: Partial<LineaManual>) {
    setLineas(lineas.map((l, j) => (j === i ? { ...l, ...parte } : l)));
  }

  function registrar() {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await registrarAsiento(pais.id, fechaAsiento, glosa, lineas);
      if (r?.error) setError(r.error);
      else {
        setAviso("Asiento registrado.");
        setNuevo(false);
        setGlosa("");
        setLineas([vacia(), vacia()]);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3 space-y-1">
        <p>
          Los asientos automáticos nacen de los documentos: facturas emitidas, avance de obra, cobros y pagos
          del banco, facturas de proveedores y depreciación. Se rehacen completos cada vez que contabilizas, así que
          lo que corrijas en un documento queda corregido aquí.
        </p>
        <p>
          Un egreso pagado sin factura de proveedor registrada se reconoce como gasto cuando se paga. Los
          ajustes que no vienen de un documento se registran como asiento manual.
        </p>
      </div>

      {error && (
        <div role="alert" className="sticky top-2 z-10 shadow bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>
      )}
      {aviso && (
        <div role="status" className="sticky top-2 z-10 shadow bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">{aviso}</div>
      )}

      <form className="flex flex-wrap items-end gap-3 text-xs" method="get">
        {otrosPaises.length > 1 && (
          <label>
            <span className="block text-dorado-osc font-semibold mb-1">Mercado</span>
            <select id="pais" name="pais" defaultValue={pais.codigo} className={campo}>
              {otrosPaises.map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="block text-dorado-osc font-semibold mb-1">Desde</span>
          <input id="desde" type="date" name="desde" defaultValue={desde} className={campo} />
        </label>
        <label>
          <span className="block text-dorado-osc font-semibold mb-1">Hasta</span>
          <input id="hasta" type="date" name="hasta" defaultValue={hasta} className={campo} />
        </label>
        <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">Ver</button>
        <a
          href={`/libro-diario/exportar?pais=${pais.id}&desde=${desde}&hasta=${hasta}`}
          className="text-verde underline text-xs py-1.5"
        >
          Descargar para el contador (CSV)
        </a>
        {puedeEditar && (
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setNuevo(!nuevo)}
              aria-expanded={nuevo}
              className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded"
            >
              Asiento manual
            </button>
            <button
              type="button"
              onClick={recontabilizar}
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-50"
            >
              {pendiente ? "Contabilizando..." : `Contabilizar ${pais.nombre} hasta hoy`}
            </button>
          </span>
        )}
      </form>

      {nuevo && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">Asiento manual · {pais.nombre} ({pais.moneda})</div>
          <div className="grid sm:grid-cols-4 gap-3">
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Fecha</span>
              <input id="fecha-asiento" type="date" className={`${campo} w-full`} value={fechaAsiento} onChange={(e) => setFechaAsiento(e.target.value)} />
            </label>
            <label className="text-sm sm:col-span-3">
              <span className="block text-dorado-osc font-semibold mb-1">Glosa</span>
              <input id="glosa-asiento" className={`${campo} w-full`} value={glosa} onChange={(e) => setGlosa(e.target.value)} placeholder="Qué se ajusta y por qué" />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-dorado-osc">
                <tr>
                  <th scope="col" className="text-left px-1 py-1">Cuenta</th>
                  <th scope="col" className="text-left px-1 py-1 w-40">Centro de costo</th>
                  <th scope="col" className="text-right px-1 py-1 w-32">Debe</th>
                  <th scope="col" className="text-right px-1 py-1 w-32">Haber</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td className="px-1 py-1">
                      <select aria-label={`Cuenta de la línea ${i + 1}`} className={`${campo} w-full`} value={l.cuenta} onChange={(e) => cambiar(i, { cuenta: e.target.value })}>
                        <option value="">Elegir cuenta</option>
                        {plan.map((c) => (
                          <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select aria-label={`Centro de costo de la línea ${i + 1}`} className={`${campo} w-full`} value={l.centro} onChange={(e) => cambiar(i, { centro: e.target.value })}>
                        <option value="">Sin centro</option>
                        {centros.map((c) => (
                          <option key={c.id} value={c.id}>{c.codigo}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input aria-label={`Debe de la línea ${i + 1}`} inputMode="decimal" className={`${campo} w-full text-right`} value={l.debe || ""} onChange={(e) => cambiar(i, { debe: Number(e.target.value) || 0, haber: 0 })} />
                    </td>
                    <td className="px-1 py-1">
                      <input aria-label={`Haber de la línea ${i + 1}`} inputMode="decimal" className={`${campo} w-full text-right`} value={l.haber || ""} onChange={(e) => cambiar(i, { haber: Number(e.target.value) || 0, debe: 0 })} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200 font-semibold tabular-nums">
                  <td colSpan={2} className="px-1 py-1">
                    <button type="button" onClick={() => setLineas([...lineas, vacia()])} className="text-verde underline">
                      + línea
                    </button>
                  </td>
                  <td className="px-1 py-1 text-right">{fmt(debe)}</td>
                  <td className="px-1 py-1 text-right">{fmt(haber)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {debe !== haber && (
            <p role="status" className="text-xs text-dorado-osc">Falta cuadrar: diferencia de {fmt(Math.abs(debe - haber))}.</p>
          )}
          <div className="flex gap-2">
            <button onClick={registrar} disabled={pendiente || debe !== haber || debe === 0} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50">
              Registrar asiento
            </button>
            <button onClick={() => setNuevo(false)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2 w-28">Fecha</th>
                <th scope="col" className="text-left px-3 py-2">Glosa</th>
                <th scope="col" className="text-left px-3 py-2 w-44">Origen</th>
                <th scope="col" className="text-right px-3 py-2 w-32">Monto</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {asientos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-gray-500">
                    No hay asientos en el período. {puedeEditar ? "Usa «Contabilizar» para generarlos." : ""}
                  </td>
                </tr>
              )}
              {asientos.map((a) => {
                const total = a.asiento_lineas.reduce((s, l) => s + Number(l.debe), 0);
                return (
                  <Fragment key={a.id}>
                    <tr className="border-t border-gray-100 hover:bg-crema">
                      <td className="px-3 py-1.5 whitespace-nowrap">{a.fecha}</td>
                      <td className="px-3 py-1.5">{a.glosa}</td>
                      <td className="px-3 py-1.5 text-gray-600">{a.origen}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(total)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          onClick={() => setAbierto(abierto === a.id ? null : a.id)}
                          aria-expanded={abierto === a.id}
                          className="text-verde underline"
                        >
                          {abierto === a.id ? "cerrar" : "ver"}
                        </button>
                      </td>
                    </tr>
                    {abierto === a.id &&
                      a.asiento_lineas.map((l) => (
                        <tr key={l.id} className="bg-gray-50 text-gray-700">
                          <td />
                          <td className="px-3 py-1 pl-8">
                            {l.codigo_cuenta} · {nombreCuenta(l.codigo_cuenta)}
                            {l.id_centro_costo && <span className="ml-2 text-gray-500">{nombreCentro(l.id_centro_costo)}</span>}
                          </td>
                          <td />
                          <td className="px-3 py-1 text-right">
                            {Number(l.debe) > 0 ? `Debe ${fmt(Number(l.debe))}` : `Haber ${fmt(Number(l.haber))}`}
                          </td>
                          <td />
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {asientos.length >= 200 && <p className="text-xs text-gray-500">Se muestran los 200 más recientes del período.</p>}
    </div>
  );
}
