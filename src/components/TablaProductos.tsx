"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { pesos, porcentaje, unidades, conIva } from "@/lib/formato";
import {
  actualizarProducto,
  volverAPrecioAutomatico,
  cambiarActivoProducto,
  type DatosProducto,
} from "@/app/productos/acciones";

interface ProductoFila {
  id: number;
  descripcion: string;
  tipo: string;
  familia?: string | null;
  subfamilia?: string | null;
  activo: boolean;
  espesor_total?: number | string | null;
  costo_unitario?: number | null;
  precio_venta: number;
  margen_aplicado?: number | null;
  precio_manual?: boolean | null;
}

export default function TablaProductos({
  productos,
  esAdmin,
  iva,
}: {
  productos: ProductoFila[];
  esAdmin: boolean;
  iva: number;
}) {
  const [busca, setBusca] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<DatosProducto | null>(null);
  // Costo, neto, PVP y margen son el mismo numero visto de cuatro maneras: se
  // guardan costo y neto, y los otros dos se derivan. Mientras se escribe en
  // uno se respeta lo tecleado y los demas ya se muestran recalculados.
  const [enFoco, setEnFoco] = useState<
    "costo" | "neto" | "pvp" | "margen" | null
  >(null);
  const [tecleado, setTecleado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!soloActivos || p.activo) &&
        (!q ||
          p.descripcion.toLowerCase().includes(q) ||
          (p.familia ?? "").toLowerCase().includes(q) ||
          (p.subfamilia ?? "").toLowerCase().includes(q)),
    );
  }, [busca, soloActivos, productos]);

  // El catalogo se lee en dos niveles: familia (Paneles SIP, Madera,
  // Tornillos...) y dentro de ella subfamilia (APA / Smart, Pino Bruta,
  // Amarillo #10[5.0]...). Una lista plana de decenas de tornillos obliga a
  // recorrerla entera para dar con lo que se busca.
  const grupos = useMemo(() => {
    const porFamilia = new Map<string, Map<string, ProductoFila[]>>();
    for (const p of filtrados) {
      const f = p.familia ?? "Otros";
      const sf = p.subfamilia ?? "";
      let subs = porFamilia.get(f);
      if (!subs) {
        subs = new Map();
        porFamilia.set(f, subs);
      }
      const lista = subs.get(sf);
      if (lista) lista.push(p);
      else subs.set(sf, [p]);
    }
    const cmp = (a: string, b: string) => a.localeCompare(b, "es");
    return [...porFamilia.entries()]
      .sort((a, b) => cmp(a[0], b[0]))
      .map(([familia, subs]) => ({
        familia,
        total: [...subs.values()].reduce((n, l) => n + l.length, 0),
        // Dentro del subgrupo, los paneles ordenados por espesor y no por
        // nombre: alfabeticamente el 100 va antes que el 96.
        subgrupos: [...subs.entries()]
          .sort((a, b) => cmp(a[0], b[0]))
          .map(([subfamilia, lista]) => ({
            subfamilia,
            lista: [...lista].sort((x, y) => {
              const ex = Number(x.espesor_total ?? NaN);
              const ey = Number(y.espesor_total ?? NaN);
              if (Number.isFinite(ex) && Number.isFinite(ey) && ex !== ey) {
                return ex - ey;
              }
              return cmp(x.descripcion, y.descripcion);
            }),
          })),
      }));
  }, [filtrados]);

  const enEdicion = productos.find((p) => p.id === editando) ?? null;

  function editar(p: ProductoFila) {
    setEditando(p.id);
    setError(null);
    setEnFoco(null);
    setForm({
      descripcion: p.descripcion,
      costo_unitario: Number(p.costo_unitario ?? 0),
      precio_venta: Number(p.precio_venta),
      precio_manual: Boolean(p.precio_manual),
      activo: p.activo,
    });
  }

  function guardar() {
    if (!form || editando == null) return;
    setError(null);
    empezar(async () => {
      const r = await actualizarProducto(editando, form);
      if (r?.error) setError(r.error);
      else {
        setEditando(null);
        setForm(null);
      }
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const esPanel = enEdicion?.tipo === "Panel SIP";
  const margenForm =
    form && form.precio_venta > 0
      ? (form.precio_venta - form.costo_unitario) / form.precio_venta
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-72"
          placeholder="Buscar por descripcion"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="text-sm text-gray-600 flex items-center gap-2">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo activos
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {filtrados.length} de {productos.length}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {form && enEdicion && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">
            Modificar producto
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <label className="text-sm md:col-span-4">
              <span className="block text-dorado-osc font-semibold mb-1">
                Descripcion
              </span>
              <input
                className={input}
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Costo unitario
              </span>
              <input
                type="text"
                inputMode="numeric"
                className={`${input} disabled:bg-gray-100`}
                disabled={esPanel}
                value={
                  enFoco === "costo" ? tecleado : pesos(form.costo_unitario)
                }
                onFocus={() => {
                  setEnFoco("costo");
                  setTecleado(pesos(form.costo_unitario));
                }}
                onBlur={() => setEnFoco(null)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                  setTecleado(pesos(v));
                  setForm({ ...form, costo_unitario: v });
                }}
              />
              {esPanel && (
                <span className="text-xs text-gray-500">
                  Sale de las materias primas del panel.
                </span>
              )}
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Precio de venta neto
              </span>
              <input
                type="text"
                inputMode="numeric"
                className={input}
                value={enFoco === "neto" ? tecleado : pesos(form.precio_venta)}
                onFocus={() => {
                  setEnFoco("neto");
                  setTecleado(pesos(form.precio_venta));
                }}
                onBlur={() => setEnFoco(null)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                  setTecleado(pesos(v));
                  // Tocar el precio a mano lo marca como manual: si no, el
                  // proximo recalculo del catalogo lo pisaria.
                  setForm({ ...form, precio_venta: v, precio_manual: true });
                }}
              />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                PVP (IVA {Math.round(iva * 100)}%)
              </span>
              <input
                type="text"
                inputMode="numeric"
                className={input}
                value={
                  enFoco === "pvp"
                    ? tecleado
                    : pesos(conIva(form.precio_venta, iva))
                }
                onFocus={() => {
                  setEnFoco("pvp");
                  setTecleado(pesos(conIva(form.precio_venta, iva)));
                }}
                onBlur={() => setEnFoco(null)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                  setTecleado(pesos(v));
                  setForm({
                    ...form,
                    precio_venta: Math.round(v / (1 + iva)),
                    precio_manual: true,
                  });
                }}
              />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Margen (%)
              </span>
              <input
                type="text"
                inputMode="decimal"
                className={input}
                value={
                  enFoco === "margen"
                    ? tecleado
                    : margenForm != null
                      ? porcentaje(margenForm * 100)
                      : ""
                }
                onFocus={() => {
                  setEnFoco("margen");
                  setTecleado(
                    margenForm != null ? porcentaje(margenForm * 100) : "",
                  );
                }}
                onBlur={() => setEnFoco(null)}
                onChange={(e) => {
                  const txt = e.target.value.replace(/[^0-9,.-]/g, "");
                  setTecleado(txt);
                  const m = Number(txt.replace(",", ".")) / 100;
                  // Margen sobre el precio: al 100% el precio se iria al
                  // infinito, asi que ahi no se recalcula nada.
                  if (Number.isFinite(m) && m < 1) {
                    setForm({
                      ...form,
                      precio_venta: Math.round(form.costo_unitario / (1 - m)),
                      precio_manual: true,
                    });
                  }
                }}
              />
              <span className="text-xs text-gray-500">
                Sobre el precio, no sobre el costo.
              </span>
            </label>
            <div className="text-sm space-y-2 md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.precio_manual}
                  onChange={(e) =>
                    setForm({ ...form, precio_manual: e.target.checked })
                  }
                />
                <span className="text-gray-700">
                  Precio manual (no se recalcula con el margen)
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm({ ...form, activo: e.target.checked })
                  }
                />
                <span className="text-gray-700">Activo</span>
              </label>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            La composicion (EPS y placas) no se edita aqui: cambiarla
            convertiria el panel en otro y dejaria las cotizaciones viejas
            apuntando a algo distinto. Para un panel diferente use el
            configurador.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={guardar}
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            {enEdicion.tipo === "Panel SIP" && (
              <button
                onClick={() =>
                  empezar(async () => {
                    const r = await volverAPrecioAutomatico(enEdicion.id);
                    if (r?.error) setError(r.error);
                    else {
                      setEditando(null);
                      setForm(null);
                    }
                  })
                }
                disabled={pendiente}
                className="border border-verde text-verde text-xs px-2.5 py-1 rounded disabled:opacity-50"
                title="Recalcula el precio desde el costo y el margen objetivo"
              >
                Volver al precio automatico
              </button>
            )}
            <button
              onClick={() => {
                setEditando(null);
                setForm(null);
              }}
              className="border border-verde text-verde text-xs px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Descripcion</th>
                {esAdmin && <th className="text-right px-3 py-2">Espesor</th>}
                {esAdmin && <th className="text-right px-3 py-2">Costo</th>}
                <th className="text-right px-3 py-2">Precio neto</th>
                <th className="text-right px-3 py-2">PVP c/IVA</th>
                {esAdmin && <th className="text-right px-3 py-2">Margen</th>}
                <th className="text-left px-3 py-2">Estado</th>
                {esAdmin && <th className="px-3" />}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={esAdmin ? 8 : 4}
                    className="text-center text-gray-400 py-8"
                  >
                    Sin productos que coincidan.
                  </td>
                </tr>
              )}
              {grupos.map((g) => (
                <Fragment key={g.familia}>
                  <tr className="bg-crema border-t border-dorado">
                    <td
                      colSpan={esAdmin ? 8 : 4}
                      className="px-3 py-1.5 text-[11px] font-semibold text-verde uppercase tracking-wide"
                    >
                      {g.familia}
                      <span className="ml-2 font-normal normal-case text-gray-500">
                        {g.total}
                      </span>
                    </td>
                  </tr>
                  {g.subgrupos.map((sg) => (
                    <Fragment key={sg.subfamilia}>
                      {sg.subfamilia && (
                        <tr className="border-t border-gray-100">
                          <td
                            colSpan={esAdmin ? 8 : 4}
                            className="px-3 pt-2 pb-1 pl-6 text-[11px] font-semibold text-dorado-osc"
                          >
                            {sg.subfamilia}
                            <span className="ml-2 font-normal text-gray-400">
                              {sg.lista.length}
                            </span>
                          </td>
                        </tr>
                      )}
                      {sg.lista.map((p) => (
                        <tr
                          key={p.id}
                          className="border-t border-gray-100 hover:bg-crema"
                        >
                          <td className="px-3 py-2 pl-6">
                            {p.descripcion}
                            {p.precio_manual && (
                              <span
                                className="ml-2 text-[10px] bg-dorado text-white px-1.5 py-0.5 rounded"
                                title="Precio fijado a mano: no se recalcula con el margen"
                              >
                                precio manual
                              </span>
                            )}
                          </td>
                          {esAdmin && (
                            <td className="px-3 py-2 text-right text-gray-600">
                              {p.espesor_total
                                ? `${unidades(p.espesor_total)} mm`
                                : ""}
                            </td>
                          )}
                          {esAdmin && (
                            <td className="px-3 py-2 text-right">
                              {pesos(p.costo_unitario)}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-semibold">
                            {pesos(p.precio_venta)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {pesos(conIva(p.precio_venta, iva))}
                          </td>
                          {esAdmin && (
                            <td className="px-3 py-2 text-right text-gray-600">
                              {p.margen_aplicado != null
                                ? `${porcentaje(p.margen_aplicado * 100)} %`
                                : ""}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            {p.activo ? (
                              <span className="text-green-700">Activo</span>
                            ) : (
                              <span className="text-gray-400">Inactivo</span>
                            )}
                          </td>
                          {esAdmin && (
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => editar(p)}
                                className="text-verde text-xs underline mr-2"
                              >
                                editar
                              </button>
                              <button
                                onClick={() =>
                                  empezar(async () => {
                                    await cambiarActivoProducto(
                                      p.id,
                                      !p.activo,
                                    );
                                  })
                                }
                                className="text-gray-500 text-xs underline"
                              >
                                {p.activo ? "desactivar" : "activar"}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </Fragment>
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
