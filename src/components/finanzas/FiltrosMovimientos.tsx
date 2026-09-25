"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Cuenta, Interlocutor, Proyecto } from "@/lib/finanzas/tipos";
import FiltroInterlocutor from "./FiltroInterlocutor";

export default function FiltrosMovimientos({
  cuentas,
  proyectos,
  interlocutores,
  mostrarEstado = true,
}: {
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  // Sin esta lista no se dibuja el filtro de origen/destino: la cartola no la
  // pasa, y ahi el filtro no aparece.
  interlocutores?: Interlocutor[];
  mostrarEstado?: boolean;
}) {
  const proyectosActivos = proyectos.filter((p) => p.activo && !p.borrado);
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();

  function aplicar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const nuevo = new URLSearchParams();
    datos.forEach((v, k) => {
      const s = v.toString().trim();
      if (s) nuevo.set(k, s);
    });
    // El filtro de origen/destino vive fuera de este formulario y es
    // independiente: ni aplicar ni limpiar lo tocan.
    for (const clave of ["interlocutor", "destino"]) {
      const v = params.get(clave);
      if (v) nuevo.set(clave, v);
    }
    router.push(`${ruta}?${nuevo.toString()}`);
  }

  function limpiar() {
    const conservados = new URLSearchParams();
    for (const clave of ["interlocutor", "destino"]) {
      const v = params.get(clave);
      if (v) conservados.set(clave, v);
    }
    const cola = conservados.toString();
    router.push(cola ? `${ruta}?${cola}` : ruta);
  }

  return (
    <>
      <form
        onSubmit={aplicar}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end mb-3 p-3 bg-crema border border-gris-suave rounded-lg"
      >
        <div>
          <label className="etiqueta">Desde</label>
          <input
            type="date"
            name="desde"
            className="campo"
            defaultValue={params.get("desde") ?? ""}
          />
        </div>
        <div>
          <label className="etiqueta">Hasta</label>
          <input
            type="date"
            name="hasta"
            className="campo"
            defaultValue={params.get("hasta") ?? ""}
          />
        </div>
        <div>
          <label className="etiqueta">Cuenta</label>
          <select
            name="cuenta"
            className="campo"
            defaultValue={params.get("cuenta") ?? ""}
          >
            <option value="">(todas)</option>
            {cuentas.map((c) => (
              <option key={c.id_cuenta} value={c.id_cuenta}>
                {c.alias ?? c.banco}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta">Proyecto</label>
          <select
            name="proyecto"
            className="campo"
            defaultValue={params.get("proyecto") ?? ""}
          >
            <option value="">(todos)</option>
            {proyectosActivos.map((p) => (
              <option key={p.id_proyecto} value={p.id_proyecto}>
                {p.nombre}
                {p.cliente ? ` — ${p.cliente}` : ""}
              </option>
            ))}
          </select>
        </div>
        {mostrarEstado && (
          <div>
            <label className="etiqueta">Estado</label>
            <select
              name="estado"
              className="campo"
              defaultValue={params.get("estado") ?? ""}
            >
              <option value="">(todos)</option>
              <option value="Pagado">Recibido</option>
              <option value="Pendiente">Proyectado</option>
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn flex-1">
            APLICAR
          </button>
          <button type="button" onClick={limpiar} className="btn btn-sec">
            LIMPIAR
          </button>
        </div>
      </form>

      {interlocutores && (
        <div className="mb-4 p-3 bg-crema border border-gris-suave rounded-lg grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* La clave ata el control a la direccion: si el parametro cambia por
              fuera --el boton atras, por ejemplo-- se remonta y vuelve a
              reflejar lo que dice la direccion. */}
          <FiltroInterlocutor
            key={`${params.get("interlocutor") ?? ""}|${params.get("destino") ?? ""}`}
            interlocutores={interlocutores}
            valorId={params.get("interlocutor") ?? ""}
            valorTexto={params.get("destino") ?? ""}
          />
        </div>
      )}
    </>
  );
}
