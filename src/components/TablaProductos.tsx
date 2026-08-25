"use client";

import { useMemo, useState } from "react";
import { pesos, porcentaje } from "@/lib/formato";

interface ProductoFila {
  id: number;
  descripcion: string;
  tipo: string;
  activo: boolean;
  espesor_total?: number | null;
  costo_unitario?: number | null;
  precio_venta: number;
  margen_aplicado?: number | null;
  precio_manual?: boolean | null;
}

export default function TablaProductos({
  productos,
  esAdmin,
}: {
  productos: ProductoFila[];
  esAdmin: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!soloActivos || p.activo) &&
        (!q || p.descripcion.toLowerCase().includes(q))
    );
  }, [busca, soloActivos, productos]);

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

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Descripcion</th>
                <th className="text-left px-3 py-2 w-24">Tipo</th>
                {esAdmin && <th className="text-right px-3 py-2 w-24">Espesor</th>}
                {esAdmin && <th className="text-right px-3 py-2 w-28">Costo</th>}
                <th className="text-right px-3 py-2 w-28">Precio</th>
                {esAdmin && <th className="text-right px-3 py-2 w-24">Margen</th>}
                <th className="text-left px-3 py-2 w-20">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={esAdmin ? 7 : 4}
                    className="text-center text-gray-400 py-8"
                  >
                    Sin productos que coincidan.
                  </td>
                </tr>
              )}
              {filtrados.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-crema">
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
                  <td className="px-3 py-2 text-gray-600">{p.tipo}</td>
                  {esAdmin && (
                    <td className="px-3 py-2 text-right text-gray-600">
                      {p.espesor_total ? `${p.espesor_total} mm` : ""}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
