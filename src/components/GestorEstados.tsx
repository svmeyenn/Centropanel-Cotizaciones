"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEstado, eliminarEstado, guardarEstado, moverEstado } from "@/app/estados/acciones";
import { MARCAS, ROLES, type Estado, type TipoEstado } from "@/lib/catalogoEstados";

type Aviso = { ok: boolean; texto: string } | null;

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[12px] bg-white";

// Mantenedor de los estados de leads o de cotizaciones. Un estado del sistema
// --el que el sistema usa para algo-- se renombra y se reordena; lo que significa
// no se toca. Uno que se agrega elige sus significados, y con ellos entra solo a
// los tableros, a los filtros y a los listados.
export default function GestorEstados({
  tipo,
  estados,
  usos,
  unidad,
}: {
  tipo: TipoEstado;
  estados: Estado[];
  // Cuantos registros tiene hoy cada estado.
  usos: Record<string, number>;
  // "leads" o "cotizaciones".
  unidad: string;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, empezar] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>, alTerminar?: () => void) {
    setAviso(null);
    empezar(async () => {
      const r = await accion();
      if (r.mensaje) setAviso({ ok: r.ok, texto: r.mensaje });
      if (r.ok) {
        alTerminar?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {aviso && (
        <p className={`text-[12px] ${aviso.ok ? "text-verde" : "text-red-700"}`} role="status">
          {aviso.texto}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th scope="col" className="text-left px-2 py-1.5 w-16">
                Orden
              </th>
              <th scope="col" className="text-left px-2 py-1.5">
                Nombre
              </th>
              <th scope="col" className="text-right px-2 py-1.5 w-20">
                En uso
              </th>
              <th scope="col" className="text-left px-2 py-1.5 min-w-[18rem]">
                Que significa
              </th>
              <th scope="col" className="text-center px-2 py-1.5 w-24">
                Se ofrece
              </th>
              <th scope="col" className="text-right px-2 py-1.5 w-40">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {estados.map((e, i) => (
              <Fila
                key={`${e.codigo}|${e.etiqueta}|${e.activo}|${e.marcas.join(",")}`}
                tipo={tipo}
                e={e}
                uso={usos[e.codigo] ?? 0}
                unidad={unidad}
                primero={i === 0}
                ultimo={i === estados.length - 1}
                bloqueado={pendiente}
                ejecutar={ejecutar}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Nuevo tipo={tipo} bloqueado={pendiente} ejecutar={ejecutar} />
    </div>
  );
}

function Fila({
  tipo,
  e,
  uso,
  unidad,
  primero,
  ultimo,
  bloqueado,
  ejecutar,
}: {
  tipo: TipoEstado;
  e: Estado;
  uso: number;
  unidad: string;
  primero: boolean;
  ultimo: boolean;
  bloqueado: boolean;
  ejecutar: (accion: () => Promise<{ ok: boolean; mensaje?: string }>, alTerminar?: () => void) => void;
}) {
  const [etiqueta, setEtiqueta] = useState(e.etiqueta);
  const [activo, setActivo] = useState(e.activo);
  const [marcas, setMarcas] = useState<string[]>(e.marcas);
  const [confirmando, setConfirmando] = useState(false);

  const sucio =
    etiqueta.trim() !== e.etiqueta || activo !== e.activo || [...marcas].sort().join() !== [...e.marcas].sort().join();

  const alternar = (m: string) => setMarcas((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));

  function guardar() {
    // Uno del sistema solo manda el nombre: lo demas lo protege la base.
    ejecutar(() =>
      guardarEstado(tipo, e.codigo, e.es_sistema ? { etiqueta } : { etiqueta, activo, marcas })
    );
  }

  return (
    <tr className={`border-t border-gray-100 align-top ${activo ? "" : "bg-gray-50 text-gray-500"}`}>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <button
          type="button"
          onClick={() => ejecutar(() => moverEstado(tipo, e.codigo, "subir"))}
          disabled={bloqueado || primero}
          aria-label={`Subir ${e.etiqueta}`}
          title="Subir"
          className="border border-gray-300 rounded px-1.5 disabled:opacity-30"
        >
          {"▲"}
        </button>{" "}
        <button
          type="button"
          onClick={() => ejecutar(() => moverEstado(tipo, e.codigo, "bajar"))}
          disabled={bloqueado || ultimo}
          aria-label={`Bajar ${e.etiqueta}`}
          title="Bajar"
          className="border border-gray-300 rounded px-1.5 disabled:opacity-30"
        >
          {"▼"}
        </button>
      </td>

      <td className="px-2 py-1.5">
        <input
          value={etiqueta}
          onChange={(x) => setEtiqueta(x.target.value)}
          maxLength={40}
          aria-label={`Nombre del estado ${e.codigo}`}
          className={`${CAMPO} w-full min-w-[9rem]`}
        />
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
          <code className="font-mono">{e.codigo}</code>
          {e.es_sistema && (
            <span className="border border-gray-300 rounded px-1" title="Lo usa el sistema: se renombra y se reordena, no se elimina">
              del sistema
            </span>
          )}
        </span>
      </td>

      <td className="px-2 py-1.5 text-right tabular-nums">{uso.toLocaleString("es-CL")}</td>

      <td className="px-2 py-1.5">
        {e.es_sistema ? (
          <div className="space-y-1">
            {e.rol && <p className="text-[11px] text-dorado-osc">{ROLES[e.rol]}</p>}
            <p className="flex flex-wrap gap-1">
              {e.marcas.length === 0 && !e.rol && <span className="text-[11px] text-gray-500">Sin efecto en los tableros.</span>}
              {MARCAS[tipo]
                .filter((m) => e.marcas.includes(m.marca))
                .map((m) => (
                  <span key={m.marca} title={m.ayuda} className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-700">
                    {m.texto}
                  </span>
                ))}
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {MARCAS[tipo].map((m) => (
              <li key={m.marca}>
                <label className="flex items-start gap-1.5 cursor-pointer" title={m.ayuda}>
                  <input type="checkbox" checked={marcas.includes(m.marca)} onChange={() => alternar(m.marca)} className="mt-0.5" />
                  <span>{m.texto}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </td>

      <td className="px-2 py-1.5 text-center">
        <input
          type="checkbox"
          checked={activo}
          disabled={e.es_sistema}
          onChange={(x) => setActivo(x.target.checked)}
          aria-label={`${e.etiqueta} se ofrece al elegir un estado`}
          title={
            e.es_sistema
              ? "Lo usa el sistema: siempre se ofrece"
              : "Si se desactiva deja de ofrecerse, pero lo que ya lo tiene lo conserva"
          }
        />
      </td>

      <td className="px-2 py-1.5 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={guardar}
          disabled={bloqueado || !sucio || etiqueta.trim().length < 2}
          className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-40"
        >
          Guardar
        </button>
        {!e.es_sistema &&
          (confirmando ? (
            <span className="ml-1 inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => ejecutar(() => eliminarEstado(tipo, e.codigo))}
                disabled={bloqueado}
                className="border border-red-300 text-red-700 font-semibold px-2 py-1 rounded"
              >
                Si, eliminar
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className="underline text-gray-600">
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={bloqueado || uso > 0}
              title={uso > 0 ? `Hay ${uso} ${unidad} con este estado: desactivelo en vez de eliminarlo` : "Eliminar este estado"}
              className="ml-1 border border-gray-300 text-gray-700 px-2 py-1 rounded disabled:opacity-40"
            >
              Eliminar
            </button>
          ))}
      </td>
    </tr>
  );
}

function Nuevo({
  tipo,
  bloqueado,
  ejecutar,
}: {
  tipo: TipoEstado;
  bloqueado: boolean;
  ejecutar: (accion: () => Promise<{ ok: boolean; mensaje?: string }>, alTerminar?: () => void) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [marcas, setMarcas] = useState<string[]>([]);
  const alternar = (m: string) => setMarcas((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        ejecutar(
          () => crearEstado(tipo, nombre, marcas),
          () => {
            setNombre("");
            setMarcas([]);
          }
        );
      }}
      className="bg-white border border-gray-200 rounded p-3 space-y-2"
    >
      <h3 className="text-[11px] font-semibold text-dorado-osc uppercase tracking-wide">Agregar un estado</h3>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <label className="flex flex-col gap-0.5 text-[12px]">
          <span className="font-semibold text-gray-700">Nombre</span>
          <input
            value={nombre}
            onChange={(x) => setNombre(x.target.value)}
            maxLength={40}
            placeholder="Por ejemplo, En negociacion"
            className={`${CAMPO} w-64`}
          />
        </label>
        <fieldset className="text-[12px]">
          <legend className="font-semibold text-gray-700 mb-0.5">Que significa</legend>
          <ul className="space-y-0.5">
            {MARCAS[tipo].map((m) => (
              <li key={m.marca}>
                <label className="flex items-start gap-1.5 cursor-pointer" title={m.ayuda}>
                  <input type="checkbox" checked={marcas.includes(m.marca)} onChange={() => alternar(m.marca)} className="mt-0.5" />
                  <span>{m.texto}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <button
          type="submit"
          disabled={bloqueado || nombre.trim().length < 2}
          className="self-end bg-verde text-white font-semibold px-3 py-1.5 rounded disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
      <p className="text-[11px] text-gray-500">
        Lo que marque decide en que cuentas entra: sin ninguna marca el estado se puede elegir, pero no suma en los
        tableros. Despues de agregarlo no se puede cambiar su codigo; el nombre, el orden y lo que significa si.
      </p>
    </form>
  );
}
