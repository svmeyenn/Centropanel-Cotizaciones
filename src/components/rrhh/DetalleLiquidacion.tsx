"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import { Campo, Selector } from "@/components/rrhh/FormularioPersona";
import { fecha, hoyISO, importe, porcentaje } from "@/lib/formato";
import { COLOR_ESTADO_LIQ, MEDIOS_PAGO, folioLiquidacion, nombrePeriodo } from "@/lib/rrhh";
import {
  anularLiquidacion,
  aprobarLiquidacion,
  guardarDatosLiquidacion,
  pagarLiquidacion,
  recalcularLiquidacion,
} from "@/app/rrhh/acciones";

interface Liq {
  id: number;
  id_pais: number;
  id_personal: number;
  periodo: string;
  tipo: string;
  estado: string;
  dias_trabajados: number;
  moneda: string;
  boleta_numero: string;
  boleta_fecha: string;
  boleta_bruto: number | null;
  uf: number | null;
  utm: number | null;
  imponible: number;
  total_haberes: number;
  total_descuentos: number;
  liquido: number;
  aportes_empleador: number;
  costo_empleador: number;
  fecha_pago: string;
  medio_pago: string;
  nota: string;
  motivo_anulacion: string;
  calculada: boolean;
}
interface Linea {
  id: number;
  descripcion: string;
  tipo: string;
  imponible: boolean;
  cantidad: number | null;
  base: number | null;
  tasa: number | null;
  monto: number;
}

const Boton = ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-40">
    {children}
  </button>
);

