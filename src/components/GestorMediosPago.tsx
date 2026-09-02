"use client";

import { useState, useTransition } from "react";
import { porcentaje } from "@/lib/formato";
import {
  actualizarMedioPago,
  crearMedioPago,
} from "@/app/formas-pago/acciones";

export interface MedioPago {
  id: number;
  nombre: string;
  comision_pct: number;
  activo: boolean;
}

// Como paga el cliente. Tarjeta y link de pago cobran comision: no se descuenta
// del precio, se recarga sobre el total dividiendo por (1 - comision), para que
// a Centro Panel le llegue integro lo cotizado.
export default function GestorMediosPago({
  medios,
  esAdmin,
}: {
  medios: MedioPago[];
  esAdmin: boolean;
}) {
  const [edit, setEdit] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [comision, setComision] = useState("0");
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const input = "border border-gray-300 rounded px-2 py-1 text-sm";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-verde">Medios de pago</h2>
        {esAdmin && !nuevo && (
          <button
            onClick={() => {
              setError(null);
              setNombre("");
              setComision("0");
              setNuevo(true);
            }}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Nuevo medio
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        La comision no se descuenta del precio: se recarga sobre el total
        dividiendo por (1 &minus; comision). Con 1 %, cobrar 1.000 significa
        facturar 1.010.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {nuevo && (
        <div className="bg-white border border-dorado rounded p-3 flex flex-wrap gap-2 items-end">
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-1">
              Nombre
            </span>
            <input
              className={`${input} w-48`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-1">
              Comision (%)
            </span>
            <input
              type="number"
              step="0.01"
              className={`${input} w-24 text-right`}
              value={comision}
              onChange={(e) => setComision(e.target.value)}
            />
          </label>
          <button
            onClick={() =>
              empezar(async () => {
                const r = await crearMedioPago(nombre, Number(comision) || 0);
                if (r?.error) setError(r.error);
                else setNuevo(false);
              })
            }
            disabled={pendiente || !nombre.trim()}
            className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
          >
            Grabar
          </button>
          <button
            onClick={() => setNuevo(false)}
            className="border border-verde text-verde text-xs px-2.5 py-1 rounded"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th className="text-left px-3 py-2">Medio</th>
              <th className="text-right px-3 py-2 w-28">Comision</th>
              <th className="text-left px-3 py-2 w-20">Estado</th>
              {esAdmin && <th className="w-28" />}
            </tr>
          </thead>
          <tbody>
            {medios.map((m) => (
              <tr key={m.id} className="border-t border-gray-100 hover:bg-crema">
                <td className="px-3 py-2">
                  {edit === m.id ? (
                    <input
                      className={`${input} w-48`}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  ) : (
                    m.nombre
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {edit === m.id ? (
                    <input
                      type="number"
                      step="0.01"
                      className={`${input} w-24 text-right`}
                      value={comision}
                      onChange={(e) => setComision(e.target.value)}
                    />
                  ) : Number(m.comision_pct) > 0 ? (
                    `${porcentaje(m.comision_pct)} %`
                  ) : (
                    <span className="text-gray-400">sin comision</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {m.activo ? (
                    <span className="text-green-700">Activo</span>
                  ) : (
                    <span className="text-gray-400">Inactivo</span>
                  )}
                </td>
                {esAdmin && (
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {edit === m.id ? (
                      <>
                        <button
                          onClick={() =>
                            empezar(async () => {
                              const r = await actualizarMedioPago(
                                m.id,
                                nombre,
                                Number(comision) || 0,
                                m.activo
                              );
                              if (r?.error) setError(r.error);
                              else setEdit(null);
                            })
                          }
                          className="text-verde text-xs underline mr-2"
                        >
                          grabar
                        </button>
                        <button
                          onClick={() => setEdit(null)}
                          className="text-gray-500 text-xs underline"
                        >
                          cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setError(null);
                            setEdit(m.id);
                            setNombre(m.nombre);
                            setComision(String(m.comision_pct));
                          }}
                          className="text-verde text-xs underline mr-2"
                        >
                          editar
                        </button>
                        <button
                          onClick={() =>
                            empezar(async () => {
                              const r = await actualizarMedioPago(
                                m.id,
                                m.nombre,
                                Number(m.comision_pct),
                                !m.activo
                              );
                              if (r?.error) setError(r.error);
                            })
                          }
                          className="text-gray-500 text-xs underline"
                        >
                          {m.activo ? "desactivar" : "activar"}
                        </button>
                      </>
                    )}
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
