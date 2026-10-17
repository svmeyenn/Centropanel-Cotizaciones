"use client";

import { useMemo, useState, useTransition } from "react";
import { borrarTarea, guardarTarea } from "@/app/proyectos/acciones";
import { fecha as fmtFecha } from "@/lib/formato";

export interface FilaTarea {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  avance: number;
  id_predecesora: number | null;
  id_partida: number | null;
  hito: boolean;
}

const DIA = 86400000;
const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

const ALTO = 28;
const ENCAB = 38;
const COL_NOMBRE = 200;
const input = "border border-gray-300 rounded px-2 py-1 text-xs w-full";

const vacio = (hoy: string) => ({
  nombre: "",
  fecha_inicio: hoy,
  fecha_fin: hoy,
  avance: "0",
  id_predecesora: "",
  id_partida: "",
  hito: false,
});

export default function GanttProyecto({
  idProyecto,
  tareas,
  partidas,
  puedeEditar,
  hoy,
}: {
  idProyecto: number;
  tareas: FilaTarea[];
  partidas: { id: number; nombre: string }[];
  puedeEditar: boolean;
  hoy: string;
}) {
  const [editando, setEditando] = useState<number | null>(null);
  const [f, setF] = useState(vacio(hoy));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [pxDia, setPxDia] = useState(14);

  const { ini, fin, dias } = useMemo(() => {
    if (tareas.length === 0) return { ini: ms(hoy), fin: ms(hoy) + 30 * DIA, dias: 31 };
    const a = Math.min(...tareas.map((t) => ms(t.fecha_inicio)), ms(hoy)) - 2 * DIA;
    const b = Math.max(...tareas.map((t) => ms(t.fecha_fin)), ms(hoy)) + 3 * DIA;
    return { ini: a, fin: b, dias: Math.round((b - a) / DIA) + 1 };
  }, [tareas, hoy]);

  const ancho = dias * pxDia;
  const x = (iso_: string) => ((ms(iso_) - ini) / DIA) * pxDia;
  const filaDe = new Map(tareas.map((t, i) => [t.id, i]));

  // Cabecera: un tick por semana (lunes) y la etiqueta de mes.
  const semanas: { x: number; etiqueta: string }[] = [];
  for (let t = ini; t <= fin; t += DIA) {
    const d = new Date(t);
    if (d.getUTCDay() === 1) semanas.push({ x: ((t - ini) / DIA) * pxDia, etiqueta: `${d.getUTCDate()}/${d.getUTCMonth() + 1}` });
  }

  function nueva() {
    setEditando(0);
    setError(null);
    setF(vacio(hoy));
  }
  function editar(t: FilaTarea) {
    setEditando(t.id);
    setError(null);
    setF({
      nombre: t.nombre,
      fecha_inicio: t.fecha_inicio,
      fecha_fin: t.fecha_fin,
      avance: String(t.avance),
      id_predecesora: t.id_predecesora ? String(t.id_predecesora) : "",
      id_partida: t.id_partida ? String(t.id_partida) : "",
      hito: t.hito,
    });
  }
  function onPredecesora(v: string) {
    // Termino-inicio: la tarea parte al dia siguiente de que termina su predecesora.
    const p = tareas.find((t) => String(t.id) === v);
    if (p && editando === 0) {
      const inicio = iso(ms(p.fecha_fin) + DIA);
      const dur = Math.max(0, Math.round((ms(f.fecha_fin) - ms(f.fecha_inicio)) / DIA));
      setF({ ...f, id_predecesora: v, fecha_inicio: inicio, fecha_fin: iso(ms(inicio) + dur * DIA) });
    } else setF({ ...f, id_predecesora: v });
  }
  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await guardarTarea(idProyecto, editando || null, {
        nombre: f.nombre,
        fecha_inicio: f.fecha_inicio,
        fecha_fin: f.fecha_fin,
        avance: Number(f.avance) || 0,
        id_predecesora: f.id_predecesora ? Number(f.id_predecesora) : null,
        id_partida: f.id_partida ? Number(f.id_partida) : null,
        hito: f.hito,
      });
      if (r?.error) setError(r.error);
      else setEditando(null);
    });
  }
  function borrar(t: FilaTarea) {
    if (!confirm(`Borrar la tarea "${t.nombre}"?`)) return;
    empezar(async () => {
      const r = await borrarTarea(idProyecto, t.id);
      if (r?.error) setError(r.error);
    });
  }

  const xHoy = x(hoy);
  const alto = ENCAB + tareas.length * ALTO + 8;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Escala
          <input type="range" min={6} max={40} value={pxDia} onChange={(e) => setPxDia(Number(e.target.value))} />
        </label>
        {puedeEditar && (
          <button onClick={nueva} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
            Nueva tarea
          </button>
        )}
      </div>

      {editando !== null && (
        <div className="bg-white border border-gray-200 rounded p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <label className="text-xs md:col-span-2">
            <span className="block font-semibold mb-1">Tarea *</span>
            <input className={input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
          <label className="text-xs">
            <span className="block font-semibold mb-1">Inicio</span>
            <input type="date" className={input} value={f.fecha_inicio} onChange={(e) => setF({ ...f, fecha_inicio: e.target.value })} />
          </label>
          <label className="text-xs">
            <span className="block font-semibold mb-1">Termino</span>
            <input type="date" className={input} value={f.hito ? f.fecha_inicio : f.fecha_fin} disabled={f.hito} onChange={(e) => setF({ ...f, fecha_fin: e.target.value })} />
          </label>
          <label className="text-xs">
            <span className="block font-semibold mb-1">Avance %</span>
            <input type="number" min={0} max={100} className={input} value={f.avance} onChange={(e) => setF({ ...f, avance: e.target.value })} />
          </label>
          <label className="text-xs flex items-center gap-1 pb-1">
            <input type="checkbox" checked={f.hito} onChange={(e) => setF({ ...f, hito: e.target.checked })} />
            Hito
          </label>
          <label className="text-xs md:col-span-2">
            <span className="block font-semibold mb-1">Depende de</span>
            <select className={input} value={f.id_predecesora} onChange={(e) => onPredecesora(e.target.value)}>
              <option value="">-- ninguna --</option>
              {tareas.filter((t) => t.id !== editando).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs md:col-span-2">
            <span className="block font-semibold mb-1">Partida del presupuesto</span>
            <select className={input} value={f.id_partida} onChange={(e) => setF({ ...f, id_partida: e.target.value })}>
              <option value="">-- ninguna --</option>
              {partidas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 md:col-span-6 flex gap-2">
            <button onClick={guardar} disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40">
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button onClick={() => setEditando(null)} className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded">
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <div className="text-sm text-red-700 font-semibold">{error}</div>}

      <div className="bg-white border border-gray-200 rounded overflow-hidden flex">
        <div className="shrink-0 border-r border-gray-200 text-xs" style={{ width: COL_NOMBRE }}>
          <div className="bg-verde text-white px-2 flex items-center font-semibold" style={{ height: ENCAB }}>
            Tarea
          </div>
          {tareas.map((t) => (
            <div key={t.id} className="px-2 flex items-center justify-between border-t border-gray-100 gap-1" style={{ height: ALTO }}>
              <button
                className="truncate text-left hover:underline disabled:no-underline"
                disabled={!puedeEditar}
                onClick={() => editar(t)}
                title={`${t.nombre} · ${fmtFecha(t.fecha_inicio)} → ${fmtFecha(t.fecha_fin)}`}
              >
                {t.hito ? "◆ " : ""}
                {t.nombre}
              </button>
              {puedeEditar && (
                <button onClick={() => borrar(t)} className="text-red-700 shrink-0" title="Borrar">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto grow">
          <svg width={ancho} height={alto} className="block">
            <rect x={0} y={0} width={ancho} height={ENCAB} fill="#1D4E4A" />
            {semanas.map((s, i) => (
              <g key={i}>
                <line x1={s.x} x2={s.x} y1={ENCAB - 10} y2={alto} stroke="#e5e7eb" />
                <text x={s.x + 3} y={ENCAB - 14} fontSize={10} fill="#ffffff">
                  {s.etiqueta}
                </text>
              </g>
            ))}
            {tareas.map((_, i) => (
              <line key={i} x1={0} x2={ancho} y1={ENCAB + i * ALTO} y2={ENCAB + i * ALTO} stroke="#f3f4f6" />
            ))}
            {/* dependencias */}
            {tareas.map((t, i) => {
              const j = t.id_predecesora != null ? filaDe.get(t.id_predecesora) : undefined;
              if (j === undefined) return null;
              const p = tareas[j];
              const x1 = x(p.fecha_fin) + pxDia;
              const y1 = ENCAB + j * ALTO + ALTO / 2;
              const x2 = x(t.fecha_inicio);
              const y2 = ENCAB + i * ALTO + ALTO / 2;
              return (
                <path
                  key={`d${t.id}`}
                  d={`M${x1},${y1} H${x1 + 6} V${y2} H${Math.max(x2, x1 + 6)}`}
                  stroke="#6b7280"
                  fill="none"
                  strokeWidth={1}
                />
              );
            })}
            {tareas.map((t, i) => {
              const y = ENCAB + i * ALTO + 6;
              const x0 = x(t.fecha_inicio);
              const w = Math.max(pxDia, x(t.fecha_fin) - x0 + pxDia);
              if (t.hito)
                return (
                  <polygon
                    key={t.id}
                    points={`${x0 + pxDia / 2},${y} ${x0 + pxDia},${y + 8} ${x0 + pxDia / 2},${y + 16} ${x0},${y + 8}`}
                    fill="#b8892b"
                  >
                    <title>{`${t.nombre} · ${fmtFecha(t.fecha_inicio)}`}</title>
                  </polygon>
                );
              return (
                <g key={t.id}>
                  <rect x={x0} y={y} width={w} height={16} rx={3} fill="#cfe3e0" stroke="#2A6B66">
                    <title>{`${t.nombre} · ${fmtFecha(t.fecha_inicio)} → ${fmtFecha(t.fecha_fin)} · ${t.avance}%`}</title>
                  </rect>
                  <rect x={x0} y={y} width={(w * t.avance) / 100} height={16} rx={3} fill="#1D4E4A" />
                  {w > 40 && (
                    <text x={x0 + 4} y={y + 12} fontSize={10} fill={t.avance > 20 ? "#ffffff" : "#1D4E4A"}>
                      {t.avance}%
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={xHoy + pxDia / 2} x2={xHoy + pxDia / 2} y1={ENCAB} y2={alto} stroke="#dc2626" strokeDasharray="4 3" />
          </svg>
        </div>
      </div>
      {tareas.length === 0 && <div className="text-sm text-gray-500">Sin tareas. Cree la primera para ver el cronograma.</div>}
      <div className="text-[11px] text-gray-500">
        Barra oscura: avance. Rombo: hito. Linea roja: hoy. Una tarea que depende de otra parte cuando esa termina.
      </div>
    </div>
  );
}
