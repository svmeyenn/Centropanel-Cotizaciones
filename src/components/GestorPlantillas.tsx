"use client";

import { useState, useTransition } from "react";
import { crearPlantilla, eliminarPlantilla, guardarPlantilla, moverPlantilla, type Resultado } from "@/app/mensajes/acciones";
import type { Canal, Plantilla } from "@/lib/mensajes";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[12px] w-full bg-white";
const ROTULO = "block text-[11px] font-semibold text-dorado-osc mb-0.5";

export default function GestorPlantillas({ linea, canal, plantillas }: { linea: string; canal: Canal; plantillas: Plantilla[] }) {
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  function ejecutar(f: () => Promise<Resultado>) {
    empezar(async () => {
      const r = await f();
      setAviso(r.ok ? (r.mensaje ? { ok: true, texto: r.mensaje } : null) : { ok: false, texto: r.mensaje ?? "No se pudo." });
    });
  }

  return (
    <div className="space-y-2">
      {aviso && (
        <p className={`text-[12px] ${aviso.ok ? "text-green-700" : "text-red-700"}`} role={aviso.ok ? "status" : "alert"}>
          {aviso.texto}
        </p>
      )}

      {plantillas.length === 0 && <p className="text-sm text-gray-500">No hay mensajes. Agregue el primero abajo.</p>}
      <ul className="space-y-2">
        {plantillas.map((p, i) => (
          <Fila
            key={`${p.id}-${p.nombre}-${p.cuerpo.length}-${p.activo}`}
            p={p}
            primero={i === 0}
            ultimo={i === plantillas.length - 1}
            ocupado={pendiente}
            ejecutar={ejecutar}
            canal={canal}
            linea={linea}
          />
        ))}
      </ul>

      <Nuevo linea={linea} canal={canal} ocupado={pendiente} ejecutar={ejecutar} />
    </div>
  );
}

function Fila({
  p,
  canal,
  linea,
  primero,
  ultimo,
  ocupado,
  ejecutar,
}: {
  p: Plantilla;
  canal: Canal;
  linea: string;
  primero: boolean;
  ultimo: boolean;
  ocupado: boolean;
  ejecutar: (f: () => Promise<Resultado>) => void;
}) {
  const [nombre, setNombre] = useState(p.nombre);
  const [asunto, setAsunto] = useState(p.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(p.cuerpo);
  const [activo, setActivo] = useState(p.activo);
  const [confirmando, setConfirmando] = useState(false);
  const cambio = nombre !== p.nombre || asunto !== (p.asunto ?? "") || cuerpo !== p.cuerpo || activo !== p.activo;

  return (
    <li className={`bg-white border rounded p-3 space-y-2 ${p.activo ? "border-gray-200" : "border-gray-200 opacity-70"}`}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-48">
          <label htmlFor={`n-${p.id}`} className={ROTULO}>
            Nombre
          </label>
          <input id={`n-${p.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className={CAMPO} />
        </div>
        <label className="inline-flex items-center gap-1.5 text-[12px] pb-1">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Se ofrece
        </label>
        <div className="flex gap-1 pb-0.5">
          <button type="button" aria-label="Subir" disabled={ocupado || primero} onClick={() => ejecutar(() => moverPlantilla(linea, canal, p.id, "subir"))} className="border border-gray-300 rounded px-2 py-0.5 text-[12px] disabled:opacity-40">
            ↑
          </button>
          <button type="button" aria-label="Bajar" disabled={ocupado || ultimo} onClick={() => ejecutar(() => moverPlantilla(linea, canal, p.id, "bajar"))} className="border border-gray-300 rounded px-2 py-0.5 text-[12px] disabled:opacity-40">
            ↓
          </button>
        </div>
      </div>
      {canal === "email" && (
        <div>
          <label htmlFor={`a-${p.id}`} className={ROTULO}>
            Asunto
          </label>
          <input id={`a-${p.id}`} value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} className={CAMPO} />
        </div>
      )}
      <div>
        <label htmlFor={`c-${p.id}`} className={ROTULO}>
          Texto
        </label>
        <textarea id={`c-${p.id}`} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={canal === "email" ? 8 : 4} maxLength={4000} className={CAMPO} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={ocupado || !cambio}
          onClick={() => ejecutar(() => guardarPlantilla(p.id, canal, { nombre, asunto, cuerpo, activo }))}
          className="bg-verde text-white text-[12px] font-semibold px-2.5 py-1 rounded disabled:opacity-50"
        >
          Guardar
        </button>
        {!confirmando ? (
          <button type="button" disabled={ocupado} onClick={() => setConfirmando(true)} className="text-[12px] text-red-700 underline">
            Eliminar
          </button>
        ) : (
          <span className="text-[12px] text-red-700 inline-flex items-center gap-2">
            Se elimina para todos. Si solo quiere dejar de ofrecerlo, desmarque &quot;Se ofrece&quot;.
            <button type="button" disabled={ocupado} onClick={() => ejecutar(() => eliminarPlantilla(p.id))} className="bg-red-700 text-white font-semibold px-2 py-0.5 rounded">
              Eliminar
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="underline text-gray-700">
              Cancelar
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

function Nuevo({ linea, canal, ocupado, ejecutar }: { linea: string; canal: Canal; ocupado: boolean; ejecutar: (f: () => Promise<Resultado>) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="bg-verde text-white text-[12px] font-semibold px-2.5 py-1 rounded">
        Agregar un mensaje
      </button>
    );

  return (
    <form
      className="bg-crema/40 border border-gray-200 rounded p-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        ejecutar(async () => {
          const r = await crearPlantilla(linea, canal, nombre, asunto, cuerpo);
          if (r.ok) {
            setNombre("");
            setAsunto("");
            setCuerpo("");
            setAbierto(false);
          }
          return r;
        });
      }}
    >
      <h3 className="text-[12px] font-semibold text-verde">Agregar un mensaje</h3>
      <div>
        <label htmlFor="nuevo-nombre" className={ROTULO}>
          Nombre
        </label>
        <input id="nuevo-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className={CAMPO} />
      </div>
      {canal === "email" && (
        <div>
          <label htmlFor="nuevo-asunto" className={ROTULO}>
            Asunto
          </label>
          <input id="nuevo-asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} className={CAMPO} />
        </div>
      )}
      <div>
        <label htmlFor="nuevo-cuerpo" className={ROTULO}>
          Texto
        </label>
        <textarea id="nuevo-cuerpo" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={canal === "email" ? 8 : 4} maxLength={4000} className={CAMPO} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={ocupado} className="bg-verde text-white text-[12px] font-semibold px-2.5 py-1 rounded disabled:opacity-50">
          Agregar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="border border-gray-300 text-[12px] px-2.5 py-1 rounded">
          Cancelar
        </button>
      </div>
    </form>
  );
}
