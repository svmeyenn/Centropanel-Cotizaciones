"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import { Campo, Selector } from "@/components/rrhh/FormularioPersona";
import { fecha, hoyISO } from "@/lib/formato";
import { PARAMETROS_MANUALES } from "@/lib/rrhh";
import {
  eliminarParametro,
  eliminarTramo,
  guardarInstitucion,
  guardarParametro,
  guardarTramo,
} from "@/app/rrhh/acciones";

interface Parametro {
  id: number;
  codigo: string;
  id_institucion: number | null;
  valor: number;
  vigente_desde: string;
  nota: string | null;
  validado: boolean;
}
interface Tramo {
  id: number;
  vigente_desde: string;
  desde: number;
  hasta: number | null;
  factor: number;
  rebaja: number | null;
  validado: boolean;
}
interface Institucion {
  id: number;
  tipo: string;
  nombre: string;
  activo: boolean;
}

const TIPOS_INSTITUCION = ["AFP", "Salud", "Previsional publico", "Mutual", "Caja de compensacion", "Otra"] as const;

const Boton = ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40">
    {children}
  </button>
);

function Seccion({ titulo, nota, accion, children }: { titulo: string; nota?: string; accion: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-semibold text-verde">{titulo}</h2>
          {nota && <p className="text-xs text-gray-500">{nota}</p>}
        </div>
        {accion}
      </header>
      <div className="p-4 overflow-x-auto">{children}</div>
    </section>
  );
}

const Alerta = ({ error }: { error: string | null }) =>
  error ? (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
      {error}
    </div>
  ) : null;

