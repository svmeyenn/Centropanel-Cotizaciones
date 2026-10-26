"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarPropietario, quitarPropietario, type Resultado } from "@/app/propietarios/acciones";

export interface PersonaFila {
  email: string;
  nombre: string;
  leads: number;
}

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";

export default function GestorPropietarios({ personas }: { personas: PersonaFila[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  function ejecutar(f: () => Promise<Resultado>, alTerminar?: () => void) {
    setAviso(null);
    empezar(async () => {
      const r = await f();
      setAviso({ ok: r.ok, texto: r.mensaje ?? (r.ok ? "Listo." : "No se pudo guardar.") });
      if (r.ok) {
        alTerminar?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <form
        className="bg-white border border-gray-200 rounded p-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ejecutar(
            () => guardarPropietario(email, nombre),
            () => {
              setEmail("");
              setNombre("");
            }
          );
        }}
      >
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="prop-nombre" className={ROTULO}>
            Nombre
          </label>
          <input
            id="prop-nombre"
            className={CAMPO}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            placeholder="Nombre y apellido, como se ve en los leads"
            required
          />
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="prop-email" className={ROTULO}>
            Correo
          </label>
          <input
            id="prop-email"
            type="email"
            className={CAMPO}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={120}
            placeholder="persona@centropanel.cl"
            required
          />
        </div>
        <button type="submit" disabled={pendiente} className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-50">
          {pendiente ? "Guardando..." : "Agregar persona"}
        </button>
      </form>

      {aviso && (
        <p
          className={`text-xs rounded px-3 py-2 border ${aviso.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}
          role={aviso.ok ? "status" : "alert"}
        >
          {aviso.texto}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">Correo</th>
                <th className="text-right px-3 py-2">Leads</th>
                <th className="px-3 py-2 w-40" />
              </tr>
            </thead>
            <tbody>
              {personas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 py-6">
                    Todavia no hay personas.
                  </td>
                </tr>
              )}
              {personas.map((p) => (
                <FilaPersona key={p.email} p={p} ocupado={pendiente} ejecutar={ejecutar} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilaPersona({ p, ocupado, ejecutar }: { p: PersonaFila; ocupado: boolean; ejecutar: (f: () => Promise<Resultado>) => void }) {
  const [nombre, setNombre] = useState(p.nombre);
  const cambiado = nombre.trim() !== p.nombre;
  return (
    <tr className="border-t border-gray-100 hover:bg-crema">
      <td className="px-3 py-1.5">
        <input
          aria-label={`Nombre de ${p.email}`}
          className="border border-gray-300 rounded px-2 py-0.5 text-xs w-full max-w-xs bg-white"
          value={nombre}
          maxLength={80}
          onChange={(e) => setNombre(e.target.value)}
        />
      </td>
      <td className="px-3 py-1.5 text-gray-700">{p.email}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{p.leads.toLocaleString("es-CL")}</td>
      <td className="px-3 py-1.5 whitespace-nowrap text-right">
        {cambiado && (
          <button
            type="button"
            disabled={ocupado}
            className="bg-verde text-white font-semibold rounded px-2 py-0.5 text-[11px] mr-2 disabled:opacity-50"
            onClick={() => ejecutar(() => guardarPropietario(p.email, nombre))}
          >
            Guardar nombre
          </button>
        )}
        <button
          type="button"
          disabled={ocupado || p.leads > 0}
          title={p.leads > 0 ? "Tiene leads: reasignelos antes de quitarla" : "Quitar de la lista"}
          className="border border-gray-300 text-gray-700 rounded px-2 py-0.5 text-[11px] disabled:opacity-40"
          onClick={() => {
            if (confirm(`Quitar a ${p.nombre} de la lista de propietarios?`)) ejecutar(() => quitarPropietario(p.email));
          }}
        >
          Quitar
        </button>
      </td>
    </tr>
  );
}
