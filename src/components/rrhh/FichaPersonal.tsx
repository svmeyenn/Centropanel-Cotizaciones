"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import FormularioPersona, { Campo, Selector, estiloCampo } from "@/components/rrhh/FormularioPersona";
import { fecha, hoyISO, importe, monedaDelPais } from "@/lib/formato";
import { COLOR_ESTADO_LIQ, GRATIFICACIONES, TIPOS_ANTICIPO, TIPOS_CONTRATO, folioLiquidacion, nombrePeriodo } from "@/lib/rrhh";
import {
  actualizarPersona,
  anularAnticipo,
  eliminarItemRecurrente,
  eliminarNovedad,
  guardarAnticipo,
  guardarContrato,
  guardarImputaciones,
  guardarItemRecurrente,
  guardarNovedad,
  type DatosContrato,
  type DatosPersona,
} from "@/app/rrhh/acciones";
import type { Pais } from "@/types/database";

type Persona = DatosPersona & { id: number; id_entidad: number; id_pais: number };
interface Contrato {
  id: number;
  tipo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string;
  sueldo_base: number | null;
  valor_hora: number | null;
  monto_honorario: number | null;
  jornada_horas: number | null;
  gratificacion: string;
  gratificacion_monto: number | null;
  colacion: number | null;
  movilizacion: number | null;
  id_prevision: number | null;
  id_salud: number | null;
  salud_plan_uf: number | null;
  id_mutual: number | null;
  tasa_mutual_extra: number | null;
  seguro_cesantia: boolean;
  pensionado: boolean;
  notas: string | null;
}
interface Opcion {
  id: number;
  texto: string;
}
interface Imputacion {
  id_centro_costo: number;
  id_proyecto: number | null;
  porcentaje: number;
}
interface Concepto {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  imponible: boolean;
  sistema: boolean;
}
interface Recurrente {
  id: number;
  id_concepto: number;
  monto: number;
  desde: string | null;
  hasta: string | null;
  nota: string | null;
}
interface Novedad {
  id: number;
  periodo: string;
  id_concepto: number;
  cantidad: number | null;
  monto: number;
  id_proyecto: number | null;
  nota: string | null;
}
interface Anticipo {
  id: number;
  tipo: string;
  fecha: string | null;
  concepto: string | null;
  monto_total: number;
  cuotas: number;
  desde_periodo: string;
  monto_cuota: number;
  monto_descontado: number;
  estado: string;
}
interface LiqResumen {
  id: number;
  periodo: string;
  tipo: string;
  estado: string;
  liquido: number | null;
  moneda: string | null;
}
interface Institucion {
  id: number;
  tipo: string;
  nombre: string;
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const txt = (n: number | null | undefined) => (n == null ? "" : String(n));

const contratoVacio = (honorarios: boolean): DatosContrato => ({
  tipo: honorarios ? "Honorarios" : "Indefinido",
  descripcion: "",
  fecha_inicio: hoyISO(),
  fecha_fin: "",
  estado: "Vigente",
  sueldo_base: null,
  valor_hora: null,
  monto_honorario: null,
  jornada_horas: 45,
  gratificacion: "Ninguna",
  gratificacion_monto: null,
  colacion: null,
  movilizacion: null,
  id_prevision: null,
  id_salud: null,
  salud_plan_uf: null,
  id_mutual: null,
  tasa_mutual_extra: null,
  seguro_cesantia: true,
  pensionado: false,
  notas: "",
});

function aForm(c: Contrato): DatosContrato {
  return { ...c, descripcion: c.descripcion ?? "", fecha_fin: c.fecha_fin ?? "", notas: c.notas ?? "" };
}

function Seccion({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded">
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-verde">{titulo}</h2>
        {accion}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const Boton = ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40">
    {children}
  </button>
);

function Alerta({ error }: { error: string | null }) {
  return error ? (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
      {error}
    </div>
  ) : null;
}

export default function FichaPersonal({
  persona,
  pais,
  contratos,
  imputaciones,
  centros,
  proyectos,
  recurrentes,
  conceptos,
  novedades,
  anticipos,
  liquidaciones,
  instituciones,
  puedeOperar,
}: {
  persona: Persona;
  pais: Pais;
  contratos: Contrato[];
  imputaciones: Imputacion[];
  centros: Opcion[];
  proyectos: Opcion[];
  recurrentes: Recurrente[];
  conceptos: Concepto[];
  novedades: Novedad[];
  anticipos: Anticipo[];
  liquidaciones: LiqResumen[];
  instituciones: Institucion[];
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const moneda = monedaDelPais(persona.id_pais);
  const honorarios = persona.relacion === "Honorarios";
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ventana, setVentana] = useState<null | "persona" | "contrato" | "recurrente" | "novedad" | "anticipo">(null);

  // Formularios
  const [fp, setFp] = useState<DatosPersona>(persona);
  const [idContrato, setIdContrato] = useState<number | null>(null);
  const [fc, setFc] = useState<DatosContrato>(contratoVacio(honorarios));
  const [fr, setFr] = useState({ id: null as number | null, id_concepto: 0, monto: "", desde: "", hasta: "", nota: "" });
  const [fn, setFn] = useState({ id: null as number | null, periodo: hoyISO().slice(0, 7), id_concepto: 0, cantidad: "", monto: "", id_proyecto: "", nota: "" });
  const [fa, setFa] = useState({ tipo: "Anticipo de sueldo", fecha: hoyISO(), concepto: "", monto_total: "", cuotas: "1", desde_periodo: hoyISO().slice(0, 7), nota: "" });
  const [filasCentro, setFilasCentro] = useState(
    imputaciones.length ? imputaciones.map((i) => ({ ...i })) : [{ id_centro_costo: 0, id_proyecto: null as number | null, porcentaje: 100 }]
  );

  const vigente = contratos.find((c) => c.estado === "Vigente") ?? null;
  const cNombre = new Map(centros.map((c) => [c.id, c.texto]));
  const pNombre = new Map(proyectos.map((c) => [c.id, c.texto]));
  const conNombre = new Map(conceptos.map((c) => [c.id, c.nombre]));
  const insNombre = new Map(instituciones.map((i) => [i.id, i.nombre]));
  const de = (tipo: string) => instituciones.filter((i) => i.tipo === tipo).map((i) => ({ v: i.id, t: i.nombre }));
  const sumaCentros = filasCentro.reduce((s, f) => s + (Number(f.porcentaje) || 0), 0);

  function ejecutar(fn: () => Promise<{ ok: true } | { error: string }>, alExito?: () => void) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        alExito?.();
        router.refresh();
      }
    });
  }

  const cerrar = () => {
    setVentana(null);
    setError(null);
  };
  const setC = <K extends keyof DatosContrato>(k: K, v: DatosContrato[K]) => setFc({ ...fc, [k]: v });
  const esHon = fc.tipo === "Honorarios";

  return (
    <div className="space-y-4">
      {/* Datos */}
      <Seccion
        titulo="Datos de la persona"
        accion={puedeOperar && <Boton onClick={() => { setFp(persona); setError(null); setVentana("persona"); }}>Modificar</Boton>}
      >
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
          {[
            ["Se le paga por", honorarios ? "Honorarios" : "Contrato de trabajo"],
            ["Tipo", persona.clase === "Obra" ? `Trabajador de obra${persona.oficio ? ` · ${persona.oficio}` : ""}` : "Administrativo"],
            ["Estado", persona.estado],
            ["Ingreso", fecha(persona.fecha_ingreso) || "—"],
            ["Termino", fecha(persona.fecha_termino) || "—"],
            ["Cargas familiares", String(persona.cargas_familiares)],
            ["Correo / telefono", [persona.email, persona.telefono].filter(Boolean).join(" · ") || "—"],
            ["Cuenta de pago", [persona.banco, persona.tipo_cuenta, persona.numero_cuenta].filter(Boolean).join(" · ") || "Sin cuenta registrada"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-gray-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Seccion>

      {/* Contrato */}
      <Seccion
        titulo={honorarios ? "Honorarios acordados" : "Contrato de trabajo"}
        accion={
          puedeOperar && (
            <Boton
              onClick={() => {
                setIdContrato(null);
                setFc(contratoVacio(honorarios));
                setError(null);
                setVentana("contrato");
              }}
            >
              {vigente ? "Nuevo contrato o anexo" : "Registrar contrato"}
            </Boton>
          )
        }
      >
        {!vigente && <p className="text-xs text-amber-700 mb-2">Sin contrato vigente: no se puede liquidar. Registre el contrato.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-gray-500">
              <tr>
                <th scope="col" className="py-1 pr-3">Tipo</th>
                <th scope="col" className="py-1 pr-3">Desde</th>
                <th scope="col" className="py-1 pr-3">Hasta</th>
                <th scope="col" className="py-1 pr-3 text-right">Sueldo / honorario</th>
                <th scope="col" className="py-1 pr-3">Gratificacion</th>
                <th scope="col" className="py-1 pr-3">Prevision / salud / mutual</th>
                <th scope="col" className="py-1 pr-3">Estado</th>
                <th scope="col" className="py-1" />
              </tr>
            </thead>
            <tbody>
              {contratos.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-gray-500">Sin contratos registrados.</td>
                </tr>
              )}
              {contratos.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3">{c.tipo}</td>
                  <td className="py-1.5 pr-3">{fecha(c.fecha_inicio)}</td>
                  <td className="py-1.5 pr-3">{fecha(c.fecha_fin) || "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{importe(c.tipo === "Honorarios" ? c.monto_honorario : c.sueldo_base, moneda)}</td>
                  <td className="py-1.5 pr-3">{c.tipo === "Honorarios" ? "—" : c.gratificacion}</td>
                  <td className="py-1.5 pr-3">
                    {c.tipo === "Honorarios" ? "—" : [insNombre.get(Number(c.id_prevision)), insNombre.get(Number(c.id_salud)), insNombre.get(Number(c.id_mutual))].filter(Boolean).join(" / ") || "Sin definir"}
                  </td>
                  <td className="py-1.5 pr-3">{c.estado}</td>
                  <td className="py-1.5 text-right">
                    {puedeOperar && (
                      <button className="text-verde underline" onClick={() => { setIdContrato(c.id); setFc(aForm(c)); setError(null); setVentana("contrato"); }}>
                        Modificar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {/* Centro de costo */}
      <Seccion titulo="Mercado, negocio y centro de costo">
        <p className="text-xs text-gray-600 mb-2">
          Mercado: <strong>{pais?.nombre}</strong>. El costo de cada liquidacion se reparte entre estos centros (y proyectos de obra) en los porcentajes indicados.
        </p>
        <div className="space-y-2">
          {filasCentro.map((f, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="text-xs">
                <span className="block text-gray-500">Centro de costo</span>
                <select
                  className={`${estiloCampo} w-72`}
                  disabled={!puedeOperar}
                  value={f.id_centro_costo || ""}
                  onChange={(e) => setFilasCentro(filasCentro.map((x, j) => (j === i ? { ...x, id_centro_costo: Number(e.target.value) } : x)))}
                >
                  <option value="">-- elija --</option>
                  {centros.map((c) => (
                    <option key={c.id} value={c.id}>{c.texto}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="block text-gray-500">Proyecto de obra (opcional)</span>
                <select
                  className={`${estiloCampo} w-64`}
                  disabled={!puedeOperar}
                  value={f.id_proyecto ?? ""}
                  onChange={(e) => setFilasCentro(filasCentro.map((x, j) => (j === i ? { ...x, id_proyecto: e.target.value ? Number(e.target.value) : null } : x)))}
                >
                  <option value="">-- ninguno --</option>
                  {proyectos.map((c) => (
                    <option key={c.id} value={c.id}>{c.texto}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="block text-gray-500">%</span>
                <input
                  type="number"
                  className={`${estiloCampo} w-20`}
                  disabled={!puedeOperar}
                  value={f.porcentaje}
                  onChange={(e) => setFilasCentro(filasCentro.map((x, j) => (j === i ? { ...x, porcentaje: Number(e.target.value) } : x)))}
                />
              </label>
              {puedeOperar && filasCentro.length > 1 && (
                <button className="text-red-700 text-xs underline pb-1.5" onClick={() => setFilasCentro(filasCentro.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>
        {puedeOperar && (
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Boton onClick={() => setFilasCentro([...filasCentro, { id_centro_costo: 0, id_proyecto: null, porcentaje: 0 }])}>Agregar centro</Boton>
            <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarImputaciones(persona.id, filasCentro))}>Guardar reparto</Boton>
            <span className={`text-xs ${Math.abs(sumaCentros - 100) > 0.001 ? "text-red-700" : "text-green-700"}`}>Suma {Math.round(sumaCentros * 100) / 100}%</span>
          </div>
        )}
        {ventana === null && <div className="mt-2"><Alerta error={error} /></div>}
      </Seccion>

      {/* Recurrentes */}
      {!honorarios && (
        <Seccion
          titulo="Haberes y descuentos fijos"
          accion={puedeOperar && <Boton onClick={() => { setFr({ id: null, id_concepto: 0, monto: "", desde: "", hasta: "", nota: "" }); setError(null); setVentana("recurrente"); }}>Agregar</Boton>}
        >
          <p className="text-xs text-gray-500 mb-2">Se incluyen solos en cada liquidacion mientras esten vigentes (asignaciones, cuota sindical, APV, retencion judicial, etc.).</p>
          <table className="w-full text-xs">
            <tbody>
              {recurrentes.length === 0 && <tr><td className="py-3 text-center text-gray-500">Sin haberes ni descuentos fijos.</td></tr>}
              {recurrentes.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="py-1.5">{conNombre.get(r.id_concepto)}{r.nota ? <span className="text-gray-500"> · {r.nota}</span> : null}</td>
                  <td className="py-1.5 text-right tabular-nums">{importe(r.monto, moneda)}</td>
                  <td className="py-1.5 pl-3 text-gray-600">{r.desde ? `desde ${fecha(r.desde)}` : ""} {r.hasta ? `hasta ${fecha(r.hasta)}` : ""}</td>
                  <td className="py-1.5 text-right">
                    {puedeOperar && (
                      <>
                        <button className="text-verde underline mr-3" onClick={() => { setFr({ id: r.id, id_concepto: r.id_concepto, monto: txt(r.monto), desde: r.desde ?? "", hasta: r.hasta ?? "", nota: r.nota ?? "" }); setError(null); setVentana("recurrente"); }}>Modificar</button>
                        <button className="text-red-700 underline" onClick={() => ejecutar(() => eliminarItemRecurrente(persona.id, r.id))}>Quitar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}

      {/* Novedades del mes */}
      {!honorarios && (
        <Seccion
          titulo={persona.clase === "Obra" ? "Novedades del mes: horas extra, jornales y bonos de obra" : "Novedades del mes: horas extra y bonos"}
          accion={puedeOperar && <Boton onClick={() => { setFn({ id: null, periodo: hoyISO().slice(0, 7), id_concepto: 0, cantidad: "", monto: "", id_proyecto: "", nota: "" }); setError(null); setVentana("novedad"); }}>Agregar</Boton>}
        >
          <table className="w-full text-xs">
            <tbody>
              {novedades.length === 0 && <tr><td className="py-3 text-center text-gray-500">Sin novedades en los ultimos 12 meses.</td></tr>}
              {novedades.map((n) => (
                <tr key={n.id} className="border-t border-gray-100">
                  <td className="py-1.5 capitalize">{nombrePeriodo(n.periodo)}</td>
                  <td className="py-1.5">{conNombre.get(n.id_concepto)}{n.cantidad != null ? ` (${n.cantidad})` : ""}{n.id_proyecto ? ` · ${pNombre.get(n.id_proyecto) ?? "proyecto"}` : ""}{n.nota ? <span className="text-gray-500"> · {n.nota}</span> : null}</td>
                  <td className="py-1.5 text-right tabular-nums">{importe(n.monto, moneda)}</td>
                  <td className="py-1.5 text-right">
                    {puedeOperar && (
                      <>
                        <button className="text-verde underline mr-3" onClick={() => { setFn({ id: n.id, periodo: n.periodo.slice(0, 7), id_concepto: n.id_concepto, cantidad: txt(n.cantidad), monto: txt(n.monto), id_proyecto: n.id_proyecto ? String(n.id_proyecto) : "", nota: n.nota ?? "" }); setError(null); setVentana("novedad"); }}>Modificar</button>
                        <button className="text-red-700 underline" onClick={() => ejecutar(() => eliminarNovedad(persona.id, n.id))}>Quitar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}

      {/* Anticipos */}
      <Seccion
        titulo="Anticipos, prestamos y descuentos"
        accion={puedeOperar && <Boton onClick={() => { setFa({ tipo: "Anticipo de sueldo", fecha: hoyISO(), concepto: "", monto_total: "", cuotas: "1", desde_periodo: hoyISO().slice(0, 7), nota: "" }); setError(null); setVentana("anticipo"); }}>Registrar</Boton>}
      >
        <table className="w-full text-xs">
          <thead className="text-left text-gray-500">
            <tr>
              <th scope="col" className="py-1 pr-3">Tipo</th>
              <th scope="col" className="py-1 pr-3 text-right">Monto</th>
              <th scope="col" className="py-1 pr-3">Cuotas</th>
              <th scope="col" className="py-1 pr-3">Desde</th>
              <th scope="col" className="py-1 pr-3 text-right">Descontado</th>
              <th scope="col" className="py-1 pr-3 text-right">Saldo</th>
              <th scope="col" className="py-1 pr-3">Estado</th>
              <th scope="col" className="py-1" />
            </tr>
          </thead>
          <tbody>
            {anticipos.length === 0 && <tr><td colSpan={8} className="py-3 text-center text-gray-500">Sin anticipos ni descuentos.</td></tr>}
            {anticipos.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-3">{a.tipo}{a.concepto ? <span className="text-gray-500"> · {a.concepto}</span> : null}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{importe(a.monto_total, moneda)}</td>
                <td className="py-1.5 pr-3">{a.cuotas} de {importe(a.monto_cuota, moneda)}</td>
                <td className="py-1.5 pr-3 capitalize">{nombrePeriodo(a.desde_periodo)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{importe(a.monto_descontado, moneda)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{importe(a.monto_total - a.monto_descontado, moneda)}</td>
                <td className="py-1.5 pr-3">{a.estado}</td>
                <td className="py-1.5 text-right">
                  {puedeOperar && a.estado === "Vigente" && (
                    <button className="text-red-700 underline" onClick={() => ejecutar(() => anularAnticipo(persona.id, a.id))}>Anular</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ventana === null && <div className="mt-2"><Alerta error={error} /></div>}
      </Seccion>

      {/* Liquidaciones */}
      <Seccion titulo={honorarios ? "Boletas de honorarios" : "Liquidaciones de sueldo"}>
        <table className="w-full text-xs">
          <tbody>
            {liquidaciones.length === 0 && <tr><td className="py-3 text-center text-gray-500">Aun no se emite ninguna. Se generan en Liquidaciones y honorarios.</td></tr>}
            {liquidaciones.map((l) => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="py-1.5 capitalize">{nombrePeriodo(l.periodo)}</td>
                <td className="py-1.5">
                  <Link href={`/rrhh/liquidaciones/${l.id}`} className="text-verde underline">{folioLiquidacion(l.tipo, l.id)}</Link>
                </td>
                <td className="py-1.5"><span className={`px-2 py-0.5 rounded text-[11px] ${COLOR_ESTADO_LIQ[l.estado] ?? ""}`}>{l.estado}</span></td>
                <td className="py-1.5 text-right tabular-nums">{importe(l.liquido, l.moneda ?? moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      {/* Ventanas */}
      {ventana === "persona" && (
        <Ventana titulo="Modificar persona" subtitulo={persona.razon_social} onCerrar={cerrar} ancho="max-w-4xl">
          <div className="space-y-3">
            <FormularioPersona form={fp} setForm={setFp} paises={[pais]} esAdminGeneral={false} edicion />
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => actualizarPersona(persona.id, persona.id_entidad, fp), cerrar)}>{pendiente ? "Grabando..." : "Grabar"}</Boton>
              <Boton onClick={cerrar}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}

      {ventana === "contrato" && (
        <Ventana titulo={idContrato ? "Modificar contrato" : "Nuevo contrato"} subtitulo={persona.razon_social} onCerrar={cerrar} ancho="max-w-4xl">
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <Selector label="Tipo *" value={fc.tipo} onChange={(v) => setC("tipo", v)} opciones={honorarios ? ["Honorarios"] : TIPOS_CONTRATO.filter((t) => t !== "Honorarios")} />
              <Campo label="Inicio *" type="date" value={fc.fecha_inicio} onChange={(v) => setC("fecha_inicio", v)} />
              <Campo label="Termino" type="date" value={fc.fecha_fin} onChange={(v) => setC("fecha_fin", v)} />
              <Selector label="Estado" value={fc.estado} onChange={(v) => setC("estado", v)} opciones={["Vigente", "Terminado", "Anulado"]} />
              <div className="md:col-span-2"><Campo label="Descripcion" value={fc.descripcion} onChange={(v) => setC("descripcion", v)} placeholder="Ej: anexo de reajuste, cambio de cargo" /></div>
            </div>
            {esHon ? (
              <div className="grid md:grid-cols-3 gap-3">
                <Campo label={`Honorario mensual bruto (${moneda}) *`} type="number" value={txt(fc.monto_honorario)} onChange={(v) => setC("monto_honorario", num(v))} />
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-3">
                  <Campo label={`Sueldo base mensual (${moneda}) *`} type="number" value={txt(fc.sueldo_base)} onChange={(v) => setC("sueldo_base", num(v))} />
                  <Campo label={`Valor hora (${moneda})`} type="number" value={txt(fc.valor_hora)} onChange={(v) => setC("valor_hora", num(v))} />
                  <Campo label="Horas semanales" type="number" value={txt(fc.jornada_horas)} onChange={(v) => setC("jornada_horas", num(v))} />
                  <Selector label="Gratificacion" value={fc.gratificacion} onChange={(v) => setC("gratificacion", v)} opciones={GRATIFICACIONES} />
                  {fc.gratificacion === "Garantizada" && <Campo label={`Gratificacion mensual (${moneda})`} type="number" value={txt(fc.gratificacion_monto)} onChange={(v) => setC("gratificacion_monto", num(v))} />}
                  <Campo label={`Colacion (${moneda})`} type="number" value={txt(fc.colacion)} onChange={(v) => setC("colacion", num(v))} />
                  <Campo label={`Movilizacion (${moneda})`} type="number" value={txt(fc.movilizacion)} onChange={(v) => setC("movilizacion", num(v))} />
                </div>
                <fieldset className="grid md:grid-cols-3 gap-3 border-t border-gray-200 pt-3">
                  <legend className="text-xs font-semibold text-gray-600 pr-2">Leyes sociales</legend>
                  <Selector label={persona.id_pais === 1 ? "AFP" : "AFP u ONP"} value={fc.id_prevision ?? ""} vacia="-- sin definir --" onChange={(v) => setC("id_prevision", v ? Number(v) : null)} opciones={[...de("AFP"), ...de("Previsional publico")]} />
                  <Selector label={persona.id_pais === 1 ? "Salud (Fonasa o Isapre)" : "Salud (EsSalud o EPS)"} value={fc.id_salud ?? ""} vacia="-- sin definir --" onChange={(v) => setC("id_salud", v ? Number(v) : null)} opciones={de("Salud")} />
                  {persona.id_pais === 1 && <Campo label="Plan Isapre (UF)" type="number" value={txt(fc.salud_plan_uf)} onChange={(v) => setC("salud_plan_uf", num(v))} />}
                  {persona.id_pais === 1 && <Selector label="Mutual (accidentes del trabajo)" value={fc.id_mutual ?? ""} vacia="-- sin definir --" onChange={(v) => setC("id_mutual", v ? Number(v) : null)} opciones={de("Mutual")} />}
                  {persona.id_pais === 1 && <Campo label="Tasa adicional mutual (%)" type="number" value={txt(fc.tasa_mutual_extra)} onChange={(v) => setC("tasa_mutual_extra", num(v))} />}
                  {persona.id_pais === 1 && (
                    <label className="text-sm flex items-center gap-2 mt-6">
                      <input type="checkbox" checked={fc.seguro_cesantia} onChange={(e) => setC("seguro_cesantia", e.target.checked)} />
                      Cotiza seguro de cesantia
                    </label>
                  )}
                  <label className="text-sm flex items-center gap-2 mt-6">
                    <input type="checkbox" checked={fc.pensionado} onChange={(e) => setC("pensionado", e.target.checked)} />
                    Pensionado
                  </label>
                </fieldset>
              </>
            )}
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarContrato(persona.id, idContrato, moneda, fc), cerrar)}>{pendiente ? "Grabando..." : "Grabar"}</Boton>
              <Boton onClick={cerrar}>Cancelar</Boton>
            </div>
            {fc.estado === "Vigente" && vigente && vigente.id !== idContrato && (
              <p className="text-xs text-gray-500">Al grabar, el contrato vigente actual termina el dia anterior al inicio de este.</p>
            )}
          </div>
        </Ventana>
      )}

      {ventana === "recurrente" && (
        <Ventana titulo="Haber o descuento fijo" subtitulo={persona.razon_social} onCerrar={cerrar} ancho="max-w-xl">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Selector label="Concepto *" value={fr.id_concepto || ""} vacia="-- elija --" onChange={(v) => setFr({ ...fr, id_concepto: Number(v) })} opciones={conceptos.filter((c) => !c.sistema).map((c) => ({ v: c.id, t: `${c.tipo}: ${c.nombre}` }))} />
              </div>
              <Campo label={`Monto mensual (${moneda}) *`} type="number" value={fr.monto} onChange={(v) => setFr({ ...fr, monto: v })} />
              <Campo label="Nota" value={fr.nota} onChange={(v) => setFr({ ...fr, nota: v })} />
              <Campo label="Desde" type="date" value={fr.desde} onChange={(v) => setFr({ ...fr, desde: v })} />
              <Campo label="Hasta" type="date" value={fr.hasta} onChange={(v) => setFr({ ...fr, hasta: v })} />
            </div>
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarItemRecurrente(persona.id, fr.id, { id_concepto: fr.id_concepto, monto: Number(fr.monto), desde: fr.desde, hasta: fr.hasta, nota: fr.nota }), cerrar)}>Grabar</Boton>
              <Boton onClick={cerrar}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}

      {ventana === "novedad" && (
        <Ventana titulo="Novedad del mes" subtitulo={persona.razon_social} onCerrar={cerrar} ancho="max-w-xl">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Mes *" type="month" value={fn.periodo} onChange={(v) => setFn({ ...fn, periodo: v })} />
              <Selector label="Concepto *" value={fn.id_concepto || ""} vacia="-- elija --" onChange={(v) => setFn({ ...fn, id_concepto: Number(v) })} opciones={conceptos.filter((c) => !c.sistema).map((c) => ({ v: c.id, t: `${c.tipo}: ${c.nombre}` }))} />
              <Campo label="Cantidad (horas, dias)" type="number" value={fn.cantidad} onChange={(v) => setFn({ ...fn, cantidad: v })} />
              <Campo label={`Monto (${moneda}) *`} type="number" value={fn.monto} onChange={(v) => setFn({ ...fn, monto: v })} />
              <Selector label="Proyecto de obra" value={fn.id_proyecto} vacia="-- ninguno --" onChange={(v) => setFn({ ...fn, id_proyecto: v })} opciones={proyectos.map((p) => ({ v: p.id, t: p.texto }))} />
              <Campo label="Nota" value={fn.nota} onChange={(v) => setFn({ ...fn, nota: v })} />
            </div>
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarNovedad(persona.id, fn.id, { periodo: fn.periodo, id_concepto: fn.id_concepto, cantidad: num(fn.cantidad), monto: Number(fn.monto), id_proyecto: fn.id_proyecto ? Number(fn.id_proyecto) : null, nota: fn.nota }), cerrar)}>Grabar</Boton>
              <Boton onClick={cerrar}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}

      {ventana === "anticipo" && (
        <Ventana titulo="Anticipo, prestamo o descuento" subtitulo={persona.razon_social} onCerrar={cerrar} ancho="max-w-xl">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Selector label="Tipo *" value={fa.tipo} onChange={(v) => setFa({ ...fa, tipo: v })} opciones={TIPOS_ANTICIPO} />
              <Campo label="Fecha" type="date" value={fa.fecha} onChange={(v) => setFa({ ...fa, fecha: v })} />
              <Campo label={`Monto total (${moneda}) *`} type="number" value={fa.monto_total} onChange={(v) => setFa({ ...fa, monto_total: v })} />
              <Campo label="Cuotas *" type="number" value={fa.cuotas} onChange={(v) => setFa({ ...fa, cuotas: v })} />
              <Campo label="Se descuenta desde *" type="month" value={fa.desde_periodo} onChange={(v) => setFa({ ...fa, desde_periodo: v })} />
              <Campo label="Concepto" value={fa.concepto} onChange={(v) => setFa({ ...fa, concepto: v })} />
            </div>
            <p className="text-xs text-gray-500">La cuota se descuenta sola en cada liquidacion, desde el mes indicado, hasta saldar el monto.</p>
            <Alerta error={error} />
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarAnticipo(persona.id, { tipo: fa.tipo, fecha: fa.fecha, concepto: fa.concepto, monto_total: Number(fa.monto_total), cuotas: Number(fa.cuotas), desde_periodo: fa.desde_periodo, nota: fa.nota }), cerrar)}>Grabar</Boton>
              <Boton onClick={cerrar}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}
    </div>
  );
}
