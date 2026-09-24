"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BotonExportar from "@/components/BotonExportar";
import {
  actualizarTipoMateria,
  crearParametroMateria,
  crearTipoMateria,
  eliminarParametroMateria,
  eliminarTipoMateria,
  renombrarParametroMateria,
} from "@/app/parametros-materias/acciones";

export interface ValorLista {
  clase: string;
  nombre: string;
  usos: number;
}

export interface TipoMateriaVista {
  id: number;
  nombre: string;
  es_nucleo: boolean;
  es_cara: boolean;
  orden: number;
  activo: boolean;
  usos: number;
}

const CLASES = ["Etiqueta", "Familia", "Unidad"] as const;

// Listas con que se clasifica una materia prima. Aqui se crean y se borran, y
// en la ficha del insumo se eligen de un desplegable en vez de escribirse.
export default function GestorParametrosMaterias({
  idPais,
  valores,
  tipos,
}: {
  idPais: number;
  valores: ValorLista[];
  tipos: TipoMateriaVista[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [busca, setBusca] = useState("");
  const [clase, setClase] = useState("");
  const [nuevos, setNuevos] = useState<Record<string, string>>({});
  const [tipoNuevo, setTipoNuevo] = useState("");

  const input = "border border-gray-300 rounded px-2 py-1 text-sm";
  const boton = "bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded";
  const botonClaro =
    "border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-1 rounded bg-white whitespace-nowrap";

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

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return valores.filter(
      (v) =>
        (!clase || v.clase === clase) &&
        (!q || v.nombre.toLowerCase().includes(q))
    );
  }, [valores, busca, clase]);

  const tiposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tipos.filter((t) => !q || t.nombre.toLowerCase().includes(q));
  }, [tipos, busca]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${input} w-64`}
          placeholder="Buscar valor"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className={input}
          value={clase}
          onChange={(e) => setClase(e.target.value)}
        >
          <option value="">Todas las listas</option>
          {CLASES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <BotonExportar
          nombre="parametros-materias"
          columnas={[
            { titulo: "Lista", valor: (v: ValorLista) => v.clase },
            { titulo: "Valor", valor: (v: ValorLista) => v.nombre },
            { titulo: "Materias primas", valor: (v: ValorLista) => v.usos },
          ]}
          filas={filtrados}
          className="ml-auto"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {CLASES.filter((c) => !clase || c === clase).map((c) => {
          const lista = filtrados.filter((v) => v.clase === c);
          return (
            <div
              key={c}
              className="bg-white border border-gray-200 rounded overflow-hidden"
            >
              <div className="bg-verde text-white text-xs font-semibold px-3 py-2 flex items-center justify-between">
                <span>{c.toUpperCase()}</span>
                <span className="font-normal">{lista.length}</span>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    className={`${input} flex-1 min-w-0`}
                    placeholder={`Nueva ${c.toLowerCase()}`}
                    value={nuevos[c] ?? ""}
                    onChange={(e) =>
                      setNuevos((x) => ({ ...x, [c]: e.target.value }))
                    }
                  />
                  <button
                    className={boton}
                    disabled={pendiente || !(nuevos[c] ?? "").trim()}
                    onClick={() =>
                      correr(async () => {
                        const r = await crearParametroMateria(
                          idPais,
                          c,
                          nuevos[c] ?? ""
                        );
                        if (!r?.error) setNuevos((x) => ({ ...x, [c]: "" }));
                        return r;
                      })
                    }
                  >
                    Agregar
                  </button>
                </div>

                <table className="w-full text-xs table-fixed">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left font-semibold py-1">Valor</th>
                      <th className="text-right font-semibold py-1 w-12">Usos</th>
                      <th className="py-1 w-36" />
                    </tr>
                  </thead>
                  <tbody>
                    {lista.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-gray-400 py-3 text-center">
                          Sin valores.
                        </td>
                      </tr>
                    )}
                    {lista.map((v) => (
                      <tr key={v.nombre} className="border-t border-gray-100">
                        <td className="py-1 pr-2 truncate" title={v.nombre}>
                          {v.nombre}
                        </td>
                        <td className="py-1 text-right text-gray-500">{v.usos}</td>
                        <td className="py-1 text-right whitespace-nowrap space-x-1">
                          <button
                            className={botonClaro}
                            disabled={pendiente}
                            onClick={() => {
                              const n = window.prompt("Nuevo nombre", v.nombre);
                              if (n) {
                                correr(() =>
                                  renombrarParametroMateria(idPais, c, v.nombre, n)
                                );
                              }
                            }}
                          >
                            renombrar
                          </button>
                          <button
                            className={botonClaro}
                            disabled={pendiente}
                            onClick={() =>
                              correr(() =>
                                eliminarParametroMateria(idPais, c, v.nombre)
                              )
                            }
                          >
                            eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
          TIPOS DE MATERIA PRIMA
        </div>
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${input} w-56`}
              placeholder="Nuevo tipo"
              value={tipoNuevo}
              onChange={(e) => setTipoNuevo(e.target.value)}
            />
            <button
              className={boton}
              disabled={pendiente || !tipoNuevo.trim()}
              onClick={() =>
                correr(async () => {
                  const r = await crearTipoMateria({
                    nombre: tipoNuevo,
                    es_nucleo: false,
                    es_cara: false,
                    orden: tipos.length + 1,
                    activo: true,
                  });
                  if (!r?.error) setTipoNuevo("");
                  return r;
                })
              }
            >
              Agregar
            </button>
            <span className="text-xs text-gray-500">
              El tipo vale para todos los mercados: dice si el insumo puede ser
              nucleo o cara de un panel.
            </span>
            <BotonExportar
              nombre="tipos-materia"
              columnas={[
                { titulo: "Tipo", valor: (t: TipoMateriaVista) => t.nombre },
                {
                  titulo: "Nucleo",
                  valor: (t: TipoMateriaVista) => (t.es_nucleo ? "Si" : "No"),
                },
                {
                  titulo: "Cara",
                  valor: (t: TipoMateriaVista) => (t.es_cara ? "Si" : "No"),
                },
                { titulo: "Orden", valor: (t: TipoMateriaVista) => t.orden },
                {
                  titulo: "Activo",
                  valor: (t: TipoMateriaVista) => (t.activo ? "Si" : "No"),
                },
                { titulo: "Materias primas", valor: (t: TipoMateriaVista) => t.usos },
              ]}
              filas={tiposFiltrados}
              className="ml-auto"
            />
          </div>

          <table className="w-full text-xs table-fixed">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left font-semibold py-1">Tipo</th>
                <th className="text-center font-semibold py-1 w-20">Nucleo</th>
                <th className="text-center font-semibold py-1 w-20">Cara</th>
                <th className="text-center font-semibold py-1 w-20">Activo</th>
                <th className="text-right font-semibold py-1 w-16">Usos</th>
                <th className="py-1 w-40" />
              </tr>
            </thead>
            <tbody>
              {tiposFiltrados.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="py-1 pr-2 truncate" title={t.nombre}>
                    {t.nombre}
                  </td>
                  {(
                    [
                      ["es_nucleo", t.es_nucleo],
                      ["es_cara", t.es_cara],
                      ["activo", t.activo],
                    ] as const
                  ).map(([campo, valor]) => (
                    <td key={campo} className="py-1 text-center">
                      <input
                        type="checkbox"
                        checked={valor}
                        disabled={pendiente}
                        onChange={(e) =>
                          correr(() =>
                            actualizarTipoMateria(t.id, {
                              nombre: t.nombre,
                              es_nucleo: campo === "es_nucleo" ? e.target.checked : t.es_nucleo,
                              es_cara: campo === "es_cara" ? e.target.checked : t.es_cara,
                              orden: t.orden,
                              activo: campo === "activo" ? e.target.checked : t.activo,
                            })
                          )
                        }
                      />
                    </td>
                  ))}
                  <td className="py-1 text-right text-gray-500">{t.usos}</td>
                  <td className="py-1 text-right whitespace-nowrap space-x-1">
                    <button
                      className={botonClaro}
                      disabled={pendiente}
                      onClick={() => {
                        const n = window.prompt("Nuevo nombre del tipo", t.nombre);
                        if (n) {
                          correr(() =>
                            actualizarTipoMateria(t.id, {
                              nombre: n,
                              es_nucleo: t.es_nucleo,
                              es_cara: t.es_cara,
                              orden: t.orden,
                              activo: t.activo,
                            })
                          );
                        }
                      }}
                    >
                      renombrar
                    </button>
                    <button
                      className={botonClaro}
                      disabled={pendiente}
                      onClick={() => correr(() => eliminarTipoMateria(t.id))}
                    >
                      eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Un valor con materias primas asociadas no se elimina: primero hay que
        cambiar esas materias primas. Renombrar, en cambio, las arrastra.
      </p>
    </div>
  );
}
