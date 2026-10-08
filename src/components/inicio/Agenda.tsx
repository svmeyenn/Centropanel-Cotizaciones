"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BanderaDe } from "@/components/Bandera";
import { marcarAccionHecha, reabrirAccion } from "@/app/cotizaciones/actividad";
import { marcarCompromisoHecho, reabrirCompromiso } from "@/app/leads/actividad-lead";
import {
  diaCorto,
  diaSemana,
  diasEntre,
  plazo,
  sumarDias,
  type ItemAgenda,
  type TipoAgenda,
} from "@/components/inicio/tipos";

// La agenda de dos semanas: esta y la proxima, de lunes a domingo, para ver de
// un vistazo como viene la carga y planificar. Junta lo comprometido con leads,
// las acciones de cotizaciones y las entregas de pedidos. Arriba el calendario
// con cuantas cosas hay cada dia; abajo la lista, que se filtra al pulsar un dia.

const TIPOS: Record<TipoAgenda, { texto: string; clase: string; punto: string }> = {
  lead: { texto: "Lead", clase: "text-verde border-verde", punto: "bg-verde" },
  cotizacion: { texto: "Cotizacion", clase: "text-dorado-osc border-dorado-osc", punto: "bg-dorado" },
  entrega: { texto: "Entrega", clase: "text-[#2F5D8A] border-[#2F5D8A]", punto: "bg-[#2F5D8A]" },
};

const PLURAL: Record<TipoAgenda, string> = { lead: "Leads", cotizacion: "Cotizaciones", entrega: "Entregas" };

type Filtro = "todo" | "atrasado" | "hoy" | "semana" | "proxima" | string;

const ENLACE: Record<TipoAgenda, (id: number) => string> = {
  lead: (id) => `/leads/${id}`,
  cotizacion: (id) => `/cotizaciones/${id}`,
  entrega: (id) => `/pedidos/${id}`,
};

