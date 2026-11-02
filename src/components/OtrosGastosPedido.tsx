"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FormularioEgreso from "@/components/finanzas/FormularioEgreso";
import Ventana from "@/components/Ventana";
import { quitarOtroGasto, registrarOtroGasto } from "@/app/pedidos/acciones";
import { importe, leerMontoLibre } from "@/lib/formato";
import type { Categoria, Cuenta, Interlocutor, Proyecto } from "@/lib/finanzas/tipos";

export interface OtroGasto {
  id: number;
  concepto: string;
  monto: number;
  comentario: string;
  // El egreso con la factura, cuando ya se cargo.
  idMov: number | null;
  aprobacion: string | null;
  estadoPago: string | null;
}

const BTN = "border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";
const BTN_VERDE = "bg-verde text-white text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";
const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";

function estadoDe(g: OtroGasto): string {
  if (g.idMov == null) return "sin factura";
  if (g.aprobacion === "Aprobado") return g.estadoPago === "Pagado" ? "factura aprobada y pagada" : "factura aprobada";
  if (g.aprobacion === "Rechazado") return "factura rechazada";
  return "factura enviada, por aprobar";
}

// Otros gastos de un pedido que no son compras ni transporte --instalacion, comisiones, viaticos, lo que sea--. Se registra
// el valor apenas se conoce y entra al margen real como estimado; la factura se carga y se envia a pago despues, y ese egreso,
// una vez aprobado, reemplaza al valor estimado.
export default function OtrosGastosPedido({
  idPedido,
  numPedido,
  idProyecto,
  moneda,
  gastos,
  formulario,
}: {
  idPedido: number;
  numPedido: string;
  idProyecto: number | null;
  moneda: string;
  gastos: OtroGasto[];
  // Solo quien puede solicitar gastos y tiene el pedido en un proyecto puede cargar la factura.
  formulario: { cuentas: Cuenta[]; proyectos: Proyecto[]; categorias: Categoria[]; interlocutores: Interlocutor[] } | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [factura, setFactura] = useState<OtroGasto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const puedeFactura = formulario != null && idProyecto != null;

  function guardar() {
    const m = leerMontoLibre(monto);
    if (!concepto.trim()) return setError("Indique el concepto del gasto.");
    if (!Number.isFinite(m) || m <= 0) return setError("Ingrese el valor del gasto, con IVA incluido.");
    setError(null);
    empezar(async () => {
      const r = await registrarOtroGasto(idPedido, concepto, m, comentario);
      if ("error" in r && r.error) return setError(r.error);
      setAbierto(false);
      setConcepto("");
      setMonto("");
      setComentario("");
      setAviso("Gasto registrado: ya cuenta en el margen real como estimado.");
      router.refresh();
    });
  }

  function quitar(g: OtroGasto) {
    setAviso(null);
    empezar(async () => {
      const r = await quitarOtroGasto(g.id, idPedido);
      if ("error" in r && r.error) return setAviso(r.error);
      router.refresh();
    });
  }

  return (
    <div className="pt-1 space-y-1">
      {gastos.length > 0 && (
        <ul className="space-y-0.5">
          {gastos.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold tabular-nums">{g.concepto} {importe(g.monto, moneda)}</span>
              <span className={g.idMov == null ? "text-amber-700" : "text-gray-600"}>{estadoDe(g)}</span>
              {g.comentario && <span className="text-gray-500 truncate max-w-[16rem]" title={g.comentario}>{g.comentario}</span>}
              {g.idMov == null && puedeFactura && (
                <button type="button" className={BTN_VERDE} disabled={pendiente} onClick={() => { setAviso(null); setFactura(g); }}>
                  Cargar factura y enviar a pago
                </button>
              )}
              {g.idMov == null && (
                <button type="button" className={BTN} disabled={pendiente} onClick={() => quitar(g)}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN} onClick={() => { setAviso(null); setError(null); setAbierto(true); }}>
          Asociar otro gasto
        </button>
        {aviso && <span className="text-[11px] text-green-800">{aviso}</span>}
      </div>

      {abierto && (
        <Ventana titulo="Otro gasto del pedido" subtitulo={`Pedido ${numPedido}: el valor ya cuenta en el margen real; la factura se carga despues`} onCerrar={() => setAbierto(false)} ancho="max-w-md">
          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="og-concepto" className="block text-xs font-semibold text-dorado-osc mb-0.5">Concepto *</label>
              <input id="og-concepto" className={CAMPO} value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Instalacion, comision, viaticos..." maxLength={80} autoFocus />
            </div>
            <div>
              <label htmlFor="og-monto" className="block text-xs font-semibold text-dorado-osc mb-0.5">Valor, con IVA incluido *</label>
              <input id="og-monto" inputMode="decimal" className={CAMPO} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label htmlFor="og-com" className="block text-xs font-semibold text-dorado-osc mb-0.5">Detalle (opcional)</label>
              <input id="og-com" className={CAMPO} value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </div>
            {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN} disabled={pendiente} onClick={() => setAbierto(false)}>Cancelar</button>
              <button type="button" className={BTN_VERDE} disabled={pendiente} onClick={guardar}>{pendiente ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </Ventana>
      )}

      {factura && formulario && (
        <FormularioEgreso
          movimiento={null}
          inicial={{
            id_proyecto: idProyecto,
            comentario: `${factura.concepto}${factura.comentario ? `: ${factura.comentario}` : ""} - pedido ${numPedido}`,
            monto: factura.monto,
            id_gasto_pedido: factura.id,
          }}
          cuentas={formulario.cuentas}
          proyectos={formulario.proyectos}
          categorias={formulario.categorias}
          interlocutores={formulario.interlocutores}
          puedePagar={false}
          alCerrar={(mensaje) => {
            setFactura(null);
            if (mensaje) {
              setAviso("Factura cargada: entra al margen real cuando se apruebe.");
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}
