"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarProyecto, buscarClientes, crearProyecto, type DatosProyecto } from "@/app/proyectos/acciones";

export const ESTADOS_PROYECTO = ["Planificacion", "Fabricacion", "Despacho", "Instalacion", "Cerrado"];

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

export default function FormProyecto({
  id,
  inicial,
  responsables,
  puedeEditar,
  etiquetaBoton,
}: {
  id?: number;
  inicial?: Partial<DatosProyecto>;
  responsables: { id: number; nombre: string }[];
  puedeEditar: boolean;
  etiquetaBoton: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(id != null);
  const [f, setF] = useState<DatosProyecto>({
    nombre: inicial?.nombre ?? "",
    cliente: inicial?.cliente ?? "",
    id_cliente: inicial?.id_cliente ?? null,
    tipo: inicial?.tipo ?? "obra",
    estado: inicial?.estado ?? "Planificacion",
    id_responsable: inicial?.id_responsable ?? null,
    direccion: inicial?.direccion ?? "",
    fecha_inicio: inicial?.fecha_inicio ?? "",
    fecha_fin: inicial?.fecha_fin ?? "",
    notas: inicial?.notas ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, empezar] = useTransition();
  const [sugeridos, setSugeridos] = useState<{ id: number; razon_social: string; rut: string | null }[]>([]);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El cliente se enlaza a su ficha: escribir busca por nombre o RUT.
  function escribirCliente(texto: string) {
    setF((a) => ({ ...a, cliente: texto, id_cliente: null }));
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(async () => setSugeridos(await buscarClientes(texto)), 250);
  }
  function elegirCliente(c: { id: number; razon_social: string }) {
    setF((a) => ({ ...a, cliente: c.razon_social, id_cliente: c.id }));
    setSugeridos([]);
  }

  function guardar() {
    setError(null);
    setOk(false);
    empezar(async () => {
      const r = id ? await actualizarProyecto(id, f) : await crearProyecto(f);
      if (r?.error) setError(r.error);
      else if (!id && "id" in r && r.id) router.push(`/proyectos/${r.id}`);
      else setOk(true);
    });
  }

  if (!abierto) {
    return puedeEditar ? (
      <button
        onClick={() => setAbierto(true)}
        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
      >
        {etiquetaBoton}
      </button>
    ) : null;
  }

  const set = (k: keyof DatosProyecto) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm md:col-span-2">
          <span className="block text-dorado-osc font-semibold mb-1">Nombre *</span>
          <input className={input} value={f.nombre} onChange={set("nombre")} disabled={!puedeEditar} />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Tipo</span>
          <select className={input} value={f.tipo} onChange={set("tipo")} disabled={!puedeEditar}>
            <option value="obra">Obra</option>
            <option value="centro_costo">Centro de costo (gastos generales)</option>
          </select>
        </label>
        <label className="text-sm relative">
          <span className="block text-dorado-osc font-semibold mb-1">
            Cliente{" "}
            {f.id_cliente ? (
              <span className="text-verde text-[11px]">enlazado a su ficha</span>
            ) : f.cliente ? (
              <span className="text-gray-400 text-[11px]">solo texto: elija de la lista para enlazar</span>
            ) : null}
          </span>
          <input
            className={input}
            value={f.cliente}
            onChange={(e) => escribirCliente(e.target.value)}
            disabled={!puedeEditar}
            autoComplete="off"
          />
          {sugeridos.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-300 rounded shadow mt-0.5 max-h-56 overflow-auto">
              {sugeridos.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1 text-xs hover:bg-crema"
                    onClick={() => elegirCliente(c)}
                  >
                    {c.razon_social}
                    {c.rut ? <span className="text-gray-500"> · {c.rut}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Estado</span>
          <select className={input} value={f.estado} onChange={set("estado")} disabled={!puedeEditar}>
            {ESTADOS_PROYECTO.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Responsable</span>
          <select
            className={input}
            value={f.id_responsable ?? ""}
            onChange={(e) => setF({ ...f, id_responsable: Number(e.target.value) || null })}
            disabled={!puedeEditar}
          >
            <option value="">-- sin asignar --</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm md:col-span-3">
          <span className="block text-dorado-osc font-semibold mb-1">Direccion de la obra</span>
          <input className={input} value={f.direccion} onChange={set("direccion")} disabled={!puedeEditar} />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Inicio</span>
          <input type="date" className={input} value={f.fecha_inicio} onChange={set("fecha_inicio")} disabled={!puedeEditar} />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Termino</span>
          <input type="date" className={input} value={f.fecha_fin} onChange={set("fecha_fin")} disabled={!puedeEditar} />
        </label>
        <label className="text-sm md:col-span-3">
          <span className="block text-dorado-osc font-semibold mb-1">Notas</span>
          <textarea className={input} rows={2} value={f.notas} onChange={set("notas")} disabled={!puedeEditar} />
        </label>
      </div>
      {error && <div className="text-sm text-red-700 font-semibold">{error}</div>}
      {ok && <div className="text-sm text-green-700 font-semibold">Guardado.</div>}
      {puedeEditar && (
        <div className="flex gap-2">
          <button
            onClick={guardar}
            disabled={pendiente}
            className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
          >
            {pendiente ? "Grabando..." : "Grabar"}
          </button>
          {!id && (
            <button
              onClick={() => setAbierto(false)}
              className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
