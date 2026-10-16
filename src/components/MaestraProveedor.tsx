"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { importe, leerMontoLibre, pesos } from "@/lib/formato";
import {
  agregarItemProveedor,
  agregarItemsProveedor,
  actualizarItemProveedor,
  marcarPreferente,
  quitarItemProveedor,
  quitarPreferente,
} from "@/app/proveedores/acciones";

export interface Candidato {
  clave: string; // "mp:12" o "prod:45"
  etiqueta: string;
  grupo: string;
}

export interface ItemMaestra {
  id: number;
  descripcion: string;
  grupo: string;
  codigo: string | null;
  costo: number;
  activo: boolean;
  // null = en la moneda del mercado; "USD" si el proveedor cotiza en dolares.
  moneda: string | null;
  // Este proveedor es el que define el costo del insumo o producto.
  preferente: boolean;
  // Lo que cobran los demas proveedores de lo mismo.
  otros: { proveedor: string; costo: number; moneda: string; preferente: boolean }[];
}

// Que vende este proveedor y a que precio. El costo es suyo: el mismo insumo
// puede estar en varias maestras con cifras distintas, que es justamente lo
// que se compara al pedir cotizacion.
export default function MaestraProveedor({
  idProveedor,
  monedaMercado,
  items,
  candidatos,
}: {
  idProveedor: number;
  monedaMercado: string;
  items: ItemMaestra[];
  candidatos: Candidato[];
}) {
  const [sel, setSel] = useState("");
  const [codigo, setCodigo] = useState("");
  const [costo, setCosto] = useState("");
  const [moneda, setMoneda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [editCosto, setEditCosto] = useState("");
  const [editMoneda, setEditMoneda] = useState("");
  const [editCodigo, setEditCodigo] = useState("");
  const [pendiente, empezar] = useTransition();
  // Asignacion en lote: marcar varios y agregarlos de una vez, con el costo
  // en cero para completarlo despues en la tabla de abajo.
  const [lote, setLote] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [buscaLote, setBuscaLote] = useState("");

  const porGrupo = useMemo(() => {
    const g = new Map<string, Candidato[]>();
    for (const c of candidatos) {
      const l = g.get(c.grupo);
      if (l) l.push(c);
      else g.set(c.grupo, [c]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [candidatos]);

  const grupos = useMemo(() => {
    const g = new Map<string, ItemMaestra[]>();
    for (const it of items) {
      const l = g.get(it.grupo);
      if (l) l.push(it);
      else g.set(it.grupo, [it]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [items]);

  function agregar() {
    setError(null);
    if (!sel) {
      setError("Elija que producto vende este proveedor.");
      return;
    }
    const [tipo, id] = sel.split(":");
    empezar(async () => {
      const r = await agregarItemProveedor(idProveedor, {
        id_materia_prima: tipo === "mp" ? Number(id) : null,
        id_producto: tipo === "prod" ? Number(id) : null,
        codigo,
        costo: leerMontoLibre(costo),
        moneda: moneda || null,
      });
      if (r?.error) setError(r.error);
      else {
        setSel("");
        setCodigo("");
        setCosto("");
        setMoneda("");
      }
    });
  }

  const candidatosFiltrados = useMemo(() => {
    const q = buscaLote.trim().toLowerCase();
    if (!q) return candidatos;
    return candidatos.filter(
      (c) =>
        c.etiqueta.toLowerCase().includes(q) ||
        c.grupo.toLowerCase().includes(q),
    );
  }, [buscaLote, candidatos]);

  const gruposLote = useMemo(() => {
    const g = new Map<string, Candidato[]>();
    for (const c of candidatosFiltrados) {
      const l = g.get(c.grupo);
      if (l) l.push(c);
      else g.set(c.grupo, [c]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [candidatosFiltrados]);

  function alternar(clave: string) {
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  }

  function alternarGrupo(lista: Candidato[]) {
    const todos = lista.every((c) => marcados.has(c.clave));
    setMarcados((m) => {
      const n = new Set(m);
      for (const c of lista) {
        if (todos) n.delete(c.clave);
        else n.add(c.clave);
      }
      return n;
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm";

  return (
    <div className="space-y-3">
      <div className="bg-crema border border-dorado rounded p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-verde">
            Agregar a la maestra
          </div>
          <button
            onClick={() => {
              setLote((x) => !x);
              setMarcados(new Set());
              setBuscaLote("");
            }}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            {lote ? "Agregar de a uno" : "Asignar varios"}
          </button>
        </div>
        <div
          className={
            lote
              ? "hidden"
              : "grid md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
          }
        >
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-1">
              Materia prima o producto
            </span>
            <select
              className={`${input} w-full`}
              value={sel}
              onChange={(e) => setSel(e.target.value)}
            >
              <option value="">-- elegir --</option>
              {porGrupo.map(([grupo, lista]) => (
                <optgroup key={grupo} label={grupo}>
                  {lista.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.etiqueta}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-1">
              Codigo del proveedor
            </span>
            <input
              className={`${input} w-36`}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-1">
              Costo neto
            </span>
            <span className="flex gap-1">
              <input
                type="text"
                inputMode="decimal"
                className={`${input} w-28 text-right`}
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
              />
              <select className={input} value={moneda} onChange={(e) => setMoneda(e.target.value)} title="Moneda en que cotiza el proveedor">
                <option value="">{monedaMercado}</option>
                <option value="USD">USD</option>
              </select>
            </span>
          </label>
          <button
            onClick={agregar}
            disabled={pendiente}
            className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>

      {lote && (
        <div className="bg-white border border-verde rounded p-4 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className={`${input} w-64`}
              placeholder="Filtrar por nombre o grupo"
              value={buscaLote}
              onChange={(e) => setBuscaLote(e.target.value)}
            />
            <span className="text-xs text-gray-500">
              {marcados.size} marcado(s) de {candidatos.length} disponibles
            </span>
            <button
              onClick={() =>
                empezar(async () => {
                  setError(null);
                  const r = await agregarItemsProveedor(idProveedor, [
                    ...marcados,
                  ]);
                  if (r?.error) setError(r.error);
                  else {
                    setMarcados(new Set());
                    setLote(false);
                  }
                })
              }
              disabled={pendiente || marcados.size === 0}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40 ml-auto"
            >
              {pendiente ? "Asignando..." : `Asignar ${marcados.size}`}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Entran con costo cero; el costo se completa despues en la tabla de
            abajo, que es donde se ve todo junto.
          </p>
          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded">
            {gruposLote.length === 0 && (
              <div className="text-center text-gray-400 text-xs py-6">
                No queda nada por asignar con ese filtro.
              </div>
            )}
            {gruposLote.map(([grupo, lista]) => (
              <div key={grupo}>
                <button
                  onClick={() => alternarGrupo(lista)}
                  className="w-full text-left bg-crema border-t border-dorado px-3 py-1.5 text-[11px] font-semibold text-verde uppercase tracking-wide"
                  title="Marcar o desmarcar todo el grupo"
                >
                  {grupo}
                  <span className="ml-2 font-normal normal-case text-gray-500">
                    {lista.length}
                  </span>
                </button>
                {lista.map((c) => (
                  <label
                    key={c.clave}
                    className="flex items-center gap-2 px-3 py-1 text-xs border-t border-gray-100 hover:bg-crema cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={marcados.has(c.clave)}
                      onChange={() => alternar(c.clave)}
                    />
                    <span>{c.etiqueta}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {aviso && (
        <div className="bg-green-50 border border-green-200 text-green-900 text-sm rounded p-3">
          {aviso}
        </div>
      )}

      <p className="text-xs text-gray-600">
        El proveedor preferente se elige <strong>por insumo o producto</strong>, no por proveedor:
        un proveedor puede ser el preferente de unos items de su maestra y no de otros. El costo
        del preferente es el que usa el sistema para costear los paneles y calcular el margen;
        los demas proveedores de lo mismo quedan como referencia. El costo del insumo se puede
        cambiar a mano; el preferente solo lo vuelve a escribir cuando cambia su propio costo.
      </p>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Producto</th>
                <th className="text-left px-3 py-2">Codigo</th>
                <th className="text-right px-3 py-2">Costo</th>
                <th className="text-left px-3 py-2">Preferente</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">
                    Maestra vacia: este proveedor no recibira solicitudes.
                  </td>
                </tr>
              )}
              {grupos.map(([grupo, lista]) => (
                <Fragment key={grupo}>
                  <tr className="bg-crema border-t border-dorado">
                    <td
                      colSpan={6}
                      className="px-3 py-1.5 text-[11px] font-semibold text-verde uppercase tracking-wide"
                    >
                      {grupo}
                      <span className="ml-2 font-normal normal-case text-gray-500">
                        {lista.length}
                      </span>
                    </td>
                  </tr>
                  {lista.map((it) => (
                    <tr
                      key={it.id}
                      className="border-t border-gray-100 hover:bg-crema"
                    >
                      <td className="px-3 py-2 pl-6">
                        {it.descripcion}
                        {it.otros.length > 0 && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            Otros proveedores:{" "}
                            {it.otros
                              .map(
                                (o) =>
                                  `${o.proveedor} ${importe(o.costo, o.moneda)}${o.preferente ? " (preferente)" : ""}`,
                              )
                              .join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {edit === it.id ? (
                          <input
                            className={`${input} w-32`}
                            value={editCodigo}
                            onChange={(e) => setEditCodigo(e.target.value)}
                          />
                        ) : (
                          (it.codigo ?? "")
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {edit === it.id ? (
                          <span className="inline-flex gap-1 justify-end">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`${input} w-28 text-right`}
                              value={editCosto}
                              onChange={(e) => setEditCosto(e.target.value)}
                            />
                            <select className={input} value={editMoneda} onChange={(e) => setEditMoneda(e.target.value)}>
                              <option value="">{monedaMercado}</option>
                              <option value="USD">USD</option>
                            </select>
                          </span>
                        ) : (
                          importe(it.costo, it.moneda ?? monedaMercado)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {it.preferente ? (
                          <span className="inline-block bg-verde text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            Preferente
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {it.activo ? (
                          <span className="text-green-700">Activo</span>
                        ) : (
                          <span className="text-gray-400">Inactivo</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {edit === it.id ? (
                          <>
                            <button
                              onClick={() =>
                                empezar(async () => {
                                  const r = await actualizarItemProveedor(
                                    it.id,
                                    idProveedor,
                                    leerMontoLibre(editCosto),
                                    editCodigo,
                                    it.activo,
                                    editMoneda || null,
                                  );
                                  if (r?.error) setError(r.error);
                                  else setEdit(null);
                                })
                              }
                              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                            >
                              grabar
                            </button>
                            <button
                              onClick={() => setEdit(null)}
                              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                            >
                              cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEdit(it.id);
                                setEditCosto(String(it.costo).replace(".", ","));
                                setEditMoneda(it.moneda ?? "");
                                setEditCodigo(it.codigo ?? "");
                              }}
                              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                            >
                              editar
                            </button>
                            <button
                              onClick={() =>
                                empezar(async () => {
                                  const r = await actualizarItemProveedor(
                                    it.id,
                                    idProveedor,
                                    it.costo,
                                    it.codigo ?? "",
                                    !it.activo,
                                    it.moneda,
                                  );
                                  if (r?.error) setError(r.error);
                                })
                              }
                              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                            >
                              {it.activo ? "desactivar" : "activar"}
                            </button>
                            <button
                              onClick={() =>
                                empezar(async () => {
                                  setError(null);
                                  setAviso(null);
                                  if (it.preferente) {
                                    const r = await quitarPreferente(it.id, idProveedor);
                                    if (r?.error) setError(r.error);
                                    else setAviso("Se quito la marca. El costo del insumo queda como estaba hasta que se marque otro proveedor.");
                                  } else {
                                    const r = await marcarPreferente(it.id, idProveedor);
                                    if (r?.error) setError(r.error);
                                    else
                                      setAviso(
                                        `Este proveedor es ahora el preferente de "${it.descripcion}" (${importe(r.costo, monedaMercado)}). Se recostearon ${r.paneles} paneles y ${r.cotizaciones} lineas de cotizaciones sin pedido. Los pedidos no se tocaron.`,
                                      );
                                  }
                                })
                              }
                              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                              title={
                                it.preferente
                                  ? "Este proveedor deja de ser el preferente de este item"
                                  : "Usar el costo de este proveedor para costear solo este item"
                              }
                            >
                              {it.preferente ? "quitar preferente" : "hacer preferente"}
                            </button>
                            <button
                              onClick={() =>
                                empezar(async () => {
                                  const r = await quitarItemProveedor(
                                    it.id,
                                    idProveedor,
                                  );
                                  if (r?.error) setError(r.error);
                                })
                              }
                              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                            >
                              quitar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
