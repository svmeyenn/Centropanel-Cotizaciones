"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import { hoyISO, importe, leerMontoLibre } from "@/lib/formato";
import {
  actualizarCostosProveedor,
  historialCostos,
  leerArchivoPrecios,
  type FilaHistorial,
} from "@/app/proveedores/acciones";
import type { ItemMaestra } from "@/components/MaestraProveedor";

const input = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";
const boton = "border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white disabled:opacity-50";

type Origen = "Manual" | "Reajuste" | "Archivo";

// Una fecha ISO (2026-11-01) como se lee aca: 01-11-2026.
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("-");

// Todos los costos de un proveedor en una sola tabla: se escribe el costo nuevo al lado del
// actual, se reajusta por porcentaje a los marcados o se carga una lista de precios, y se
// guarda todo junto con la fecha desde la que rige.
export default function ActualizarCostos({
  idProveedor,
  monedaMercado,
  items,
}: {
  idProveedor: number;
  monedaMercado: string;
  items: ItemMaestra[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const archivoRef = useRef<HTMLInputElement>(null);

  const [nuevos, setNuevos] = useState<Record<number, string>>({});
  const [marcados, setMarcados] = useState<Set<number>>(
    () => new Set(items.filter((i) => i.costo > 0).map((i) => i.id))
  );
  const [busca, setBusca] = useState("");
  const [pct, setPct] = useState("");
  const [desde, setDesde] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [origen, setOrigen] = useState<Origen>("Manual");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinCoincidir, setSinCoincidir] = useState<{ total: number; lista: string[] } | null>(null);
  const [verHistorial, setVerHistorial] = useState<ItemMaestra | null>(null);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q
      ? items.filter((i) => `${i.sku ?? ""} ${i.descripcion} ${i.codigo ?? ""}`.toLowerCase().includes(q))
      : items;
  }, [items, busca]);

  const grupos = useMemo(() => {
    const g = new Map<string, ItemMaestra[]>();
    for (const it of visibles) {
      const l = g.get(it.grupo);
      if (l) l.push(it);
      else g.set(it.grupo, [it]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [visibles]);

  const decimales = (it: ItemMaestra) => ((it.moneda ?? monedaMercado) === "CLP" ? 0 : 2);
  const redondear = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

  // Lo que realmente cambia: un costo nuevo escrito y distinto del actual.
  const cambios = useMemo(() => {
    const lista: { it: ItemMaestra; costo: number }[] = [];
    let invalidos = 0;
    for (const it of items) {
      const t = nuevos[it.id];
      if (t === undefined || t.trim() === "") continue;
      const n = leerMontoLibre(t);
      if (!Number.isFinite(n) || n < 0) {
        invalidos++;
        continue;
      }
      if (n !== it.costo) lista.push({ it, costo: n });
    }
    return { lista, invalidos };
  }, [items, nuevos]);

  const suben = cambios.lista.filter((c) => c.costo > c.it.costo).length;
  const bajan = cambios.lista.filter((c) => c.costo < c.it.costo).length;
  const preferentes = cambios.lista.filter((c) => c.it.preferente).length;

  function alternar(id: number) {
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((i) => marcados.has(i.id));
  function alternarTodos() {
    setMarcados((m) => {
      const n = new Set(m);
      for (const i of visibles) {
        if (todosVisiblesMarcados) n.delete(i.id);
        else n.add(i.id);
      }
      return n;
    });
  }

  function reajustar() {
    setError(null);
    setAviso(null);
    const p = leerMontoLibre(pct.replace("%", "").replace("-", ""));
    const negativo = pct.trim().startsWith("-");
    if (!pct.trim() || !Number.isFinite(p) || p === 0) {
      setError("Escriba el porcentaje de reajuste, por ejemplo 5 o -3,5.");
      return;
    }
    const factor = 1 + (negativo ? -p : p) / 100;
    if (factor <= 0) {
      setError("Ese porcentaje dejaria los costos en cero o negativos.");
      return;
    }
    const aplicar = visibles.filter((i) => marcados.has(i.id) && i.costo > 0);
    if (!aplicar.length) {
      setError("No hay filas marcadas con costo para reajustar.");
      return;
    }
    setNuevos((prev) => {
      const sig = { ...prev };
      for (const it of aplicar) sig[it.id] = String(redondear(it.costo * factor, decimales(it))).replace(".", ",");
      return sig;
    });
    setOrigen("Reajuste");
    setAviso(`Reajuste de ${negativo ? "-" : "+"}${p.toLocaleString("es-CL")}% aplicado a ${aplicar.length} fila(s). Revise y guarde.`);
  }

  function cargarArchivo(f: File | undefined) {
    if (!f) return;
    setError(null);
    setAviso(null);
    setSinCoincidir(null);
    const d = new FormData();
    d.set("archivo", f);
    empezar(async () => {
      const r = await leerArchivoPrecios(idProveedor, d);
      if (archivoRef.current) archivoRef.current.value = "";
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      if (!("coincidencias" in r) || !r.coincidencias) return;
      setNuevos((prev) => {
        const sig = { ...prev };
        for (const c of r.coincidencias) sig[c.id] = String(c.costo).replace(".", ",");
        return sig;
      });
      setOrigen("Archivo");
      setAviso(
        `La lista trae ${r.totalFilas} fila(s): ${r.coincidencias.length} calzaron con la maestra.` +
          (r.totalSinCoincidencia ? ` ${r.totalSinCoincidencia} no calzaron y se ignoraron.` : "") +
          " Revise y guarde."
      );
      if (r.totalSinCoincidencia) setSinCoincidir({ total: r.totalSinCoincidencia, lista: r.sinCoincidencia });
    });
  }

  function guardar() {
    setError(null);
    setAviso(null);
    if (cambios.invalidos) {
      setError("Hay costos escritos que no son validos. Corrija las filas marcadas en rojo.");
      return;
    }
    if (!cambios.lista.length) {
      setError("No hay cambios que guardar.");
      return;
    }
    if (!desde) {
      setError("Indique desde cuando rige el costo.");
      return;
    }
    const baja0 = cambios.lista.filter((c) => c.costo === 0).length;
    const texto =
      `Se van a guardar ${cambios.lista.length} costo(s), vigentes desde el ${dmy(desde)}.` +
      (baja0 ? `\n${baja0} quedan en cero y pasan a inactivos.` : "") +
      (preferentes
        ? `\n${preferentes} son preferentes: se recostean los paneles y las cotizaciones sin pedido (los pedidos no se tocan).`
        : "");
    if (!window.confirm(texto)) return;
    empezar(async () => {
      const r = await actualizarCostosProveedor(
        idProveedor,
        cambios.lista.map((c) => ({ id: c.it.id, costo: c.costo, moneda: c.it.moneda })),
        desde,
        origen,
        nota
      );
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      if (!("actualizados" in r)) return;
      setAviso(
        `Listo: ${r.actualizados} costo(s) actualizados.` +
          (r.preferentes ? ` Se recostearon ${r.paneles} paneles y ${r.cotizaciones} lineas de cotizaciones sin pedido.` : "")
      );
      setNuevos({});
      setNota("");
      setOrigen("Manual");
      setSinCoincidir(null);
      router.refresh();
    });
  }

  function descartar() {
    setNuevos({});
    setOrigen("Manual");
    setError(null);
    setAviso(null);
    setSinCoincidir(null);
  }

  return (
    <div className="space-y-3">
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">{error}</div>}
      {aviso && <div role="status" className="bg-crema border border-gray-200 text-gray-700 text-xs rounded p-3">{aviso}</div>}
      {sinCoincidir && (
        <details className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded p-3">
          <summary className="cursor-pointer font-semibold">
            {sinCoincidir.total} fila(s) de la lista no calzaron con la maestra
          </summary>
          <p className="mt-1">{sinCoincidir.lista.join(" · ")}{sinCoincidir.total > sinCoincidir.lista.length ? " ..." : ""}</p>
          <p className="mt-1">Se emparejan por el SKU de Centropanel o por el codigo del proveedor de la maestra.</p>
        </details>
      )}

      <div className="bg-white border border-gray-200 rounded p-3 grid gap-3 md:grid-cols-4 items-end">
        <label className="text-xs">
          <span className="block font-semibold text-dorado-osc mb-0.5">Rige desde *</span>
          <input type="date" className={`${input} w-full`} value={desde} max={hoyISO()} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <div className="text-xs">
          <span className="block font-semibold text-dorado-osc mb-0.5">Reajustar los marcados (%)</span>
          <span className="flex gap-1.5">
            <input
              className={`${input} w-24 text-right`}
              inputMode="decimal"
              placeholder="5 o -3,5"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              aria-label="Porcentaje de reajuste"
            />
            <button className={boton} disabled={pendiente} onClick={reajustar}>Aplicar</button>
          </span>
        </div>
        <div className="text-xs md:col-span-2">
          <span className="block font-semibold text-dorado-osc mb-0.5">Lista de precios (.xlsx o .csv)</span>
          <input
            ref={archivoRef}
            type="file"
            accept=".xlsx,.csv,.txt"
            className={`${input} w-full`}
            disabled={pendiente}
            onChange={(e) => cargarArchivo(e.target.files?.[0])}
            aria-label="Archivo de lista de precios"
          />
          <span className="block text-[11px] text-gray-500 mt-0.5">
            Columnas: &quot;SKU&quot; o &quot;Codigo&quot; (el del proveedor) y &quot;Costo&quot; o &quot;Precio&quot;. No guarda: solo rellena la columna de costo nuevo.
          </span>
        </div>
        <label className="text-xs md:col-span-3">
          <span className="block font-semibold text-dorado-osc mb-0.5">Nota del cambio (opcional)</span>
          <input className={`${input} w-full`} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Lista de precios noviembre, reajuste anual..." />
        </label>
        <label className="text-xs">
          <span className="block font-semibold text-dorado-osc mb-0.5">Buscar</span>
          <input className={`${input} w-full`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="SKU, producto o codigo" />
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" aria-label="Marcar todas las filas" checked={todosVisiblesMarcados} onChange={alternarTodos} />
                </th>
                <th className="text-left px-3 py-2 w-28">SKU</th>
                <th className="text-left px-3 py-2">Producto</th>
                <th className="text-left px-3 py-2">Codigo del proveedor</th>
                <th className="text-right px-3 py-2">Costo actual</th>
                <th className="text-right px-3 py-2 w-40">Costo nuevo</th>
                <th className="text-right px-3 py-2 w-24">Variacion</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500 py-8">
                    {items.length === 0 ? "Este proveedor aun no tiene items en su maestra." : "Nada coincide con lo escrito."}
                  </td>
                </tr>
              )}
              {grupos.map(([grupo, lista]) => (
                <Fragment key={grupo}>
                  <tr className="bg-crema border-t border-dorado">
                    <td colSpan={8} className="px-3 py-1.5 text-[11px] font-semibold text-verde uppercase tracking-wide">
                      {grupo}
                      <span className="ml-2 font-normal normal-case text-gray-500">{lista.length}</span>
                    </td>
                  </tr>
                  {lista.map((it) => {
                    const texto = nuevos[it.id] ?? "";
                    const n = texto.trim() === "" ? null : leerMontoLibre(texto);
                    const malo = n !== null && (!Number.isFinite(n) || n < 0);
                    const cambia = n !== null && !malo && n !== it.costo;
                    const variacion = cambia && it.costo > 0 ? ((n! - it.costo) / it.costo) * 100 : null;
                    return (
                      <tr key={it.id} className={`border-t border-gray-100 hover:bg-crema ${cambia ? "bg-green-50" : ""}`}>
                        <td className="px-3 py-1.5 text-center">
                          <input type="checkbox" aria-label={`Marcar ${it.descripcion}`} checked={marcados.has(it.id)} onChange={() => alternar(it.id)} />
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-gray-600 whitespace-nowrap">{it.sku ?? ""}</td>
                        <td className="px-3 py-1.5">
                          {it.descripcion}
                          {it.preferente && <span className="ml-1.5 text-[10px] bg-verde text-white rounded px-1.5 py-0.5">preferente</span>}
                          {!it.activo && <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-700 rounded px-1.5 py-0.5">inactivo</span>}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600">{it.codigo ?? ""}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {it.costo > 0 ? importe(it.costo, it.moneda ?? monedaMercado) : <span className="text-amber-800">sin costo</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            className={`${input} w-32 text-right tabular-nums ${malo ? "border-red-500 bg-red-50" : ""}`}
                            inputMode="decimal"
                            value={texto}
                            placeholder={String(it.costo).replace(".", ",")}
                            aria-label={`Costo nuevo de ${it.descripcion}`}
                            onChange={(e) => setNuevos((p) => ({ ...p, [it.id]: e.target.value }))}
                          />
                        </td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${variacion === null ? "" : variacion > 0 ? "text-red-700" : "text-green-700"}`}>
                          {variacion !== null ? `${variacion > 0 ? "+" : ""}${variacion.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%` : ""}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button className="text-verde underline" onClick={() => setVerHistorial(it)}>Historial</button>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border border-gray-300 rounded shadow px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold text-gray-800">
          {cambios.lista.length} cambio(s)
          {cambios.lista.length > 0 && <span className="font-normal text-gray-600"> · {suben} suben · {bajan} bajan{preferentes ? ` · ${preferentes} preferente(s)` : ""}</span>}
          {cambios.invalidos > 0 && <span className="text-red-700 font-normal"> · {cambios.invalidos} no valido(s)</span>}
        </span>
        <span className="ml-auto flex gap-2">
          <button className={boton} disabled={pendiente || Object.keys(nuevos).length === 0} onClick={descartar}>Descartar</button>
          <button
            className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            disabled={pendiente || cambios.lista.length === 0}
            onClick={guardar}
          >
            {pendiente ? "Guardando..." : `Guardar ${cambios.lista.length || ""} cambio(s)`}
          </button>
        </span>
      </div>

      {verHistorial && (
        <HistorialCostos
          item={verHistorial}
          monedaMercado={monedaMercado}
          alCerrar={() => setVerHistorial(null)}
        />
      )}
    </div>
  );
}

// Los costos que tuvo un item, del vigente hacia atras, con la fecha desde la que rigio cada uno.
function HistorialCostos({
  item,
  monedaMercado,
  alCerrar,
}: {
  item: ItemMaestra;
  monedaMercado: string;
  alCerrar: () => void;
}) {
  const [filas, setFilas] = useState<FilaHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    historialCostos(item.id).then((r) => {
      if (!vigente) return;
      if ("error" in r) setError(r.error);
      else setFilas(r.filas);
    });
    return () => {
      vigente = false;
    };
  }, [item.id]);

  return (
    <Ventana titulo="Historial de costos" subtitulo={`${item.sku ? item.sku + " · " : ""}${item.descripcion}`} onCerrar={alCerrar} ancho="max-w-4xl">
      <div className="p-1">
        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">{error}</div>}
        {!filas && !error && <p className="text-xs text-gray-500 py-6 text-center">Cargando...</p>}
        {filas && filas.length === 0 && (
          <p className="text-xs text-gray-500 py-6 text-center">Este item aun no tiene costos registrados.</p>
        )}
        {filas && filas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">Rige desde</th>
                  <th className="text-left px-3 py-2">Hasta</th>
                  <th className="text-right px-3 py-2">Costo</th>
                  <th className="text-left px-3 py-2">Origen</th>
                  <th className="text-left px-3 py-2">Registrado</th>
                  <th className="text-left px-3 py-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((h, i) => {
                  const siguiente = i > 0 ? filas[i - 1] : null;
                  return (
                    <tr key={h.id} className={`border-t border-gray-100 ${i === 0 ? "bg-green-50" : ""}`}>
                      <td className="px-3 py-1.5 whitespace-nowrap">{h.vigente_desde ? dmy(h.vigente_desde) : <span className="text-gray-500">antes del registro</span>}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {i === 0 ? <span className="font-semibold text-verde">vigente</span> : siguiente?.vigente_desde ? dmy(siguiente.vigente_desde) : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{importe(h.costo, h.moneda ?? monedaMercado)}</td>
                      <td className="px-3 py-1.5">{h.origen}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">
                        {new Date(h.registrado_en).toLocaleDateString("es-CL")}
                        {h.quien ? ` · ${h.quien}` : ""}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">{h.nota ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Ventana>
  );
}
