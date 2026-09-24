"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  crearFamilia,
  crearSubfamilia,
  eliminarFamilia,
  eliminarSubfamilia,
  moverProducto,
  renombrarFamilia,
  renombrarSubfamilia,
} from "@/app/familias/acciones";
import { asignarGrupoFamilia } from "@/app/productos/acciones";
import { GRUPOS_DESCUENTO, GRUPO_PRODUCTOS } from "@/lib/descuentos";

export interface FamiliaVista {
  nombre: string;
  grupo: string;
  subfamilias: string[];
  productos: { id: number; descripcion: string; subfamilia: string | null }[];
}

// Familias y subfamilias del catalogo de un mercado: crear, renombrar,
// eliminar y mover productos entre ellas. Una familia o subfamilia con
// productos no se elimina: primero hay que moverlos, para no dejar productos
// sin clasificacion.
export default function GestorFamilias({
  idPais,
  familias,
}: {
  idPais: number;
  familias: FamiliaVista[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [nuevaFamilia, setNuevaFamilia] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState<string>(GRUPO_PRODUCTOS);
  const [nuevaSub, setNuevaSub] = useState("");

  const input = "border border-gray-300 rounded px-2 py-1 text-sm";
  const boton = "bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded";
  const botonClaro =
    "border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-1 rounded bg-white";

  // Toda accion sigue el mismo camino: se ejecuta, si falla se muestra el
  // motivo y si sale bien se recarga la pantalla con los datos nuevos.
  function correr(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (r && r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded p-3">
        <div className="text-sm font-semibold text-verde mb-2">Nueva familia</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">Nombre</span>
            <input
              className={`${input} w-56`}
              value={nuevaFamilia}
              onChange={(e) => setNuevaFamilia(e.target.value)}
              placeholder="Instalaciones"
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Descuento al que pertenece
            </span>
            <select
              className={input}
              value={nuevoGrupo}
              onChange={(e) => setNuevoGrupo(e.target.value)}
            >
              {GRUPOS_DESCUENTO.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <button
            className={boton}
            disabled={pendiente || !nuevaFamilia.trim()}
            onClick={() =>
              correr(async () => {
                const r = await crearFamilia(idPais, nuevaFamilia, nuevoGrupo);
                if (!r?.error) setNuevaFamilia("");
                return r;
              })
            }
          >
            Crear
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th className="text-left px-3 py-2">Familia</th>
              <th className="text-left px-3 py-2 w-48">Descuento</th>
              <th className="text-right px-3 py-2 w-24">Productos</th>
              <th className="px-3 py-2 w-56" />
            </tr>
          </thead>
          <tbody>
            {familias.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-8">
                  Todavia no hay familias en este mercado.
                </td>
              </tr>
            )}
            {familias.map((f) => (
              <Fragment key={f.nombre}>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold text-verde">{f.nombre}</td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-gray-300 rounded bg-white text-[11px] px-1 py-0.5"
                      value={f.grupo}
                      disabled={pendiente}
                      onChange={(e) =>
                        correr(() => asignarGrupoFamilia(f.nombre, e.target.value))
                      }
                    >
                      {GRUPOS_DESCUENTO.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">{f.productos.length}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      className={botonClaro}
                      onClick={() =>
                        setAbierta(abierta === f.nombre ? null : f.nombre)
                      }
                    >
                      {abierta === f.nombre ? "cerrar" : "subfamilias"}
                    </button>
                    <button
                      className={botonClaro}
                      disabled={pendiente}
                      onClick={() => {
                        const n = window.prompt(
                          "Nuevo nombre de la familia",
                          f.nombre
                        );
                        if (n) correr(() => renombrarFamilia(idPais, f.nombre, n));
                      }}
                    >
                      renombrar
                    </button>
                    <button
                      className={botonClaro}
                      disabled={pendiente}
                      onClick={() => correr(() => eliminarFamilia(idPais, f.nombre))}
                    >
                      eliminar
                    </button>
                  </td>
                </tr>

                {abierta === f.nombre && (
                  <tr className="bg-crema border-t border-dorado">
                    <td colSpan={4} className="px-3 py-3 space-y-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-xs">
                          <span className="block text-dorado-osc font-semibold mb-0.5">
                            Nueva subfamilia
                          </span>
                          <input
                            className={`${input} w-56`}
                            value={nuevaSub}
                            onChange={(e) => setNuevaSub(e.target.value)}
                          />
                        </label>
                        <button
                          className={boton}
                          disabled={pendiente || !nuevaSub.trim()}
                          onClick={() =>
                            correr(async () => {
                              const r = await crearSubfamilia(
                                idPais,
                                f.nombre,
                                nuevaSub
                              );
                              if (!r?.error) setNuevaSub("");
                              return r;
                            })
                          }
                        >
                          Agregar
                        </button>
                      </div>

                      {f.subfamilias.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {f.subfamilias.map((sf) => (
                            <span
                              key={sf}
                              className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1"
                            >
                              {sf}
                              <button
                                className="text-[11px] text-gray-600 underline"
                                disabled={pendiente}
                                onClick={() => {
                                  const n = window.prompt(
                                    "Nuevo nombre de la subfamilia",
                                    sf
                                  );
                                  if (n) {
                                    correr(() =>
                                      renombrarSubfamilia(idPais, f.nombre, sf, n)
                                    );
                                  }
                                }}
                              >
                                renombrar
                              </button>
                              <button
                                className="text-[11px] text-gray-600 underline"
                                disabled={pendiente}
                                onClick={() =>
                                  correr(() =>
                                    eliminarSubfamilia(idPais, f.nombre, sf)
                                  )
                                }
                              >
                                eliminar
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {f.productos.length > 0 && (
                        <table className="w-full text-[11px] bg-white border border-gray-200 rounded">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="text-left px-2 py-1">Producto</th>
                              <th className="text-left px-2 py-1 w-56">Familia</th>
                              <th className="text-left px-2 py-1 w-56">Subfamilia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.productos.map((pr) => (
                              <tr key={pr.id} className="border-t border-gray-100">
                                <td className="px-2 py-1">{pr.descripcion}</td>
                                <td className="px-2 py-1">
                                  <select
                                    className="border border-gray-300 rounded px-1 py-0.5 w-full"
                                    value={f.nombre}
                                    disabled={pendiente}
                                    onChange={(e) =>
                                      correr(() =>
                                        moverProducto(pr.id, e.target.value, null)
                                      )
                                    }
                                  >
                                    {familias.map((x) => (
                                      <option key={x.nombre} value={x.nombre}>
                                        {x.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2 py-1">
                                  <select
                                    className="border border-gray-300 rounded px-1 py-0.5 w-full"
                                    value={pr.subfamilia ?? ""}
                                    disabled={pendiente}
                                    onChange={(e) =>
                                      correr(() =>
                                        moverProducto(
                                          pr.id,
                                          f.nombre,
                                          e.target.value || null
                                        )
                                      )
                                    }
                                  >
                                    <option value="">(sin subfamilia)</option>
                                    {f.subfamilias.map((sf) => (
                                      <option key={sf} value={sf}>
                                        {sf}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        El descuento de la familia decide sobre que base se aplica cada uno de
        los tres descuentos de la cotizacion. Un producto suelto puede salirse
        de su familia desde su ficha en el catalogo.
      </p>
    </div>
  );
}
