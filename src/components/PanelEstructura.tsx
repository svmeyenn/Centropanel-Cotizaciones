"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import { pesosConCentimos as pesos } from "@/lib/formato";
import {
  asignarCentroCosto,
  guardarCentro,
  guardarPais,
  guardarUnidad,
  type Resultado,
} from "@/app/estructura/acciones";
import type { CentroCosto, PaisFicha, UnidadNegocio } from "@/lib/estructura";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";
const BOTON = "bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white whitespace-nowrap disabled:opacity-50";

type ProyectoMin = { id_proyecto: number; id_pais: number; id_centro_costo: number | null };
type MovMin = {
  id_mov: number;
  id_pais: number;
  tipo: string;
  fecha: string | null;
  origen_destino: string | null;
  monto: number;
  id_categoria: number | null;
};

type Edicion =
  | { que: "unidad"; fila: UnidadNegocio | null; idPais: number }
  | { que: "centro"; fila: CentroCosto | null; idUnidad: number }
  | { que: "pais"; fila: PaisFicha | null };

// Como se ordena la gestion: cada mercado tiene sus unidades de negocio, cada
// unidad sus centros de costo, y los proyectos cuelgan de un centro. Aqui se
// arma esa estructura y se clasifica lo que todavia no la tiene.
export default function PanelEstructura({
  unidades,
  centros,
  paises,
  proyectos,
  sinClasificar,
  categorias,
  esAdminGeneral,
}: {
  unidades: UnidadNegocio[];
  centros: CentroCosto[];
  paises: PaisFicha[];
  proyectos: ProyectoMin[];
  sinClasificar: MovMin[];
  categorias: { id_categoria: number; nombre: string }[];
  esAdminGeneral: boolean;
}) {
  const router = useRouter();
  const [enCurso, empezar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [elegido, setElegido] = useState<Record<number, string>>({});

  const mercados = paises.filter((p) => p.opera && p.activo);
  const nombreCategoria = new Map(categorias.map((c) => [c.id_categoria, c.nombre]));

  function correr(accion: () => Promise<Resultado>) {
    empezar(async () => {
      const r = await accion();
      setAviso({ ok: r.ok, texto: r.mensaje ?? "" });
      if (r.ok) router.refresh();
    });
  }

  const cuantosProyectos = (idCentro: number) =>
    proyectos.filter((p) => p.id_centro_costo === idCentro).length;

  const sinCentro = (idPais: number) =>
    proyectos.filter((p) => p.id_pais === idPais && p.id_centro_costo === null).length;

  return (
    <>
      {aviso && (
        <p
          className={`text-xs rounded px-3 py-2 border ${
            aviso.ok ? "bg-crema border-gray-200 text-gray-700" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {mercados.map((m) => {
        const uns = unidades.filter((u) => u.id_pais === m.id);
        return (
          <section key={m.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
                {m.nombre} ({m.codigo})
                {sinCentro(m.id) > 0 && (
                  <span className="ml-2 text-red-700 normal-case tracking-normal">
                    {sinCentro(m.id)} proyecto(s) sin centro de costo
                  </span>
                )}
              </h2>
              <button
                className={BOTON}
                onClick={() => setEdicion({ que: "unidad", fila: null, idPais: m.id })}
              >
                + Unidad de negocio
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {uns.map((u) => {
                const ccs = centros.filter((c) => c.id_unidad === u.id);
                return (
                  <div
                    key={u.id}
                    className={`bg-white border rounded ${u.activa ? "border-gray-200" : "border-gray-200 opacity-60"}`}
                  >
                    <div className="bg-verde text-white px-3 py-2 rounded-t flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] opacity-80">{u.codigo}</div>
                        <div className="text-sm font-semibold">
                          {u.nombre}
                          {!u.activa && " (inactiva)"}
                        </div>
                      </div>
                      <button
                        className="text-[11px] underline"
                        onClick={() => setEdicion({ que: "unidad", fila: u, idPais: m.id })}
                      >
                        Editar
                      </button>
                    </div>
                    <ul className="divide-y divide-gray-100 text-xs">
                      {ccs.length === 0 && (
                        <li className="px-3 py-3 text-gray-500">Sin centros de costo.</li>
                      )}
                      {ccs.map((c) => (
                        <li
                          key={c.id}
                          className={`px-3 py-1.5 flex items-center justify-between gap-2 ${c.activo ? "" : "opacity-50"}`}
                        >
                          <span>
                            <span className="text-gray-500 tabular-nums">{c.codigo}</span> {c.nombre}
                            {!c.activo && " (inactivo)"}
                            <span className="block text-[11px] text-gray-500">
                              {cuantosProyectos(c.id)} proyecto(s)
                            </span>
                          </span>
                          <button
                            className="text-[11px] text-verde underline"
                            onClick={() => setEdicion({ que: "centro", fila: c, idUnidad: u.id })}
                          >
                            Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="px-3 py-2 border-t border-gray-100">
                      <button
                        className={BOTON_CLARO}
                        onClick={() => setEdicion({ que: "centro", fila: null, idUnidad: u.id })}
                      >
                        + Centro de costo
                      </button>
                    </div>
                  </div>
                );
              })}
              {uns.length === 0 && (
                <p className="text-xs text-gray-500 lg:col-span-3">Este mercado todavia no tiene unidades de negocio.</p>
              )}
            </div>
          </section>
        );
      })}

      {/* --- movimientos sin clasificar --- */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
          Movimientos sin proyecto ni centro de costo ({sinClasificar.length})
        </h2>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2 w-[10%]">Fecha</th>
                  <th className="text-left px-3 py-2 w-[26%]">Origen / Destino</th>
                  <th className="text-left px-3 py-2 w-[14%]">Categoria</th>
                  <th className="text-right px-3 py-2 w-[12%]">Monto</th>
                  <th className="text-left px-3 py-2 w-[38%]">Centro de costo</th>
                </tr>
              </thead>
              <tbody>
                {sinClasificar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8">
                      Todos los movimientos tienen proyecto o centro de costo.
                    </td>
                  </tr>
                )}
                {sinClasificar.map((m) => {
                  const opciones = unidades
                    .filter((u) => u.id_pais === m.id_pais && u.activa)
                    .map((u) => ({ u, ccs: centros.filter((c) => c.id_unidad === u.id && c.activo) }))
                    .filter((x) => x.ccs.length > 0);
                  return (
                    <tr key={m.id_mov} className="border-t border-gray-100 hover:bg-crema">
                      <td className="px-3 py-2 whitespace-nowrap">{m.fecha ?? ""}</td>
                      <td className="px-3 py-2 truncate" title={m.origen_destino ?? ""}>
                        {m.origen_destino}
                        <span className="block text-[11px] text-gray-500">{m.tipo}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 truncate">
                        {m.id_categoria ? (nombreCategoria.get(m.id_categoria) ?? "") : ""}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{pesos(m.monto)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5">
                          <select
                            className={CAMPO}
                            value={elegido[m.id_mov] ?? ""}
                            onChange={(e) => setElegido((p) => ({ ...p, [m.id_mov]: e.target.value }))}
                          >
                            <option value="">Elija</option>
                            {opciones.map(({ u, ccs }) => (
                              <optgroup key={u.id} label={u.nombre}>
                                {ccs.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.codigo} {c.nombre}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <button
                            className={BOTON_CLARO}
                            disabled={enCurso || !elegido[m.id_mov]}
                            onClick={() => correr(() => asignarCentroCosto(m.id_mov, Number(elegido[m.id_mov])))}
                          >
                            Clasificar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          Los movimientos de un proyecto toman el centro de costo del proyecto: se cambia en el proyecto, no aqui.
        </p>
      </section>

      {/* --- paises --- */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
            Paises ({paises.length})
          </h2>
          {esAdminGeneral && (
            <button className={BOTON} onClick={() => setEdicion({ que: "pais", fila: null })}>
              + Pais
            </button>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2 w-[10%]">Codigo</th>
                <th className="text-left px-3 py-2 w-[26%]">Pais</th>
                <th className="text-left px-3 py-2 w-[10%]">Moneda</th>
                <th className="text-left px-3 py-2 w-[24%]">Uso</th>
                <th className="text-left px-3 py-2 w-[14%]">Estado</th>
                <th className="px-3 py-2 w-[16%]" />
              </tr>
            </thead>
            <tbody>
              {paises.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{p.codigo}</td>
                  <td className="px-3 py-2">{p.nombre}</td>
                  <td className="px-3 py-2">{p.moneda_base}</td>
                  <td className="px-3 py-2">{p.opera ? "Mercado donde se opera" : "Solo origen de leads"}</td>
                  <td className="px-3 py-2 text-gray-600">{p.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2 text-right">
                    {esAdminGeneral && (
                      <button className={BOTON_CLARO} onClick={() => setEdicion({ que: "pais", fila: p })}>
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-500">
          Un pais nuevo sirve para clasificar de donde viene un lead. Habilitarlo como mercado donde se
          opera --con sus precios, impuestos, usuarios y unidades-- es un paso aparte.
        </p>
      </section>

      {edicion?.que === "unidad" && (
        <FichaEstructura
          titulo={edicion.fila ? "Editar unidad de negocio" : "Nueva unidad de negocio"}
          accion={guardarUnidad}
          onCerrar={() => setEdicion(null)}
          alGuardar={(t) => {
            setEdicion(null);
            setAviso({ ok: true, texto: t });
            router.refresh();
          }}
        >
          {edicion.fila ? (
            <input type="hidden" name="id" value={edicion.fila.id} />
          ) : (
            <input type="hidden" name="id_pais" value={edicion.idPais} />
          )}
          <Campo rotulo="Codigo *" name="codigo" defecto={edicion.fila?.codigo} maxLength={8} placeholder="OBR" />
          <Campo rotulo="Nombre *" name="nombre" defecto={edicion.fila?.nombre} />
          <Campo rotulo="Orden" name="orden" defecto={String(edicion.fila?.orden ?? 0)} />
          <Vigente name="activa" marcado={edicion.fila?.activa ?? true} texto="Vigente: se ofrece al clasificar" />
        </FichaEstructura>
      )}

      {edicion?.que === "centro" && (
        <FichaEstructura
          titulo={edicion.fila ? "Editar centro de costo" : "Nuevo centro de costo"}
          accion={guardarCentro}
          onCerrar={() => setEdicion(null)}
          alGuardar={(t) => {
            setEdicion(null);
            setAviso({ ok: true, texto: t });
            router.refresh();
          }}
        >
          {edicion.fila ? (
            <input type="hidden" name="id" value={edicion.fila.id} />
          ) : (
            <input type="hidden" name="id_unidad" value={edicion.idUnidad} />
          )}
          <Campo rotulo="Codigo *" name="codigo" defecto={edicion.fila?.codigo} maxLength={10} placeholder="OBR-05" />
          <Campo rotulo="Nombre *" name="nombre" defecto={edicion.fila?.nombre} />
          <Campo rotulo="Orden" name="orden" defecto={String(edicion.fila?.orden ?? 0)} />
          <Vigente name="activo" marcado={edicion.fila?.activo ?? true} texto="Vigente: se ofrece al clasificar" />
        </FichaEstructura>
      )}

      {edicion?.que === "pais" && (
        <FichaEstructura
          titulo={edicion.fila ? "Editar pais" : "Nuevo pais"}
          accion={guardarPais}
          onCerrar={() => setEdicion(null)}
          alGuardar={(t) => {
            setEdicion(null);
            setAviso({ ok: true, texto: t });
            router.refresh();
          }}
        >
          {edicion.fila && <input type="hidden" name="id" value={edicion.fila.id} />}
          <Campo rotulo="Codigo *" name="codigo" defecto={edicion.fila?.codigo} maxLength={3} placeholder="AR" />
          <Campo rotulo="Nombre *" name="nombre" defecto={edicion.fila?.nombre} />
          <Campo rotulo="Moneda" name="moneda_base" defecto={edicion.fila?.moneda_base} placeholder="USD" maxLength={3} />
          <Campo rotulo="Prefijo telefonico" name="prefijo_telefono" defecto={edicion.fila?.prefijo_telefono} placeholder="+54" />
          <Campo rotulo="Nombre del identificador tributario" name="etiqueta_id" defecto={edicion.fila?.etiqueta_id} placeholder="CUIT" />
          <Vigente name="activo" marcado={edicion.fila?.activo ?? true} texto="Activo: se ofrece al clasificar leads" />
        </FichaEstructura>
      )}
    </>
  );
}

function Campo({
  rotulo,
  name,
  defecto,
  placeholder,
  maxLength,
}: {
  rotulo: string;
  name: string;
  defecto?: string | null;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className={ROTULO}>{rotulo}</label>
      <input
        name={name}
        className={CAMPO}
        defaultValue={defecto ?? ""}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );
}

function Vigente({ name, marcado, texto }: { name: string; marcado: boolean; texto: string }) {
  return (
    <label className="sm:col-span-2 flex items-center gap-2 text-xs">
      <input type="checkbox" name={name} defaultChecked={marcado} />
      {texto}
    </label>
  );
}

function FichaEstructura({
  titulo,
  accion,
  onCerrar,
  alGuardar,
  children,
}: {
  titulo: string;
  accion: (previo: Resultado | null, datos: FormData) => Promise<Resultado>;
  onCerrar: () => void;
  alGuardar: (mensaje: string) => void;
  children: React.ReactNode;
}) {
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();
  return (
    <Ventana titulo={titulo} onCerrar={onCerrar} ancho="max-w-xl">
      <form
        action={(datos: FormData) => {
          setError("");
          empezar(async () => {
            const r = await accion(null, datos);
            if (!r.ok) {
              setError(r.mensaje ?? "No se pudo guardar.");
              return;
            }
            alGuardar(r.mensaje ?? "Guardado.");
          });
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        {children}
        {error && (
          <p className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {error}
          </p>
        )}
        <div className="sm:col-span-2 flex gap-2 justify-end">
          <button type="button" className={BOTON_CLARO} onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </button>
          <button type="submit" className={BOTON} disabled={pendiente}>
            {pendiente ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
