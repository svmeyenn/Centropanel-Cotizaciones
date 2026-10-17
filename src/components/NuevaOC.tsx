"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearOC } from "@/app/compras/acciones";

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

export default function NuevaOC({
  proyectos,
  partidas,
  proveedores,
  solicitudes,
  proyectoInicial,
}: {
  proyectos: { id: number; nombre: string; id_pais: number }[];
  partidas: { id: number; id_proyecto: number; nombre: string }[];
  proveedores: { id: number; razon_social: string; id_pais: number }[];
  solicitudes: { id: number; num: string; proveedor: string; id_pais: number }[];
  proyectoInicial: number | null;
}) {
  const router = useRouter();
  const [proyecto, setProyecto] = useState<number | "">(proyectoInicial ?? "");
  const [partida, setPartida] = useState<number | "">("");
  const [proveedor, setProveedor] = useState<number | "">("");
  const [solicitud, setSolicitud] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const pais = proyectos.find((p) => p.id === proyecto)?.id_pais;
  const partidasDe = useMemo(() => partidas.filter((x) => x.id_proyecto === proyecto), [partidas, proyecto]);
  const provDe = proveedores.filter((p) => !pais || p.id_pais === pais);
  const solDe = solicitudes.filter((s) => !pais || s.id_pais === pais);

  function crear() {
    setError(null);
    if (!proyecto) return setError("Elija el proyecto.");
    empezar(async () => {
      const r = await crearOC({
        id_proyecto: proyecto,
        id_partida: partida || null,
        id_proveedor: proveedor || null,
        id_solicitud: solicitud || null,
      });
      if (r?.error) setError(r.error);
      else if ("id" in r && r.id) router.push(`/compras/${r.id}`);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-3 max-w-2xl">
      <label className="text-sm block">
        <span className="block text-dorado-osc font-semibold mb-1">Proyecto *</span>
        <select
          className={input}
          value={proyecto}
          onChange={(e) => {
            setProyecto(Number(e.target.value) || "");
            setPartida("");
          }}
        >
          <option value="">-- elija --</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm block">
        <span className="block text-dorado-osc font-semibold mb-1">Partida del presupuesto</span>
        <select className={input} value={partida} onChange={(e) => setPartida(Number(e.target.value) || "")}>
          <option value="">-- sin partida --</option>
          {partidasDe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm block">
        <span className="block text-dorado-osc font-semibold mb-1">Partir desde una solicitud a proveedor</span>
        <select
          className={input}
          value={solicitud}
          onChange={(e) => {
            setSolicitud(Number(e.target.value) || "");
            if (e.target.value) setProveedor("");
          }}
        >
          <option value="">-- no, orden en blanco --</option>
          {solDe.map((s) => (
            <option key={s.id} value={s.id}>
              {s.num} · {s.proveedor}
            </option>
          ))}
        </select>
      </label>
      {!solicitud && (
        <label className="text-sm block">
          <span className="block text-dorado-osc font-semibold mb-1">Proveedor *</span>
          <select className={input} value={proveedor} onChange={(e) => setProveedor(Number(e.target.value) || "")}>
            <option value="">-- elija --</option>
            {provDe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razon_social}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <div className="text-sm text-red-700 font-semibold">{error}</div>}
      <button
        onClick={crear}
        disabled={pendiente}
        className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
      >
        {pendiente ? "Creando..." : "Crear orden"}
      </button>
    </div>
  );
}
