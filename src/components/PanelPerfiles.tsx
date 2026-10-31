"use client";

import { Fragment, useState, useTransition } from "react";
import {
  crearPerfil,
  eliminarPerfil,
  guardarPerfil,
  guardarTope,
  type DatosPerfil,
} from "@/app/perfiles/acciones";
import { AREAS, CASILLAS_FIN, NIVELES, TEXTO_NIVEL, type Nivel } from "@/lib/permisos";
import type { PerfilAcceso } from "@/types/database";

interface Tope {
  id_perfil: number;
  id_pais: number;
  tope: number | null;
}
interface Pais {
  id: number;
  nombre: string;
  moneda_base: string;
}
interface Persona {
  id: number;
  nombre: string;
  id_perfil: number | null;
}
interface Excepcion {
  id: number;
  en: string;
  regla: string;
  id_mov: number | null;
  monto: number | null;
  detalle: string | null;
  vendedores: { nombre: string } | null;
}

// El nivel va siempre escrito: el color ayuda a leer la fila, no es lo unico que dice.
const ESTILO_NIVEL: Record<Nivel, string> = {
  ninguno: "text-gray-500",
  ver: "bg-gray-100 text-gray-700",
  operar: "bg-verde/10 text-verde",
  aprobar: "bg-dorado/25 text-dorado-osc",
  administrar: "bg-verde text-white",
};

