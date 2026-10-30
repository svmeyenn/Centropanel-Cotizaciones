"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FormularioEgreso from "@/components/finanzas/FormularioEgreso";
import Ventana from "@/components/Ventana";
import { quitarCostoTransporte, registrarCostoTransporte } from "@/app/pedidos/acciones";
import { importe, leerMontoLibre } from "@/lib/formato";
import type { Categoria, Cuenta, Interlocutor, Proyecto } from "@/lib/finanzas/tipos";

export interface CostoTransporte {
  id: number;
  monto: number;
  comentario: string;
  // El egreso con la factura, cuando ya se cargo.
  idMov: number | null;
  aprobacion: string | null;
  estadoPago: string | null;
}

const BTN = "border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";
const BTN_VERDE = "bg-verde text-white text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";

function estadoDe(c: CostoTransporte): string {
  if (c.idMov == null) return "sin factura";
  if (c.aprobacion === "Aprobado") return c.estadoPago === "Pagado" ? "factura aprobada y pagada" : "factura aprobada";
  if (c.aprobacion === "Rechazado") return "factura rechazada";
  return "factura enviada, por aprobar";
}

// El costo del transporte de un pedido. Se registra el valor apenas se conoce --entra al margen real como estimado--, y
// la factura se carga y se envia a pago despues, cuando se tiene el documento: ese egreso, una vez aprobado, reemplaza al
// valor estimado. Tambien se puede cargar la factura directo, si ya se la tiene.
export default function BotonFacturaTransporte({
  idPedido,
  numPedido,
  idProyecto,
  idCategoria,
  moneda,
  costos,
  formulario,
}: {
  idPedido: number;
  numPedido: string;
  idProyecto: number | null;
  idCategoria: number | null;
  moneda: string;
  costos: CostoTransporte[];
  // Solo quien puede solicitar gastos y tiene el pedido en un proyecto puede cargar la factura.
  formulario: { cuentas: Cuenta[]; proyectos: Proyecto[]; categorias: Categoria[]; interlocutores: Interlocutor[] } | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(false);
  const [monto, setMonto] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  // Factura en curso: de un costo ya registrado (id) o directa (sin id).
  const [factura, setFactura] = useState<{ costo: CostoTransporte | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const puedeFactura = formulario != null && idProyecto != null;

  function guardarValor() {
    const m = leerMontoLibre(monto);
    if (!Number.isFinite(m) || m <= 0) return setError("Ingrese el valor del transporte, con IVA incluido.");
    setError(null);
    empezar(async () => {
      const r = await registrarCostoTransporte(idPedido, m, comentario);
      if ("error" in r && r.error) return setError(r.error);
      setValor(false);
      setMonto("");
      setComentario("");
      setAviso("Costo registrado: ya cuenta en el margen real como estimado.");
      router.refresh();
    });
  }

  function quitar(c: CostoTransporte) {
    setAviso(null);
    empezar(async () => {
      const r = await quitarCostoTransporte(c.id, idPedido);
      if ("error" in r && r.error) return setAviso(r.error);
      router.refresh();
    });
  }

  return (
    <div className="pt-1 space-y-1">
      {costos.length > 0 && (
        <ul className="space-y-0.5">
          {costos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold tabular-nums">Transporte {importe(c.monto, moneda)}</span>
              <span className={c.idMov == null ? "text-amber-700" : "text-gray-600"}>{estadoDe(c)}</span>
              {c.comentario && <span className="text-gray-500 truncate max-w-[16rem]" title={c.comentario}>{c.comentario}</span>}
              {c.idMov == null && puedeFactura && (
                <button type="button" className={BTN_VERDE} disabled={pendiente} onClick={() => { setAviso(null); setFactura({ costo: c }); }}>
                  Cargar factura y enviar a pago
                </button>
              )}
              {c.idMov == null && (
                <button type="button" className={BTN} disabled={pendiente} onClick={() => quitar(c)}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN} onClick={() => { setAviso(null); setError(null); setValor(true); }}>
          Ingresar costo de transporte
        </button>
        {puedeFactura && (
          <button type="button" className={BTN} onClick={() => { setAviso(null); setFactura({ costo: null }); }}>
            Cargar factura de transporte
          </button>
        )}
        {aviso && <span className="text-[11px] text-green-800">{aviso}</span>}
      </div>

      {valor && (
        <Ventana titulo="Costo de transporte" subtitulo={`Pedido ${numPedido}: el valor ya cuenta en el margen real; la factura se carga despues`} onCerrar={() => setValor(false)} ancho="max-w-md">
          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="tr-monto" className="block text-xs font-semibold text-dorado-osc mb-0.5">Valor del transporte, con IVA incluido *</label>
              <input id="tr-monto" inputMode="decimal" className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" autoFocus />
            </div>
            <div>
              <label htmlFor="tr-com" className="block text-xs font-semibold text-dorado-osc mb-0.5">Detalle (opcional)</label>
              <input id="tr-com" className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Transportista, tramo, cotizacion..." />
            </div>
            {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN} disabled={pendiente} onClick={() => setValor(false)}>Cancelar</button>
              <button type="button" className={BTN_VERDE} disabled={pendiente} onClick={guardarValor}>{pendiente ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </Ventana>
      )}

      {factura && formulario && (
        <FormularioEgreso
          movimiento={null}
          inicial={{
            id_proyecto: idProyecto,
            id_categoria: idCategoria,
            comentario: factura.costo?.comentario || `Factura de transporte del pedido ${numPedido}`,
            monto: factura.costo?.monto,
            id_transporte: factura.costo?.id,
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