export default function DetalleLiquidacion({
  liq,
  persona,
  lineas,
  imputaciones,
  puedeOperar,
  puedeAprobar,
  puedeAdministrar,
}: {
  liq: Liq;
  persona: { nombre: string; rut: string; cargo: string; cuenta: string };
  lineas: Linea[];
  imputaciones: { centro: string; proyecto: string | null; porcentaje: number; monto: number }[];
  puedeOperar: boolean;
  puedeAprobar: boolean;
  puedeAdministrar: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ventana, setVentana] = useState<null | "datos" | "pagar" | "anular">(null);
  const [datos, setDatos] = useState({
    dias_trabajados: String(liq.dias_trabajados),
    boleta_numero: liq.boleta_numero,
    boleta_fecha: liq.boleta_fecha,
    boleta_bruto: liq.boleta_bruto != null ? String(liq.boleta_bruto) : "",
    nota: liq.nota,
  });
  const [pago, setPago] = useState({ fecha: hoyISO(), medio: "Transferencia" });
  const [motivo, setMotivo] = useState("");

  const honorarios = liq.tipo === "Honorarios";
  const borrador = liq.estado === "Borrador";
  const m = (n: number) => importe(n, liq.moneda);
  const grupos = [
    ["Haber", honorarios ? "Honorarios" : "Haberes"],
    ["Descuento", "Descuentos"],
    ["Aporte", "Aportes del empleador (no se descuentan al trabajador)"],
  ] as const;

  function ejecutar(fn: () => Promise<{ ok: true } | { error: string }>) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        setVentana(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs ${COLOR_ESTADO_LIQ[liq.estado] ?? ""}`}>{liq.estado}</span>
        {puedeOperar && borrador && (
          <>
            <Boton onClick={() => { setError(null); setVentana("datos"); }}>{honorarios ? "Datos de la boleta" : "Dias trabajados"}</Boton>
            <Boton disabled={pendiente} onClick={() => ejecutar(() => recalcularLiquidacion(liq.id))}>Recalcular</Boton>
          </>
        )}
        {puedeAprobar && borrador && (
          <Boton disabled={pendiente || !liq.calculada} onClick={() => ejecutar(() => aprobarLiquidacion(liq.id))}>Aprobar</Boton>
        )}
        {puedeAprobar && liq.estado === "Aprobada" && <Boton onClick={() => { setError(null); setVentana("pagar"); }}>Registrar pago</Boton>}
        {((borrador && puedeOperar) || (puedeAdministrar && (liq.estado === "Aprobada" || liq.estado === "Pagada"))) && (
          <Boton onClick={() => { setError(null); setMotivo(""); setVentana("anular"); }}>Anular</Boton>
        )}
        <Boton onClick={() => window.print()}>Imprimir</Boton>
      </div>
      {error && ventana === null && <div role="alert" className="print:hidden bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}

      <article className="bg-white border border-gray-300 rounded p-6 space-y-5 print:border-0 print:p-0">
        <header className="flex flex-wrap justify-between gap-4 border-b border-gray-300 pb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{honorarios ? "Comprobante de pago de honorarios" : "Liquidacion de sueldo"}</div>
            <h1 className="text-lg font-semibold capitalize">{nombrePeriodo(liq.periodo)}</h1>
            <div className="text-xs text-gray-500">{folioLiquidacion(liq.tipo, liq.id)}</div>
          </div>
          <div className="text-sm text-right">
            <div className="font-semibold">{persona.nombre}</div>
            <div className="text-gray-600">{persona.rut}{persona.cargo ? ` · ${persona.cargo}` : ""}</div>
            <div className="text-xs text-gray-500">{liq.dias_trabajados} dias trabajados</div>
          </div>
        </header>

        {honorarios && (
          <div className="text-xs text-gray-600 grid sm:grid-cols-3 gap-2">
            <div>Boleta N°: <strong>{liq.boleta_numero || "sin registrar"}</strong></div>
            <div>Fecha de la boleta: <strong>{fecha(liq.boleta_fecha) || "—"}</strong></div>
            <div>Bruto boleta: <strong>{liq.boleta_bruto != null ? m(liq.boleta_bruto) : "segun contrato"}</strong></div>
          </div>
        )}

        {!liq.calculada && <p className="text-sm text-amber-700">Esta liquidacion aun no se calcula. Revise el mensaje al recalcular.</p>}

        {grupos.map(([tipo, titulo]) => {
          const filas = lineas.filter((l) => l.tipo === tipo);
          if (filas.length === 0) return null;
          return (
            <section key={tipo}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-verde mb-1">{titulo}</h2>
              <table className="w-full text-xs">
                <tbody>
                  {filas.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="py-1.5">
                        {l.descripcion}
                        {tipo === "Haber" && !honorarios && <span className="ml-2 text-[10px] text-gray-400">{l.imponible ? "imponible" : "no imponible"}</span>}
                        {l.tasa != null && l.base != null && <span className="ml-2 text-gray-400">{porcentaje(l.tasa)}% de {m(l.base)}</span>}
                      </td>
                      <td className="py-1.5 text-right tabular-nums w-40">{m(l.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}

        <section className="border-t-2 border-gray-300 pt-3 space-y-1 text-sm">
          {!honorarios && (
            <div className="flex justify-between"><span>Renta imponible</span><span className="tabular-nums">{m(liq.imponible)}</span></div>
          )}
          <div className="flex justify-between"><span>Total {honorarios ? "bruto" : "haberes"}</span><span className="tabular-nums">{m(liq.total_haberes)}</span></div>
          <div className="flex justify-between"><span>Total descuentos</span><span className="tabular-nums">{m(liq.total_descuentos)}</span></div>
          <div className="flex justify-between text-base font-semibold border-t border-gray-300 pt-2"><span>Liquido a pagar</span><span className="tabular-nums">{m(liq.liquido)}</span></div>
          {persona.cuenta && <div className="text-xs text-gray-500">Cuenta: {persona.cuenta}</div>}
          {liq.fecha_pago && <div className="text-xs text-gray-500">Pagada el {fecha(liq.fecha_pago)} por {liq.medio_pago.toLowerCase()}.</div>}
          {liq.estado === "Anulada" && <div className="text-xs text-red-700">Anulada: {liq.motivo_anulacion}</div>}
        </section>

        <section className="print:hidden border-t border-gray-200 pt-3 text-xs text-gray-600 space-y-1">
          <div className="flex justify-between"><span>Aportes del empleador</span><span className="tabular-nums">{m(liq.aportes_empleador)}</span></div>
          <div className="flex justify-between font-semibold"><span>Costo total para la empresa</span><span className="tabular-nums">{m(liq.costo_empleador)}</span></div>
          {(liq.uf || liq.utm) && (
            <div className="text-gray-400">Valores usados: {liq.uf ? `UF ${liq.uf}` : ""} {liq.utm ? `UTM ${liq.utm}` : ""}</div>
          )}
          {imputaciones.length > 0 && (
            <div className="pt-2">
              <div className="font-semibold text-gray-700 mb-1">Imputacion del costo</div>
              {imputaciones.map((i, k) => (
                <div key={k} className="flex justify-between">
                  <span>{i.centro}{i.proyecto ? ` · ${i.proyecto}` : ""} ({porcentaje(i.porcentaje)}%)</span>
                  <span className="tabular-nums">{m(i.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </article>

      {ventana === "datos" && (
        <Ventana titulo={honorarios ? "Datos de la boleta de honorarios" : "Dias trabajados"} subtitulo={persona.nombre} onCerrar={() => setVentana(null)} ancho="max-w-xl">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Dias trabajados" type="number" value={datos.dias_trabajados} onChange={(v) => setDatos({ ...datos, dias_trabajados: v })} />
              {honorarios && (
                <>
                  <Campo label="N° de la boleta" value={datos.boleta_numero} onChange={(v) => setDatos({ ...datos, boleta_numero: v })} />
                  <Campo label="Fecha de la boleta" type="date" value={datos.boleta_fecha} onChange={(v) => setDatos({ ...datos, boleta_fecha: v })} />
                  <Campo label={`Bruto de la boleta (${liq.moneda})`} type="number" value={datos.boleta_bruto} onChange={(v) => setDatos({ ...datos, boleta_bruto: v })} />
                </>
              )}
              <div className="col-span-2"><Campo label="Nota" value={datos.nota} onChange={(v) => setDatos({ ...datos, nota: v })} /></div>
            </div>
            {honorarios && <p className="text-xs text-gray-500">La boleta la emite el trabajador en el SII o la SUNAT; aqui se registra su numero y monto, y el sistema calcula la retencion.</p>}
            {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => guardarDatosLiquidacion(liq.id, { dias_trabajados: Number(datos.dias_trabajados), boleta_numero: datos.boleta_numero, boleta_fecha: datos.boleta_fecha, boleta_bruto: datos.boleta_bruto.trim() ? Number(datos.boleta_bruto) : null, nota: datos.nota }))}>Grabar y recalcular</Boton>
              <Boton onClick={() => setVentana(null)}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}

      {ventana === "pagar" && (
        <Ventana titulo="Registrar pago" subtitulo={`${persona.nombre} · ${m(liq.liquido)}`} onCerrar={() => setVentana(null)} ancho="max-w-md">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha de pago *" type="date" value={pago.fecha} onChange={(v) => setPago({ ...pago, fecha: v })} />
              <Selector label="Medio de pago *" value={pago.medio} onChange={(v) => setPago({ ...pago, medio: v })} opciones={MEDIOS_PAGO} />
            </div>
            {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => pagarLiquidacion(liq.id, pago.fecha, pago.medio))}>Registrar pago</Boton>
              <Boton onClick={() => setVentana(null)}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}

      {ventana === "anular" && (
        <Ventana titulo="Anular liquidacion" subtitulo={folioLiquidacion(liq.tipo, liq.id)} onCerrar={() => setVentana(null)} ancho="max-w-md">
          <div className="space-y-3">
            <Campo label="Motivo *" value={motivo} onChange={setMotivo} />
            {liq.estado !== "Borrador" && <p className="text-xs text-gray-500">Las cuotas de anticipo descontadas vuelven a quedar pendientes.</p>}
            {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
            <div className="flex gap-2">
              <Boton disabled={pendiente} onClick={() => ejecutar(() => anularLiquidacion(liq.id, motivo))}>Anular</Boton>
              <Boton onClick={() => setVentana(null)}>Cancelar</Boton>
            </div>
          </div>
        </Ventana>
      )}
    </div>
  );
}