export default function GestorParametrosRRHH({
  pais,
  otrosPaises,
  parametros,
  tramos,
  instituciones,
}: {
  pais: { id: number; codigo: string; nombre: string };
  otrosPaises: { codigo: string; nombre: string }[];
  parametros: Parametro[];
  tramos: Tramo[];
  instituciones: Institucion[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ventana, setVentana] = useState<null | "parametro" | "tramo" | "institucion">(null);
  const [fp, setFp] = useState({ id: null as number | null, codigo: "", id_institucion: "", valor: "", vigente_desde: hoyISO(), nota: "", validado: false });
  const [ft, setFt] = useState({ id: null as number | null, vigente_desde: hoyISO(), desde: "", hasta: "", factor: "", rebaja: "0", validado: false });
  const [fi, setFi] = useState({ id: null as number | null, tipo: "AFP", nombre: "", activo: true });

  const nIns = new Map(instituciones.map((i) => [i.id, i.nombre]));
  const hoy = hoyISO();
  const manuales = PARAMETROS_MANUALES[pais.id] ?? [];
  // Un parametro manual esta "al dia" si hay un valor vigente hoy (para AFP_COMISION, uno por cada AFP).
  const vigenteHoy = (codigo: string, idInst?: number) =>
    parametros
      .filter((p) => p.codigo === codigo && p.vigente_desde <= hoy && (idInst == null || p.id_institucion === idInst))
      .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0];
  const afps = instituciones.filter((i) => i.tipo === "AFP" && i.activo);
  const faltantes = manuales.flatMap((m) =>
    m.codigo === "AFP_COMISION" ? afps.filter((a) => !vigenteHoy(m.codigo, a.id)).map((a) => `${m.codigo} (${a.nombre})`) : vigenteHoy(m.codigo) || m.texto.includes("opcional") ? [] : [m.codigo]
  );
  const sinValidar = parametros.filter((p) => !p.validado).length + tramos.filter((t) => !t.validado).length;

  function ejecutar(fn: () => Promise<{ ok: true } | { error: string }>, cerrar = true) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        if (cerrar) setVentana(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {otrosPaises.length > 1 && (
        <div className="flex gap-2 text-xs">
          {otrosPaises.map((p) => (
            <a key={p.codigo} href={`/rrhh/parametros?pais=${p.codigo}`} className={`px-2.5 py-1 rounded font-semibold ${p.codigo === pais.codigo ? "bg-verde text-white" : "bg-gray-100 text-gray-700"}`}>
              {p.nombre}
            </a>
          ))}
        </div>
      )}

      <div role="status" className={`rounded border px-4 py-3 text-sm ${faltantes.length ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-green-50 border-green-200 text-green-800"}`}>
        {faltantes.length ? (
          <>
            <strong>Faltan por cargar para liquidar en {pais.nombre}:</strong> {faltantes.join(", ")}.
          </>
        ) : (
          <>Estan cargados los parametros que hay que mantener al dia en {pais.nombre}.</>
        )}
        {sinValidar > 0 && <div className="text-xs mt-1">{sinValidar} cifras figuran &quot;por validar&quot;: confirmelas con el contador antes de aprobar liquidaciones reales.</div>}
        {manuales.length > 0 && (
          <ul className="text-xs mt-2 grid sm:grid-cols-2 gap-x-6 text-gray-600">
            {manuales.map((m) => (
              <li key={m.codigo}><strong>{m.codigo}</strong>: {m.texto} ({m.unidad})</li>
            ))}
          </ul>
        )}
      </div>

      <Seccion
        titulo="Parametros con vigencia"
        nota="Cada cifra rige desde su fecha hasta que se cargue una nueva. Las liquidaciones usan la vigente al ultimo dia del mes."
        accion={<Boton onClick={() => { setFp({ id: null, codigo: "", id_institucion: "", valor: "", vigente_desde: hoyISO(), nota: "", validado: false }); setError(null); setVentana("parametro"); }}>Agregar</Boton>}
      >
        <table className="w-full text-xs">
          <thead className="text-left text-gray-500">
            <tr>
              <th scope="col" className="py-1 pr-3">Codigo</th>
              <th scope="col" className="py-1 pr-3">Institucion</th>
              <th scope="col" className="py-1 pr-3 text-right">Valor</th>
              <th scope="col" className="py-1 pr-3">Vigente desde</th>
              <th scope="col" className="py-1 pr-3">Estado</th>
              <th scope="col" className="py-1 pr-3">Nota</th>
              <th scope="col" className="py-1" />
            </tr>
          </thead>
          <tbody>
            {parametros.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-gray-500">Sin parametros.</td></tr>}
            {parametros.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-3 font-semibold">{p.codigo}</td>
                <td className="py-1.5 pr-3">{p.id_institucion ? nIns.get(p.id_institucion) : ""}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{p.valor}</td>
                <td className="py-1.5 pr-3">{fecha(p.vigente_desde)}</td>
                <td className="py-1.5 pr-3">{p.validado ? <span className="text-green-700">Validado</span> : <span className="text-amber-700">Por validar</span>}</td>
                <td className="py-1.5 pr-3 text-gray-500">{p.nota}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <button className="text-verde underline mr-3" onClick={() => { setFp({ id: p.id, codigo: p.codigo, id_institucion: p.id_institucion ? String(p.id_institucion) : "", valor: String(p.valor), vigente_desde: p.vigente_desde, nota: p.nota ?? "", validado: p.validado }); setError(null); setVentana("parametro"); }}>Modificar</button>
                  <button className="text-red-700 underline" onClick={() => ejecutar(() => eliminarParametro(p.id), false)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ventana === null && <div className="mt-2"><Alerta error={error} /></div>}
      </Seccion>

      <Seccion
        titulo={pais.id === 1 ? "Tramos del impuesto unico (en UTM mensuales)" : "Tramos del impuesto a la renta de 5ta categoria (en UIT anuales)"}
        accion={<Boton onClick={() => { setFt({ id: null, vigente_desde: hoyISO(), desde: "", hasta: "", factor: "", rebaja: "0", validado: false }); setError(null); setVentana("tramo"); }}>Agregar</Boton>}
      >
        <table className="w-full text-xs">
          <thead className="text-left text-gray-500">
            <tr>
              <th scope="col" className="py-1 pr-3">Vigente desde</th>
              <th scope="col" className="py-1 pr-3 text-right">Desde</th>
              <th scope="col" className="py-1 pr-3 text-right">Hasta</th>
              <th scope="col" className="py-1 pr-3 text-right">Factor</th>
              <th scope="col" className="py-1 pr-3 text-right">Rebaja</th>
              <th scope="col" className="py-1 pr-3">Estado</th>
              <th scope="col" className="py-1" />
            </tr>
          </thead>
          <tbody>
            {tramos.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-gray-500">Sin tramos.</td></tr>}
            {tramos.map((t) => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-3">{fecha(t.vigente_desde)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{t.desde}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{t.hasta ?? "en adelante"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{t.factor}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{t.rebaja ?? 0}</td>
                <td className="py-1.5 pr-3">{t.validado ? <span className="text-green-700">Validado</span> : <span className="text-amber-700">Por validar</span>}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <button className="text-verde underline mr-3" onClick={() => { setFt({ id: t.id, vigente_desde: t.vigente_desde, desde: String(t.desde), hasta: t.hasta != null ? String(t.hasta) : "", factor: String(t.factor), rebaja: String(t.rebaja ?? 0), validado: t.validado }); setError(null); setVentana("tramo"); }}>Modificar</button>
                  <button className="text-red-700 underline" onClick={() => ejecutar(() => eliminarTramo(t.id), false)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <Seccion
        titulo="Instituciones previsionales"
        nota="AFP, Fonasa e isapres, mutuales y otras: son las que se eligen en el contrato de cada persona."
        accion={<Boton onClick={() => { setFi({ id: null, tipo: "AFP", nombre: "", activo: true }); setError(null); setVentana("institucion"); }}>Agregar</Boton>}
      >
        <table className="w-full text-xs">
          <tbody>
            {instituciones.map((i) => (
              <tr key={i.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-3 text-gray-500 w-48">{i.tipo}</td>
                <td className="py-1.5 pr-3">{i.nombre}{!i.activo && <span className="ml-2 text-gray-400">(inactiva)</span>}</td>
                <td className="py-1.5 text-right">
                  <button className="text-verde underline" onClick={() => { setFi({ id: i.id, tipo: i.tipo, nombre: i.nombre, activo: i.activo }); setError(null); setVentana("institucion"); }}>Modificar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      {ventana === "parametro" && (
        <Ventana titulo={fp.id ? "Modificar parametro" : "Nuevo parametro"} subtitulo={pais.nombre} onCerrar={() => setVentana(null)} ancho="max-w-xl">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Codigo *" value={fp.codigo} onChange={(v) => setFp({ ...fp, codigo: v.toUpperCase() })} placeholder="Ej: UF, UTM, AFP_COMISION" />
              <Selector label="Institucion (si aplica)" value={fp.id_institucion} vacia="-- ninguna --" onChange={(v) => setFp({ ...fp, id_institucion: v })} opciones={instituciones.map((i) => ({ v: i.id, t: `${i.tipo}: ${i.nombre}` }))} />
              <Campo label="Valor *" type="number" value={fp.valor} onChange={(v) => setFp({ ...fp, valor: v })} />
              <Campo label="Vigente desde *" type="date" value={fp.vigente_desde} onChange={(v) => setFp({ ...fp, vigente_desde: v })} />
              <div className="col-span-2"><Campo label="Nota / fuente" value={fp.nota} onChange={(v) => setFp({ ...fp, nota: v })} placeholder="Ej: Circular de la superintendencia, mes" /></div>
              <label className="col-span-2 text-sm flex items-center gap-2">
                <input type="checkbox" checked={fp.validado} onChange={(e) => setFp({ ...fp, validado: e.target.checked })} />
                Cifra validada con el contador o la fuente oficial
              </label>
            </div>
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarParametro(pais.id, fp.id, { codigo: fp.codigo, id_institucion: fp.id_institucion ? Number(fp.id_institucion) : null, valor: Number(fp.valor), vigente_desde: fp.vigente_desde, nota: fp.nota, validado: fp.validado }))}>Grabar</Boton>
              <Boton onClick={() => setVentana(null)}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}

      {ventana === "tramo" && (
        <Ventana titulo={ft.id ? "Modificar tramo" : "Nuevo tramo"} subtitulo={pais.nombre} onCerrar={() => setVentana(null)} ancho="max-w-xl">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Vigente desde *" type="date" value={ft.vigente_desde} onChange={(v) => setFt({ ...ft, vigente_desde: v })} />
              <div />
              <Campo label="Desde *" type="number" value={ft.desde} onChange={(v) => setFt({ ...ft, desde: v })} />
              <Campo label="Hasta (vacio = en adelante)" type="number" value={ft.hasta} onChange={(v) => setFt({ ...ft, hasta: v })} />
              <Campo label="Factor (0.04 = 4%) *" type="number" value={ft.factor} onChange={(v) => setFt({ ...ft, factor: v })} />
              <Campo label="Rebaja" type="number" value={ft.rebaja} onChange={(v) => setFt({ ...ft, rebaja: v })} />
              <label className="col-span-2 text-sm flex items-center gap-2">
                <input type="checkbox" checked={ft.validado} onChange={(e) => setFt({ ...ft, validado: e.target.checked })} />
                Tramo validado con la fuente oficial
              </label>
            </div>
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarTramo(pais.id, ft.id, { vigente_desde: ft.vigente_desde, desde: Number(ft.desde), hasta: ft.hasta.trim() ? Number(ft.hasta) : null, factor: Number(ft.factor), rebaja: Number(ft.rebaja) || 0, validado: ft.validado }))}>Grabar</Boton>
              <Boton onClick={() => setVentana(null)}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}

      {ventana === "institucion" && (
        <Ventana titulo={fi.id ? "Modificar institucion" : "Nueva institucion"} subtitulo={pais.nombre} onCerrar={() => setVentana(null)} ancho="max-w-md">
          <div className="space-y-3">
            <Selector label="Tipo *" value={fi.tipo} onChange={(v) => setFi({ ...fi, tipo: v })} opciones={TIPOS_INSTITUCION} />
            <Campo label="Nombre *" value={fi.nombre} onChange={(v) => setFi({ ...fi, nombre: v })} />
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={fi.activo} onChange={(e) => setFi({ ...fi, activo: e.target.checked })} />
              Activa
            </label>
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarInstitucion(pais.id, fi.id, { tipo: fi.tipo, nombre: fi.nombre, activo: fi.activo }))}>Grabar</Boton>
              <Boton onClick={() => setVentana(null)}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}
    </div>
  );
}
