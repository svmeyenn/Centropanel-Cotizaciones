"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanderaDe } from "@/components/Bandera";
import Ventana from "@/components/Ventana";
import FormularioPersona, { personaVacia } from "@/components/rrhh/FormularioPersona";
import { importe } from "@/lib/formato";
import { crearPersona, type DatosPersona } from "@/app/rrhh/acciones";
import type { Pais } from "@/types/database";

export interface FilaPersonal {
  id: number;
  nombre: string;
  rut: string | null;
  id_pais: number;
  relacion: string;
  clase: string;
  cargo: string | null;
  estado: string;
  contrato: string | null;
  monto: number | null;
  moneda: string | null;
  conCentro: boolean;
}

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const filtro = "border border-gray-300 rounded px-2 py-1.5 text-sm bg-white";

export default function ListadoPersonal({
  filas,
  paises,
  esAdminGeneral,
  puedeOperar,
}: {
  filas: FilaPersonal[];
  paises: Pais[];
  esAdminGeneral: boolean;
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState("Activo");
  const [relacion, setRelacion] = useState("");
  const [clase, setClase] = useState("");
  const paisPorDefecto = paises.length === 1 ? paises[0].id : null;
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState<DatosPersona>(personaVacia(paisPorDefecto));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const visibles = useMemo(() => {
    const palabras = normal(busca).split(/\s+/).filter(Boolean);
    return filas.filter((f) => {
      if (estado && f.estado !== estado) return false;
      if (relacion && f.relacion !== relacion) return false;
      if (clase && f.clase !== clase) return false;
      const t = normal(`${f.nombre} ${f.rut ?? ""} ${f.cargo ?? ""}`);
      return palabras.every((p) => t.includes(p));
    });
  }, [filas, busca, estado, relacion, clase]);

  const activos = filas.filter((f) => f.estado === "Activo");
  const kpis = [
    { t: "Activos", n: activos.length },
    { t: "A contrato", n: activos.filter((f) => f.relacion === "Contrato").length },
    { t: "A honorarios", n: activos.filter((f) => f.relacion === "Honorarios").length },
    { t: "De obra", n: activos.filter((f) => f.clase === "Obra").length },
  ];
  const sinContrato = activos.filter((f) => !f.contrato).length;
  const sinCentro = activos.filter((f) => !f.conCentro).length;

  function crear() {
    setError(null);
    empezar(async () => {
      const r = await crearPersona(form);
      if ("error" in r) setError(r.error);
      else {
        setNuevo(false);
        setForm(personaVacia(paisPorDefecto));
        router.push(`/rrhh/${r.id}`);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {kpis.map((k) => (
          <div key={k.t} className="bg-white border border-gray-200 rounded px-4 py-2 min-w-[8rem]">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{k.t}</div>
            <div className="text-xl font-semibold tabular-nums">{k.n}</div>
          </div>
        ))}
        {(sinContrato > 0 || sinCentro > 0) && (
          <div role="status" className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-2 text-xs self-stretch flex flex-col justify-center">
            {sinContrato > 0 && <span>{sinContrato} sin contrato vigente</span>}
            {sinCentro > 0 && <span>{sinCentro} sin centro de costo</span>}
            <span className="text-amber-700">No se les puede liquidar hasta completarlo.</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input aria-label="Buscar personal" className={`${filtro} w-64`} placeholder="Buscar por nombre, RUT o cargo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Estado" className={filtro} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option>Activo</option>
          <option>Suspendido</option>
          <option>Desvinculado</option>
        </select>
        <select aria-label="Forma de pago" className={filtro} value={relacion} onChange={(e) => setRelacion(e.target.value)}>
          <option value="">Contrato y honorarios</option>
          <option value="Contrato">Contrato de trabajo</option>
          <option value="Honorarios">Honorarios</option>
        </select>
        <select aria-label="Tipo de personal" className={filtro} value={clase} onChange={(e) => setClase(e.target.value)}>
          <option value="">Oficina y obra</option>
          <option value="Administrativo">Administrativo</option>
          <option value="Obra">De obra</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          {visibles.length} de {filas.length}
        </span>
        {puedeOperar && (
          <button
            onClick={() => {
              setError(null);
              setForm(personaVacia(paisPorDefecto));
              setNuevo(true);
            }}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Nueva persona
          </button>
        )}
      </div>

      {nuevo && (
        <Ventana titulo="Nueva persona" subtitulo={form.razon_social} onCerrar={() => setNuevo(false)} ancho="max-w-4xl">
          <div className="space-y-3">
            <FormularioPersona form={form} setForm={setForm} paises={paises} esAdminGeneral={esAdminGeneral} edicion={false} />
            <p className="text-xs text-gray-500">El contrato, los descuentos previsionales y el centro de costo se cargan en la ficha, despues de grabar.</p>
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={crear} disabled={pendiente || !form.id_pais} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40">
                {pendiente ? "Grabando..." : "Grabar"}
              </button>
              <button onClick={() => setNuevo(false)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
                Cancelar
              </button>
            </div>
          </div>
        </Ventana>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Persona</th>
                <th scope="col" className="text-left px-3 py-2">Cargo</th>
                <th scope="col" className="text-left px-3 py-2">Tipo</th>
                <th scope="col" className="text-left px-3 py-2">Contrato vigente</th>
                <th scope="col" className="text-right px-3 py-2">Sueldo / honorario</th>
                <th scope="col" className="text-left px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-8">
                    Sin personal que coincida.
                  </td>
                </tr>
              )}
              {visibles.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 hover:bg-crema">
                  <th scope="row" className="text-left px-3 py-2 font-normal">
                    <BanderaDe idPais={f.id_pais} />
                    <Link href={`/rrhh/${f.id}`} className="text-verde font-semibold underline">
                      {f.nombre}
                    </Link>
                    <div className="text-gray-500">{f.rut}</div>
                  </th>
                  <td className="px-3 py-2 text-gray-600">{f.cargo}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {f.relacion === "Honorarios" ? "Honorarios" : "Contrato"} · {f.clase === "Obra" ? "Obra" : "Oficina"}
                  </td>
                  <td className="px-3 py-2">{f.contrato ?? <span className="text-amber-700">Sin contrato vigente</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.monto != null ? importe(f.monto, f.moneda) : ""}</td>
                  <td className="px-3 py-2">
                    {f.estado === "Activo" ? <span className="text-green-700">Activo</span> : <span className="text-gray-500">{f.estado}</span>}
                    {f.estado === "Activo" && !f.conCentro && <span className="ml-2 text-amber-700">sin centro de costo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