function Nivel_({ n }: { n: string }) {
  const nivel = (NIVELES as readonly string[]).includes(n) ? (n as Nivel) : "ninguno";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${ESTILO_NIVEL[nivel]}`}>
      {nivel === "ninguno" ? "—" : TEXTO_NIVEL[nivel]}
    </span>
  );
}

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full bg-white";

// El rol base es el rol del sistema con que entra la persona; el perfil afina el resto.
const ROLES_BASE = [
  ["Administrador", "Administrador"],
  ["Supervisor", "Supervisor"],
  ["Vendedor", "Vendedor"],
  ["Comprador", "Comprador"],
  ["Consulta", "Solo consulta"],
] as const;

const VACIO: DatosPerfil = {
  nombre: "",
  ejemplo: "",
  alcance: "",
  rolBase: "Consulta",
  permisos: Object.fromEntries(AREAS.map((a) => [a.k, "ninguno"])),
  fin: {},
};

function FormPerfil({
  borrador,
  setBorrador,
  pendiente,
  textoGuardar,
  onGuardar,
  onCancelar,
  onEliminar,
  personas,
}: {
  borrador: DatosPerfil;
  setBorrador: (d: DatosPerfil) => void;
  pendiente: boolean;
  textoGuardar: string;
  onGuardar: () => void;
  onCancelar: () => void;
  onEliminar?: () => void;
  personas?: number;
}) {
  const cambia = (c: Partial<DatosPerfil>) => setBorrador({ ...borrador, ...c });
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Nombre del perfil</span>
          <input className={input} value={borrador.nombre} onChange={(e) => cambia({ nombre: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Quien lo usa (ejemplo)</span>
          <input
            className={input}
            value={borrador.ejemplo}
            placeholder="Ej: Alexa, Pedro"
            onChange={(e) => cambia({ ejemplo: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Alcance</span>
          <input
            className={input}
            value={borrador.alcance}
            placeholder="Ej: Un mercado, sus obras"
            onChange={(e) => cambia({ alcance: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Rol base</span>
          <select className={input} value={borrador.rolBase} onChange={(e) => cambia({ rolBase: e.target.value })}>
            {ROLES_BASE.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-xs text-dorado-osc font-semibold mb-2">NIVEL EN CADA AREA</legend>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AREAS.map((a) => (
            <label key={a.k} className="text-sm">
              <span className="block text-gray-700 font-semibold mb-1">{a.t}</span>
              <select
                className={input}
                value={borrador.permisos[a.k] ?? "ninguno"}
                onChange={(e) => cambia({ permisos: { ...borrador.permisos, [a.k]: e.target.value } })}
              >
                {NIVELES.map((n) => (
                  <option key={n} value={n}>
                    {TEXTO_NIVEL[n]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs text-dorado-osc font-semibold mb-2">CASILLAS DE FINANZAS CON QUE PARTE</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CASILLAS_FIN.map(([k, t]) => (
            <label key={k} className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!borrador.fin[k]}
                onChange={(e) => cambia({ fin: { ...borrador.fin, [k]: e.target.checked } })}
              />
              <span className="text-gray-700">{t}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onGuardar}
          disabled={pendiente}
          className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
        >
          {pendiente ? "Grabando..." : textoGuardar}
        </button>
        <button onClick={onCancelar} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
          Cancelar
        </button>
        {onEliminar && (
          <button
            onClick={onEliminar}
            disabled={pendiente || (personas ?? 0) > 0}
            title={(personas ?? 0) > 0 ? "Hay personas con este perfil: cambiales el perfil primero" : undefined}
            className="ml-auto border border-red-300 text-red-700 text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
          >
            Eliminar perfil
          </button>
        )}
      </div>
    </div>
  );
}

export default function PanelPerfiles({
  perfiles,
  topes,
  paises,
  personas,
  excepciones,
  puedeEditar,
}: {
  perfiles: PerfilAcceso[];
  topes: Tope[];
  paises: Pais[];
  personas: Persona[];
  excepciones: Excepcion[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<number | "nuevo" | null>(null);
  const [borrador, setBorrador] = useState<DatosPerfil>(VACIO);
  const [montos, setMontos] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const t of topes) m[`${t.id_perfil}-${t.id_pais}`] = t.tope == null ? "" : String(t.tope);
    return m;
  });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const gente = (id: number) => personas.filter((p) => p.id_perfil === id);

  function abrir(p: PerfilAcceso) {
    setEditando(p.id);
    setBorrador({
      nombre: p.nombre,
      ejemplo: p.ejemplo ?? "",
      alcance: p.alcance,
      rolBase: p.rol_base,
      permisos: { ...p.permisos },
      fin: { ...p.fin },
    });
    setError(null);
    setAviso(null);
  }

  function abrirNuevo() {
    setEditando("nuevo");
    setBorrador(VACIO);
    setError(null);
    setAviso(null);
  }

  // Un perfil nuevo parte de una copia de otro: se ajusta en vez de armarlo de cero.
  function copiarDe(id: number) {
    const o = perfiles.find((x) => x.id === id);
    if (o) setBorrador((b) => ({ ...b, rolBase: o.rol_base, permisos: { ...o.permisos }, fin: { ...o.fin } }));
  }

  function guardar() {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = editando === "nuevo" ? await crearPerfil(borrador) : await guardarPerfil(editando as number, borrador);
      if (r?.error) setError(r.error);
      else {
        setAviso(
          editando === "nuevo"
            ? `Perfil "${borrador.nombre}" creado. Queda sin tope de aprobacion: fijalo abajo si debe aprobar. Asignalo a las personas en Vendedores y accesos.`
            : `Plantilla "${borrador.nombre}" guardada. Las personas que ya la tienen conservan lo suyo hasta que se les vuelva a aplicar el perfil.`
        );
        setEditando(null);
      }
    });
  }

  function eliminar(p: PerfilAcceso) {
    if (!window.confirm(`Eliminar el perfil "${p.nombre}"? No se puede deshacer.`)) return;
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await eliminarPerfil(p.id);
      if (r?.error) setError(r.error);
      else {
        setAviso(`Perfil "${p.nombre}" eliminado.`);
        setEditando(null);
      }
    });
  }

  function guardarMonto(p: PerfilAcceso, pais: Pais) {
    setError(null);
    setAviso(null);
    const txt = (montos[`${p.id}-${pais.id}`] ?? "").trim();
    const valor = txt === "" ? null : Number(txt.replace(/\./g, "").replace(",", "."));
    empezar(async () => {
      const r = await guardarTope(p.id, pais.id, valor);
      if (r?.error) setError(r.error);
      else
        setAviso(
          valor == null
            ? `${p.nombre} queda sin tope en ${pais.nombre}: no puede aprobar ahi.`
            : `Tope de ${p.nombre} en ${pais.nombre} guardado.`
        );
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3 space-y-1">
        <p>
          Cada perfil es una <strong>plantilla</strong>: define el nivel que se tiene en cada area y
          las casillas de finanzas con que parte la persona. Despues se ajusta caso a caso en{" "}
          <em>Vendedores y accesos</em>. Los niveles se acumulan: <strong>Operar</strong> incluye
          Ver, <strong>Aprobar</strong> incluye Operar, y asi hasta <strong>Administrar</strong>.
        </p>
        <p>
          <strong>Segregacion de funciones:</strong> quien registra un egreso no lo aprueba, y quien
          lo aprueba no lo paga. Solo el super administrador puede saltarse la regla, y cada vez
          queda anotado abajo.
        </p>
      </div>

      {error && (
        <div role="alert" className="sticky top-2 z-10 shadow bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {aviso && (
        <div role="status" className="sticky top-2 z-10 shadow bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
          {aviso}
        </div>
      )}

      <section className="space-y-2" aria-labelledby="t-plantillas">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-plantillas" className="text-sm font-semibold text-verde">
            Plantillas por area
          </h2>
          {puedeEditar && editando !== "nuevo" && (
            <button
              onClick={abrirNuevo}
              className="bg-dorado text-white text-xs font-semibold px-3 py-1.5 rounded"
            >
              + Nuevo perfil
            </button>
          )}
        </div>
        {editando === "nuevo" && (
          <div className="border border-dorado bg-crema rounded px-4 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-verde">Nuevo perfil</h3>
            <label className="text-sm block max-w-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Partir como copia de</span>
              <select
                className={input}
                defaultValue=""
                onChange={(e) => e.target.value && copiarDe(Number(e.target.value))}
              >
                <option value="">Perfil en blanco</option>
                {perfiles.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </label>
            <FormPerfil
              borrador={borrador}
              setBorrador={setBorrador}
              pendiente={pendiente}
              textoGuardar="Crear perfil"
              onGuardar={guardar}
              onCancelar={() => setEditando(null)}
            />
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2 min-w-48">Perfil</th>
                  {AREAS.map((a) => (
                    <th key={a.k} scope="col" className="text-center px-2 py-2">
                      {a.t}
                    </th>
                  ))}
                  <th scope="col" className="text-left px-3 py-2">Alcance</th>
                  <th scope="col" className="text-center px-3 py-2">Personas</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {perfiles.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="border-t border-gray-100 hover:bg-crema align-top">
                      <th scope="row" className="text-left px-3 py-2 font-normal">
                        <div className="font-semibold text-gray-900">
                          {p.orden}. {p.nombre}
                        </div>
                        <div className="text-gray-500">{p.ejemplo}</div>
                      </th>
                      {AREAS.map((a) => (
                        <td key={a.k} className="px-2 py-2 text-center">
                          <Nivel_ n={p.permisos[a.k]} />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-gray-600">{p.alcance}</td>
                      <td className="px-3 py-2 text-center">
                        {gente(p.id).length > 0 ? (
                          <span title={gente(p.id).map((x) => x.nombre).join(", ")}>
                            {gente(p.id).length}
                          </span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {puedeEditar && !p.es_super && (
                          <button
                            onClick={() => (editando === p.id ? setEditando(null) : abrir(p))}
                            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                            aria-expanded={editando === p.id}
                          >
                            {editando === p.id ? "cerrar" : "editar"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {editando === p.id && (
                      <tr className="border-t border-dorado bg-crema">
                        <td colSpan={AREAS.length + 4} className="px-4 py-4">
                          <FormPerfil
                            borrador={borrador}
                            setBorrador={setBorrador}
                            pendiente={pendiente}
                            textoGuardar="Grabar plantilla"
                            onGuardar={guardar}
                            onCancelar={() => setEditando(null)}
                            onEliminar={() => eliminar(p)}
                            personas={gente(p.id).length}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="t-topes">
        <h2 id="t-topes" className="text-sm font-semibold text-verde">
          Topes de aprobacion por perfil y mercado
        </h2>
        <p className="text-xs text-gray-600 max-w-3xl">
          Hasta que monto aprueba cada perfil un egreso o una orden de compra. Sobre el tope, o con
          el tope vacio, aprueba un socio. Para aprobar, la persona ademas debe estar nombrada como
          aprobador del proyecto.
        </p>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2">Perfil</th>
                  {paises.map((pa) => (
                    <th key={pa.id} scope="col" className="text-left px-3 py-2">
                      {pa.nombre} ({pa.moneda_base})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfiles.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <th scope="row" className="text-left px-3 py-2 font-semibold text-gray-900">
                      {p.nombre}
                    </th>
                    {paises.map((pa) => (
                      <td key={pa.id} className="px-3 py-2">
                        {p.es_super ? (
                          <span className="text-gray-500">Sin tope</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              inputMode="numeric"
                              aria-label={`Tope de ${p.nombre} en ${pa.nombre}`}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-36 disabled:bg-gray-50"
                              placeholder="Sin definir"
                              disabled={!puedeEditar}
                              value={montos[`${p.id}-${pa.id}`] ?? ""}
                              onChange={(e) =>
                                setMontos({ ...montos, [`${p.id}-${pa.id}`]: e.target.value })
                              }
                            />
                            {puedeEditar && (
                              <button
                                onClick={() => guardarMonto(p, pa)}
                                disabled={pendiente}
                                className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                              >
                                guardar
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="t-excepciones">
        <h2 id="t-excepciones" className="text-sm font-semibold text-verde">
          Excepciones de los socios
        </h2>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2">Fecha</th>
                  <th scope="col" className="text-left px-3 py-2">Quien</th>
                  <th scope="col" className="text-left px-3 py-2">Regla saltada</th>
                  <th scope="col" className="text-right px-3 py-2">Movimiento</th>
                  <th scope="col" className="text-right px-3 py-2">Monto</th>
                  <th scope="col" className="text-left px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {excepciones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-gray-500">
                      Todavia no se ha usado ninguna excepcion.
                    </td>
                  </tr>
                )}
                {excepciones.map((x) => (
                  <tr key={x.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(x.en).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2">{x.vendedores?.nombre ?? "—"}</td>
                    <td className="px-3 py-2 font-semibold">{x.regla}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{x.id_mov ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {x.monto == null ? "—" : Number(x.monto).toLocaleString("es-CL")}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{x.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
