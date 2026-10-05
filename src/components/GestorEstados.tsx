"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEstado, eliminarEstado, guardarEstado, moverEstado, restaurarEstados } from "@/app/estados/acciones";
import { MARCAS, ROLES, type Estado, type TipoEstado } from "@/lib/catalogoEstados";

type Aviso = { ok: boolean; texto: string } | null;
type Ejecutar = (accion: () => Promise<{ ok: boolean; mensaje?: string }>, alTerminar?: () => void) => void;

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[12px] bg-white";

// Mantenedor de los estados de leads o de cotizaciones.
//
//  - Dejar de ofrecer un estado lo saca de las listas donde se elige, pero lo que
//    ya lo tiene lo conserva y sigue contando en los tableros.
//  - Eliminarlo solo se puede si nadie lo tiene.
//  - Los estados que el sistema necesita para funcionar --donde nace una
//    cotizacion, a donde va un lead al enviarle una, lo que usa la depuracion--
//    estan protegidos: no se desactivan ni se eliminan, y dicen por que.
// Todas las reglas las vuelve a exigir la base; aqui solo se explican.
export default function GestorEstados({
  tipo,
  estados,
  usos,
  unidad,
  faltantes,
}: {
  tipo: TipoEstado;
  estados: Estado[];
  // Cuantos registros tiene hoy cada estado.
  usos: Record<string, number>;
  // "leads" o "cotizaciones".
  unidad: string;
  // Nombres de los estados de origen que se eliminaron y se pueden restaurar.
  faltantes: string[];
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, empezar] = useTransition();

  const ejecutar: Ejecutar = (accion, alTerminar) => {
    setAviso(null);
    empezar(async () => {
      const r = await accion();
      if (r.mensaje) setAviso({ ok: r.ok, texto: r.mensaje });
      if (r.ok) {
        alTerminar?.();
        router.refresh();
      }
    });
  };

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
              <th scope="col" className="text-left px-2 py-1.5 w-44">
                Se ofrece
              </th>
              <th scope="col" className="text-right px-2 py-1.5 w-44">
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

      {faltantes.length > 0 && <Restaurar tipo={tipo} faltantes={faltantes} bloqueado={pendiente} ejecutar={ejecutar} />}

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
  ejecutar: Ejecutar;
}) {
  const [etiqueta, setEtiqueta] = useState(e.etiqueta);
  const [activo, setActivo] = useState(e.activo);
  const [marcas, setMarcas] = useState<string[]>(e.marcas);
  const [confirmando, setConfirmando] = useState(false);

  const sucio =
    etiqueta.trim() !== e.etiqueta || activo !== e.activo || [...marcas].sort().join() !== [...e.marcas].sort().join();
  // Se va a dejar de ofrecer: aun no esta guardado, pero ya hay que avisar.
  const porDesactivar = e.activo && !activo;

  const alternar = (m: string) => setMarcas((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));

  function guardar() {
    // Uno que viene con el sistema no cambia de significado: manda solo el nombre
    // y, si no esta protegido, si se ofrece.
    ejecutar(() =>
      guardarEstado(
        tipo,
        e.codigo,
        e.es_sistema ? { etiqueta, ...(e.protegido ? {} : { activo }) } : { etiqueta, activo, marcas }
      )
    );
  }

  // Lo que se explica antes de eliminar, segun de donde viene el estado.
  const advertenciaEliminar = e.es_sistema
    ? tipo === "lead"
      ? `«${e.etiqueta}» viene con el sistema y con Clientify. Hoy no lo tiene ningun lead, pero si el CRM vuelve a mandarlo esos leads se veran con su codigo («${e.codigo}») y no con un nombre. Si lo elimina por error, «Restaurar estados originales» lo recupera. Dejar de ofrecerlo es lo mas seguro.`
      : `«${e.etiqueta}» viene con el sistema. Hoy no la tiene ninguna cotizacion. Si lo elimina por error, «Restaurar estados originales» lo recupera. Dejar de ofrecerlo es lo mas seguro.`
    : `Se eliminara «${e.etiqueta}» para siempre. Hoy no lo tiene ningun registro. No se puede deshacer.`;

  return (
    <>
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
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
            <code className="font-mono">{e.codigo}</code>
            {e.es_sistema && (
              <span className="border border-gray-300 rounded px-1" title="Viene con el sistema: se renombra y se reordena, pero no cambia lo que significa">
                del sistema
              </span>
            )}
            {e.protegido && (
              <span className="border border-dorado rounded px-1 text-dorado-osc" title={e.motivo ?? "El sistema lo necesita"}>
                protegido
              </span>
            )}
          </span>
        </td>

        <td className="px-2 py-1.5 text-right tabular-nums">{uso.toLocaleString("es-CL")}</td>

        <td className="px-2 py-1.5">
          {e.es_sistema ? (
            <div className="space-y-1">
              {e.protegido ? (
                <p className="text-[11px] text-dorado-osc">{e.motivo}</p>
              ) : (
                e.rol && <p className="text-[11px] text-dorado-osc">{ROLES[e.rol]}</p>
              )}
              <p className="flex flex-wrap gap-1">
                {e.marcas.length === 0 && !e.rol && !e.protegido && (
                  <span className="text-[11px] text-gray-500">Sin efecto en los tableros.</span>
                )}
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

        <td className="px-2 py-1.5">
          <label
            className={`flex items-center gap-1.5 ${e.protegido ? "cursor-not-allowed" : "cursor-pointer"}`}
            title={e.protegido ? `No se puede dejar de ofrecer: ${e.motivo}` : "Si se desmarca, deja de ofrecerse al elegir un estado"}
          >
            <input
              type="checkbox"
              checked={activo}
              disabled={e.protegido}
              onChange={(x) => setActivo(x.target.checked)}
              aria-label={`${e.etiqueta} se ofrece al elegir un estado`}
            />
            <span>{activo ? "Si" : "No, no se ofrece"}</span>
          </label>
          {porDesactivar && (
            <p className="mt-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-1" role="note">
              Dejara de ofrecerse al elegir un estado.{" "}
              {uso > 0
                ? `Los ${uso.toLocaleString("es-CL")} ${unidad} que ya lo tienen lo conservan y siguen contando igual en los tableros.`
                : "Nadie lo tiene hoy."}{" "}
              Pulse Guardar para aplicarlo.
            </p>
          )}
          {!e.activo && !porDesactivar && (
            <p className="mt-1 text-[10px] text-gray-500">Los registros que lo tienen lo conservan.</p>
          )}
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
          {e.protegido ? (
            <span className="ml-1 inline-block text-[10px] text-gray-500 align-middle" title={e.motivo ?? undefined}>
              no se elimina
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={bloqueado || confirmando || uso > 0}
              title={
                uso > 0
                  ? `Hay ${uso.toLocaleString("es-CL")} ${unidad} con este estado: dejelo de ofrecer, o cambie antes esos registros`
                  : "Eliminar este estado"
              }
              className="ml-1 border border-gray-300 text-gray-700 px-2 py-1 rounded disabled:opacity-40"
            >
              Eliminar
            </button>
          )}
        </td>
      </tr>

      {confirmando && (
        <tr className="bg-red-50/60 border-t border-red-200">
          <td colSpan={6} className="px-3 py-2" role="alert">
            <p className="text-[12px] text-red-900">{advertenciaEliminar}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => ejecutar(() => eliminarEstado(tipo, e.codigo), () => setConfirmando(false))}
                disabled={bloqueado}
                className="border border-red-400 text-red-800 bg-white font-semibold px-3 py-1 rounded disabled:opacity-40"
              >
                Si, eliminar
              </button>
              <button type="button" onClick={() => setConfirmando(false)} disabled={bloqueado} className="underline text-gray-700">
                No, conservarlo
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Volver a crear los estados de origen que se eliminaron.
function Restaurar({
  tipo,
  faltantes,
  bloqueado,
  ejecutar,
}: {
  tipo: TipoEstado;
  faltantes: string[];
  bloqueado: boolean;
  ejecutar: Ejecutar;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
      <p className="text-gray-700">
        Se eliminaron {faltantes.length === 1 ? "este estado" : "estos estados"} de origen:{" "}
        <b>{faltantes.join(", ")}</b>. Se pueden volver a crear con su codigo y su significado de siempre.
      </p>
      <button
        type="button"
        onClick={() => ejecutar(() => restaurarEstados(tipo))}
        disabled={bloqueado}
        className="border border-gray-300 font-semibold px-2.5 py-1 rounded bg-white disabled:opacity-40"
      >
        Restaurar estados originales
      </button>
    </div>
  );
}

function Nuevo({ tipo, bloqueado, ejecutar }: { tipo: TipoEstado; bloqueado: boolean; ejecutar: Ejecutar }) {
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