export default function Agenda({
  items,
  hoy,
  lunes,
  puedeEditar,
  verResponsable,
}: {
  items: ItemAgenda[];
  hoy: string;
  lunes: string;
  puedeEditar: boolean;
  // Con el equipo a la vista se dice de quien es cada cosa.
  verResponsable: boolean;
}) {
  const [tipo, setTipo] = useState<TipoAgenda | "todos">("todos");
  const [filtro, setFiltro] = useState<Filtro>("todo");
  // De quien y sobre que. La agenda llega completa --son dos semanas-- asi que
  // filtrar aqui es instantaneo y no hay que volver a la base.
  const [quien, setQuien] = useState("");
  const [busca, setBusca] = useState("");
  const [hechos, setHechos] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  const finSemana = sumarDias(lunes, 6);
  const dias = useMemo(() => Array.from({ length: 14 }, (_, i) => sumarDias(lunes, i)), [lunes]);

  // Las cifras del resumen llevan aqui con #agenda-hoy, #agenda-atrasado...
  useEffect(() => {
    function leerAncla() {
      const m = window.location.hash.match(/^#agenda-(atrasado|hoy|semana|proxima)$/);
      if (m) {
        setFiltro(m[1]);
        document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    leerAncla();
    window.addEventListener("hashchange", leerAncla);
    return () => window.removeEventListener("hashchange", leerAncla);
  }, []);

  const pasaFiltro = (f: string) => {
    if (filtro === "todo") return true;
    if (filtro === "atrasado") return f < hoy;
    if (filtro === "hoy") return f === hoy;
    if (filtro === "semana") return f > hoy && f <= finSemana;
    if (filtro === "proxima") return f > finSemana;
    return f === filtro;
  };

  const responsables = useMemo(
    () => [...new Set(items.map((x) => x.responsable).filter(Boolean) as string[])].sort(),
    [items]
  );
  const texto = busca.trim().toLowerCase();
  const porTipo = items.filter(
    (x) =>
      (tipo === "todos" || x.tipo === tipo) &&
      (!quien || x.responsable === quien) &&
      (!texto ||
        [x.sujeto, x.detalle, x.accion, x.comentario].some((c) => (c ?? "").toLowerCase().includes(texto)))
  );
  const visibles = porTipo.filter((x) => pasaFiltro(x.fecha));
  const cuenta = (t: TipoAgenda) => items.filter((x) => x.tipo === t).length;
  const antes = porTipo.filter((x) => x.fecha < lunes).length;

  // La lista va por dia; lo vencido junto arriba, que es lo primero que hay que resolver.
  const grupos: { clave: string; titulo: string; filas: ItemAgenda[] }[] = [];
  for (const x of visibles) {
    const clave = x.fecha < hoy ? "atrasado" : x.fecha;
    let g = grupos.find((y) => y.clave === clave);
    if (!g) {
      g = { clave, titulo: tituloDia(clave, hoy, finSemana), filas: [] };
      grupos.push(g);
    }
    g.filas.push(x);
  }

  function marcar(x: ItemAgenda, hecho: boolean) {
    setError("");
    const k = `${x.tipo}-${x.id}`;
    empezar(async () => {
      const r =
        x.tipo === "lead"
          ? await (hecho ? marcarCompromisoHecho : reabrirCompromiso)(x.id, x.id_ref)
          : await (hecho ? marcarAccionHecha : reabrirAccion)(x.id, x.id_ref);
      if (!r.ok) setError(r.mensaje ?? "No se pudo.");
      else setHechos((h) => ({ ...h, [k]: hecho }));
    });
  }

  return (
    <section id="agenda" aria-labelledby="titulo-agenda" className="bg-white border border-gray-200 rounded overflow-hidden scroll-mt-4">
      <div className="bg-verde text-white px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-agenda" className="text-[11px] font-semibold uppercase">
          Agenda: esta semana y la proxima
        </h2>
        <div className="flex flex-wrap gap-1 text-[10px]" role="group" aria-label="Que mostrar">
          {(["todos", "lead", "cotizacion", "entrega"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              className={`rounded px-2 py-0.5 ${tipo === t ? "bg-white text-verde font-semibold" : "bg-white/15 hover:bg-white/25"}`}
            >
              {t === "todos" ? `Todo (${items.length})` : `${PLURAL[t]} (${cuenta(t)})`}
            </button>
          ))}
        </div>
      </div>

      {/* El calendario: dos filas, una por semana. Cada dia dice cuantas cosas
          tiene; al pulsarlo la lista muestra solo ese dia. */}
      <div className="p-2 border-b border-gray-100">
        <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-[10px]">
          <span />
          {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
            <span key={d} className="text-center text-gray-500 uppercase">
              {d}
            </span>
          ))}
          {[0, 1].map((semana) => (
            <Semana
              key={semana}
              titulo={semana === 0 ? "Esta" : "Proxima"}
              dias={dias.slice(semana * 7, semana * 7 + 7)}
              hoy={hoy}
              items={porTipo}
              filtro={filtro}
              alElegir={(d) => setFiltro(filtro === d ? "todo" : d)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-gray-600">
          {(["atrasado", "hoy", "semana", "proxima"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(filtro === f ? "todo" : f)}
              aria-pressed={filtro === f}
              className={`rounded border px-1.5 py-0.5 ${
                filtro === f ? "border-verde bg-verde text-white" : "border-gray-300 hover:border-verde"
              } ${f === "atrasado" && antes + porTipo.filter((x) => x.fecha >= lunes && x.fecha < hoy).length > 0 && filtro !== f ? "text-red-700 border-red-300" : ""}`}
            >
              {{ atrasado: "Atrasado", hoy: "Hoy", semana: "Resto de la semana", proxima: "Proxima semana" }[f]}
            </button>
          ))}
          {verResponsable && responsables.length > 1 && (
            <label className="flex items-center gap-1">
              <span className="sr-only">Responsable</span>
              <select
                value={quien}
                onChange={(e) => setQuien(e.target.value)}
                className="border border-gray-300 rounded px-1.5 py-0.5 bg-white"
              >
                <option value="">Todo el equipo</option>
                {responsables.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar un nombre o una accion"
            aria-label="Buscar en la agenda"
            className="border border-gray-300 rounded px-1.5 py-0.5 bg-white w-48"
          />
          {(filtro !== "todo" || quien || texto) && (
            <button
              type="button"
              onClick={() => {
                setFiltro("todo");
                setQuien("");
                setBusca("");
              }}
              className="underline text-verde"
            >
              Ver todo
            </button>
          )}
          {antes > 0 && <span className="text-red-700">{antes} vencido{antes > 1 ? "s" : ""} de semanas anteriores</span>}
          <span className="ml-auto flex gap-2">
            {(Object.keys(TIPOS) as TipoAgenda[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <i className={`inline-block w-2 h-2 rounded-full ${TIPOS[t].punto}`} />
                {TIPOS[t].texto}
              </span>
            ))}
          </span>
        </div>
      </div>

      {error && (
        <p className="px-3 py-1 text-[11px] text-red-700" role="alert">
          {error}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-gray-500">
          {items.length === 0
            ? "Nada comprometido para estas dos semanas. Al anotar una conversacion con un lead o una accion en una cotizacion, deje la proxima accion con fecha: aparece aqui."
            : "Nada en lo que eligio."}
        </p>
      ) : (
        <ol className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100">
          {grupos.map((g) => (
            <li key={g.clave}>
              <h3
                className={`sticky top-0 z-[1] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  g.clave === "atrasado" ? "bg-red-50 text-red-800" : g.clave === hoy ? "bg-verde/10 text-verde" : "bg-crema text-dorado-osc"
                }`}
              >
                {g.titulo} · {g.filas.length}
              </h3>
              <ul className="divide-y divide-gray-50">
                {g.filas.map((x) => {
                  const k = `${x.tipo}-${x.id}`;
                  const hecho = hechos[k] === true;
                  const d = diasEntre(hoy, x.fecha);
                  return (
                    <li key={k} className={`flex flex-wrap items-start gap-x-2 gap-y-0.5 px-3 py-1.5 text-[11px] ${hecho ? "opacity-60" : ""}`}>
                      <BanderaDe idPais={x.id_pais} />
                      <span className={`shrink-0 text-[9px] font-semibold border rounded px-1 ${TIPOS[x.tipo].clase}`}>
                        {TIPOS[x.tipo].texto}
                      </span>
                      <div className="min-w-0 flex-1 basis-60">
                        <p className={`font-semibold break-words ${hecho ? "line-through" : ""}`}>{x.accion}</p>
                        <p className="text-gray-600 break-words">
                          <Link href={ENLACE[x.tipo](x.id_ref)} className="text-verde underline">
                            {x.sujeto}
                          </Link>
                          {x.detalle && <span> · {x.detalle}</span>}
                          {x.autor && <span className="text-gray-500"> · anotó {x.autor}</span>}
                          {verResponsable && x.responsable && <span className="text-gray-500"> · a cargo de {x.responsable}</span>}
                        </p>
                        {x.comentario && <p className="text-[10px] text-gray-500 break-words">{x.comentario}</p>}
                      </div>
                      <span className={`shrink-0 tabular-nums ${d < 0 ? "text-red-700 font-semibold" : "text-gray-600"}`}>
                        {d < 0 ? `vencio ${plazo(d)}` : `${diaCorto(x.fecha)} · ${plazo(d)}`}
                      </span>
                      {puedeEditar && x.tipo !== "entrega" && (
                        <button
                          type="button"
                          disabled={pendiente}
                          onClick={() => marcar(x, !hecho)}
                          className={`shrink-0 rounded px-2 py-0.5 font-semibold disabled:opacity-50 ${
                            hecho ? "border border-gray-300 text-gray-600" : "bg-verde text-white"
                          }`}
                        >
                          {hecho ? "Deshacer" : "Hecho"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function tituloDia(clave: string, hoy: string, finSemana: string) {
  if (clave === "atrasado") return "Atrasado";
  if (clave === hoy) return "Hoy";
  if (clave === sumarDias(hoy, 1)) return `Manana, ${diaSemana(clave)} ${diaCorto(clave)}`;
  return `${clave > finSemana ? "Proxima semana · " : ""}${diaSemana(clave)} ${diaCorto(clave)}`;
}

function Semana({
  titulo,
  dias,
  hoy,
  items,
  filtro,
  alElegir,
}: {
  titulo: string;
  dias: string[];
  hoy: string;
  items: ItemAgenda[];
  filtro: Filtro;
  alElegir: (dia: string) => void;
}) {
  return (
    <>
      <span className="self-center pr-1 text-[9px] uppercase text-gray-500 [writing-mode:vertical-rl] rotate-180 sm:[writing-mode:horizontal-tb] sm:rotate-0">
        {titulo}
      </span>
      {dias.map((d) => {
        const delDia = items.filter((x) => x.fecha === d);
        const pasado = d < hoy;
        const esHoy = d === hoy;
        const elegido = filtro === d;
        const porTipo = (Object.keys(TIPOS) as TipoAgenda[]).map((t) => ({ t, n: delDia.filter((x) => x.tipo === t).length }));
        return (
          <button
            key={d}
            type="button"
            onClick={() => alElegir(d)}
            aria-pressed={elegido}
            aria-label={`${diaSemana(d)} ${diaCorto(d)}: ${delDia.length} cosas`}
            className={`flex items-center justify-between gap-1 min-h-[2.25rem] rounded border px-1 py-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-verde ${
              elegido
                ? "border-verde ring-1 ring-verde"
                : esHoy
                  ? "border-verde bg-verde/5"
                  : pasado
                    ? "border-gray-100 bg-gray-50"
                    : "border-gray-200 hover:border-verde"
            }`}
          >
            <span className="min-w-0">
              <span className={`block text-[10px] leading-none ${esHoy ? "font-bold text-verde" : pasado ? "text-gray-400" : "text-gray-600"}`}>
                {esHoy ? "Hoy" : d.slice(8, 10).replace(/^0/, "")}
              </span>
              {delDia.length > 0 && (
                <span className={`block text-sm font-bold leading-tight tabular-nums ${pasado ? "text-red-700" : "text-negro"}`}>
                  {delDia.length}
                </span>
              )}
            </span>
            {/* El desglose del numero del dia: cuantos de cada tipo, a la derecha y en vertical. */}
            <span className="flex flex-col items-end gap-px shrink-0">
              {porTipo
                .filter((p) => p.n > 0)
                .map((p) => (
                  <span
                    key={p.t}
                    className="inline-flex items-center gap-0.5 text-[8px] leading-none tabular-nums text-gray-600"
                    title={`${p.n} ${TIPOS[p.t].texto}`}
                  >
                    {p.n}
                    <i className={`inline-block w-1.5 h-1.5 rounded-full ${TIPOS[p.t].punto}`} />
                  </span>
                ))}
            </span>
          </button>
        );
      })}
    </>
  );
}
