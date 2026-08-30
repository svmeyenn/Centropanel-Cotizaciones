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
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!soloActivos || p.activo) &&
        (!q ||
          p.descripcion.toLowerCase().includes(q) ||
          (p.familia ?? "").toLowerCase().includes(q)),
    );
  }, [busca, soloActivos, productos]);

  // El catalogo se lee por familia (Paneles SIP, Madera, Tornillos...): una
  // lista plana de decenas de tornillos obliga a recorrerla entera para dar
  // con lo que se busca.
  const grupos = useMemo(() => {
    const g = new Map<string, ProductoFila[]>();
    for (const p of filtrados) {
      const f = p.familia ?? "Otros";
      const lista = g.get(f);
      if (lista) lista.push(p);
      else g.set(f, [p]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtrados]);

  const enEdicion = productos.find((p) => p.id === editando) ?? null;

  function editar(p: ProductoFila) {
    setEditando(p.id);
    setError(null);
    setForm({
      descripcion: p.descripcion,
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

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm md:col-span-2">
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
                Precio de venta
              </span>
              <input
                type="number"
                className={input}
                value={form.precio_venta}
                onChange={(e) =>
                  setForm({
                    ...form,
                    precio_venta: Number(e.target.value) || 0,
                    // Tocar el precio a mano lo marca como manual: si no, el
                    // proximo recalculo del catalogo lo pisaria.
                    precio_manual: true,
                  })
                }
              />
              {enEdicion.costo_unitario != null && form.precio_venta > 0 && (
                <span className="text-xs text-gray-500">
                  Margen resultante:{" "}
                  {porcentaje(
                    ((form.precio_venta - Number(enEdicion.costo_unitario)) /
                      form.precio_venta) *
                      100,
                  )}{" "}
                  %
                </span>
              )}
            </label>
            <div className="text-sm space-y-2">
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
              className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded"
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
              {grupos.map(([familia, lista]) => (
                <Fragment key={familia}>
                  <tr className="bg-crema border-t border-dorado">
                    <td
                      colSpan={esAdmin ? 8 : 4}
                      className="px-3 py-1.5 text-[11px] font-semibold text-verde uppercase tracking-wide"
                    >
                      {familia}
                      <span className="ml-2 font-normal normal-case text-gray-500">
                        {lista.length}
                      </span>
                    </td>
                  </tr>
                  {lista.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-gray-100 hover:bg-crema"
                    >
                      <td className="px-3 py-2">
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
                                await cambiarActivoProducto(p.id, !p.activo);
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
