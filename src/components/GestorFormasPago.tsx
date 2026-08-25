"use client";

import { useState, useTransition } from "react";
import {
  crearFormaPago,
  actualizarFormaPago,
  cambiarActivoFormaPago,
} from "@/app/formas-pago/acciones";
import type { FormaPago } from "@/types/database";

export default function GestorFormasPago({
  formas,
  esAdmin,
}: {
  formas: FormaPago[];
  esAdmin: boolean;
}) {
  const [editando, setEditando] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [orden, setOrden] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function nuevo() {
    setEditando(0);
    setError(null);
    setDesc("");
    // Se propone el siguiente multiplo de 10, que es como venian numeradas.
    const max = formas.reduce((m, f) => Math.max(m, f.orden ?? 0), 0);
    setOrden(String(max + 10));
  }

  function editar(f: FormaPago) {
    setEditando(f.id);
    setError(null);
    setDesc(f.descripcion);
    setOrden(String(f.orden ?? 0));
  }

  function guardar() {
    setError(null);
    empezar(async () => {
      const r =
        editando === 0
          ? await crearFormaPago(desc, Number(orden) || 0)
          : await actualizarFormaPago(editando as number, desc, Number(orden) || 0);
      if (r?.error) setError(r.error);
      else setEditando(null);
    });
  }

  return (
    <div className="space-y-4">
      {esAdmin && (
        <div className="flex justify-end">
          <button
            onClick={nuevo}
            className="bg-verde text-white text-sm font-semibold px-3 py-1.5 rounded"
          >
            Nueva forma de pago
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {editando !== null && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">
            {editando === 0 ? "Nueva forma de pago" : "Modificar forma de pago"}
          </div>
          <div className="grid md:grid-cols-[1fr_auto] gap-3">
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Descripcion
              </span>
              <input
                className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="50% de pie y 50% antes del retiro del material"
              />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Orden</span>
              <input
                type="number"
                className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={pendiente}
              className="bg-verde text-white text-sm font-semibold px-4 py-1.5 rounded disabled:opacity-50"
            >
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button
              onClick={() => setEditando(null)}
              className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-verde text-white">
            <tr>
              <th className="text-left px-3 py-2 w-20">Orden</th>
              <th className="text-left px-3 py-2">Descripcion</th>
              <th className="text-left px-3 py-2 w-20">Estado</th>
              {esAdmin && <th className="w-28" />}
            </tr>
          </thead>
          <tbody>
            {formas.map((f) => (
              <tr key={f.id} className="border-t border-gray-100 hover:bg-crema">
                <td className="px-3 py-2 text-gray-500">{f.orden}</td>
                <td className="px-3 py-2">{f.descripcion}</td>
                <td className="px-3 py-2">
                  {f.activo ? (
                    <span className="text-green-700">Activa</span>
                  ) : (
                    <span className="text-gray-400">Inactiva</span>
                  )}
                </td>
                {esAdmin && (
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => editar(f)}
                      className="text-verde text-xs underline mr-2"
                    >
                      editar
                    </button>
                    <button
                      onClick={() =>
                        empezar(async () => {
                          await cambiarActivoFormaPago(f.id, !f.activo);
                        })
                      }
                      className="text-gray-500 text-xs underline"
                    >
                      {f.activo ? "desactivar" : "activar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
