"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  crearMotivo,
  eliminarMotivo,
  fijarObligatorio,
  guardarMotivo,
  moverMotivo,
  type Resultado,
} from "@/app/estados/motivos";

export interface MotivoFila {
  id: number;
  estado: string;
  etiqueta: string;
  activo: boolean;
}

export interface EstadoConMotivos {
  codigo: string;
  etiqueta: string;
  activo: boolean;
  obligatorio: boolean;
  motivos: MotivoFila[];
}

const BOTON = "border border-gray-300 bg-white rounded px-1.5 py-0.5 text-[11px] disabled:opacity-40";

function FilaMotivo({
  m,
  primero,
  ultimo,
  ocupado,
  ejecutar,
}: {
  m: MotivoFila;
  primero: boolean;
  ultimo: boolean;
  ocupado: boolean;
  ejecutar: (f: () => Promise<Resultado>) => void;
}) {
  const [nombre, setNombre] = useState(m.etiqueta);
  const cambiado = nombre.trim() !== m.etiqueta;
  return (
    <li className="flex flex-wrap items-center gap-1.5 py-1">
      <input
        aria-label={`Nombre del motivo ${m.etiqueta}`}
        className={`border border-gray-300 rounded px-2 py-0.5 text-xs w-64 ${m.activo ? "" : "text-gray-400 line-through"}`}
        value={nombre}
        maxLength={60}
        onChange={(e) => setNombre(e.target.value)}
      />
      {cambiado && (
        <button type="button" className="bg-verde text-white font-semibold rounded px-2 py-0.5 text-[11px]" disabled={ocupado} onClick={() => ejecutar(() => guardarMotivo(m.id, { etiqueta: nombre }))}>
          Guardar nombre
        </button>
      )}
      <button type="button" className={BOTON} disabled={ocupado || primero} onClick={() => ejecutar(() => moverMotivo(m.id, "subir"))} aria-label="Subir">
        ↑
      </button>
      <button type="button" className={BOTON} disabled={ocupado || ultimo} onClick={() => ejecutar(() => moverMotivo(m.id, "bajar"))} aria-label="Bajar">
        ↓
      </button>
      <button type="button" className={BOTON} disabled={ocupado} onClick={() => ejecutar(() => guardarMotivo(m.id, { activo: !m.activo }))}>
        {m.activo ? "Dejar de ofrecer" : "Volver a ofrecer"}
      </button>
      <button
        type="button"
        className={`${BOTON} text-red-700`}
        disabled={ocupado}
        onClick={() => {
          if (confirm(`Eliminar el motivo "${m.etiqueta}"? Los registros que ya lo usaron conservan su nombre.`)) ejecutar(() => eliminarMotivo(m.id));
        }}
      >
        Eliminar
      </button>
    </li>
  );
}

function TarjetaEstado({
  tipo,
  e,
  ocupado,
  ejecutar,
}: {
  tipo: "lead" | "cotizacion";
  e: EstadoConMotivos;
  ocupado: boolean;
  ejecutar: (f: () => Promise<Resultado>) => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const activos = e.motivos.filter((m) => m.activo).length;
  return (
    <section className="bg-white border border-gray-200 rounded">
      <h3 className="bg-crema border-b border-gray-200 px-3 py-1.5 text-xs font-semibold flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={e.activo ? "" : "text-gray-400"}>
          {e.etiqueta}
          {!e.activo && " (no se ofrece)"}
        </span>
        <label className="flex items-center gap-1.5 font-normal">
          <input
            type="checkbox"
            checked={e.obligatorio}
            disabled={ocupado}
            onChange={(ev) => ejecutar(() => fijarObligatorio(tipo, e.codigo, ev.target.checked))}
          />
          Exigir motivo al pasar a este estado
        </label>
        {e.obligatorio && activos === 0 && (
          <span className="font-normal text-amber-800">Sin motivos que ofrecer, hoy no exige nada.</span>
        )}
      </h3>
      <div className="px-3 py-1.5">
        {e.motivos.length === 0 ? (
          <p className="text-[11px] text-gray-500">Sin motivos: al pasar a este estado solo se ofrece el comentario.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {e.motivos.map((m, i) => (
              <FilaMotivo key={`${m.id}-${m.etiqueta}`} m={m} primero={i === 0} ultimo={i === e.motivos.length - 1} ocupado={ocupado} ejecutar={ejecutar} />
            ))}
          </ul>
        )}
        <form
          className="flex gap-1.5 mt-1.5"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!nuevo.trim()) return;
            ejecutar(async () => {
              const r = await crearMotivo(tipo, e.codigo, nuevo);
              if (r.ok) setNuevo("");
              return r;
            });
          }}
        >
          <input
            aria-label={`Nuevo motivo para ${e.etiqueta}`}
            className="border border-gray-300 rounded px-2 py-0.5 text-xs w-64"
            placeholder="Nuevo motivo"
            value={nuevo}
            maxLength={60}
            onChange={(ev) => setNuevo(ev.target.value)}
          />
          <button className="bg-verde text-white font-semibold rounded px-2.5 py-0.5 text-[11px] disabled:opacity-50" disabled={ocupado || !nuevo.trim()}>
            Agregar
          </button>
        </form>
      </div>
    </section>
  );
}

export default function GestorMotivos({ tipo, estados }: { tipo: "lead" | "cotizacion"; estados: EstadoConMotivos[] }) {
  const router = useRouter();
  const [pendiente, comenzar] = useTransition();
  const [mensaje, setMensaje] = useState<Resultado | null>(null);

  function ejecutar(f: () => Promise<Resultado>) {
    setMensaje(null);
    comenzar(async () => {
      const r = await f();
      setMensaje(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {mensaje?.mensaje && (
        <p className={`text-xs rounded px-3 py-1.5 border ${mensaje.ok ? "bg-green-50 border-green-300 text-green-900" : "bg-red-50 border-red-300 text-red-800"}`} role="status">
          {mensaje.mensaje}
        </p>
      )}
      {estados.map((e) => (
        <TarjetaEstado key={e.codigo} tipo={tipo} e={e} ocupado={pendiente} ejecutar={ejecutar} />
      ))}
    </div>
  );
}
