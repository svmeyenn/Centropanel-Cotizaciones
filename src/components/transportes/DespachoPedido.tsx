"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MODALIDADES_PEDIDO, guardarDespachoPedido } from "@/app/transportistas/acciones";
import { registrarCostoTransporte } from "@/app/pedidos/acciones";
import type { OpcionTransportista } from "@/lib/transportes";

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full bg-white";
const BTN = "bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40";
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

const AYUDA: Record<string, string> = {
  "Despacho propio": "Lo lleva Centro Panel con sus propios medios.",
  "Retiro del cliente": "El cliente viene a buscar el pedido a la bodega.",
  Transportista: "Lo lleva una empresa de transporte externa.",
};

// Como sale el pedido. Siempre hay una respuesta: despacho propio, retiro del cliente o un transportista.
export default function DespachoPedido({
  idPedido,
  moneda,
  inicial,
  transportistas,
  puedeEditar,
  puedeRegistrarCosto,
}: {
  idPedido: number;
  moneda: string;
  inicial: { modalidad: string; idTransportista: number | null; idVehiculo: number | null; flete: number | null };
  transportistas: OpcionTransportista[];
  puedeEditar: boolean;
  puedeRegistrarCosto: boolean;
}) {
  const router = useRouter();
  const [modalidad, setModalidad] = useState(inicial.modalidad);
  const [idT, setIdT] = useState<number | null>(inicial.idTransportista);
  const [idV, setIdV] = useState<number | null>(inicial.idVehiculo);
  const [flete, setFlete] = useState(inicial.flete == null ? "" : String(inicial.flete).replace(".", ","));
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const t = transportistas.find((x) => x.id === idT) ?? null;
  const montoFlete = flete.trim() === "" ? null : Number(flete.replace(/\./g, "").replace(",", "."));
  // Primero las del vehiculo elegido, despues las generales del transportista.
  const tarifas = t
    ? [...t.tarifas.filter((x) => idV != null && x.id_vehiculo === idV), ...t.tarifas.filter((x) => x.id_vehiculo == null)]
    : [];
  const cambioInicial = modalidad !== inicial.modalidad || idT !== inicial.idTransportista || idV !== inicial.idVehiculo || (montoFlete ?? null) !== inicial.flete;

  function guardar() {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await guardarDespachoPedido(idPedido, { modalidad, idTransportista: idT, idVehiculo: idV, flete: montoFlete });
      if (r?.error) setError(r.error);
      else {
        setAviso("Despacho guardado.");
        router.refresh();
      }
    });
  }

  function comoCosto() {
    if (montoFlete == null || !(montoFlete > 0)) return;
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await registrarCostoTransporte(idPedido, montoFlete, `Flete ${t?.nombre ?? ""}`.trim());
      if (r?.error) setError(r.error);
      else {
        setAviso("Quedo registrado como costo de transporte del pedido (estimado, hasta cargar la factura).");
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="t-despacho" className="bg-white border border-gray-200 rounded p-3 space-y-3 mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="t-despacho" className="text-sm font-semibold text-verde">Despacho del pedido</h2>
        <Link href="/transportistas" className="text-xs text-verde underline">Administrar transportistas</Link>
      </div>
      <fieldset disabled={!puedeEditar} className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="sr-only">Modalidad</legend>
        {MODALIDADES_PEDIDO.map((m) => (
          <label key={m} className="text-sm flex items-start gap-2 max-w-xs">
            <input type="radio" name="modalidad_despacho" className="mt-1" checked={modalidad === m} onChange={() => setModalidad(m)} />
            <span>
              <span className="font-semibold text-gray-900">{m}</span>
              <span className="block text-xs text-gray-600">{AYUDA[m]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {modalidad === "Transportista" && (
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">Transportista</span>
            <select
              className={input}
              disabled={!puedeEditar}
              value={idT ?? ""}
              onChange={(e) => {
                setIdT(e.target.value ? Number(e.target.value) : null);
                setIdV(null);
              }}
            >
              <option value="">-- elija --</option>
              {transportistas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
            {transportistas.length === 0 && <span className="block text-[11px] text-amber-700 mt-0.5">No hay transportistas activos en este mercado.</span>}
          </label>
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">Vehiculo</span>
            <select className={input} disabled={!puedeEditar || !t} value={idV ?? ""} onChange={(e) => setIdV(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin definir</option>
              {t?.vehiculos.map((x) => <option key={x.id} value={x.id}>{x.etiqueta}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">Flete estimado ({moneda})</span>
            <input inputMode="decimal" className={input} disabled={!puedeEditar} value={flete} onChange={(e) => setFlete(e.target.value)} />
          </label>
          {t && (
            <div className="sm:col-span-3 text-xs">
              <div className="text-dorado-osc font-semibold mb-1">Tarifas vigentes de {t.nombre}</div>
              {tarifas.length === 0 ? (
                <p className="text-gray-500">No tiene tarifas vigentes: ingrese el flete a mano.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {tarifas.map((x) => (
                    <li key={x.id}>
                      <button
                        type="button"
                        disabled={!puedeEditar}
                        onClick={() => setFlete(String(x.monto).replace(".", ","))}
                        className="border border-gray-300 rounded px-2 py-1 bg-white hover:bg-crema text-left disabled:opacity-60"
                      >
                        <span className="font-semibold">{x.moneda} {num(x.monto)}</span> · {x.tipo_cobro}
                        <span className="block text-gray-500">
                          {x.id_vehiculo == null ? "General" : "Del vehiculo"}
                          {x.origen || x.destino ? ` · ${x.origen || "cualquier origen"} → ${x.destino || "cualquier destino"}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{error}</div>}
      {aviso && <div role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-2">{aviso}</div>}

      {puedeEditar && (
        <div className="flex flex-wrap gap-2">
          <button className={BTN} disabled={pendiente || !cambioInicial} onClick={guardar}>
            {pendiente ? "Guardando..." : "Guardar despacho"}
          </button>
          {puedeRegistrarCosto && modalidad === "Transportista" && inicial.modalidad === "Transportista" && !cambioInicial && montoFlete != null && montoFlete > 0 && (
            <button className="border border-gray-300 bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded disabled:opacity-40" disabled={pendiente} onClick={comoCosto}>
              Registrar el flete como costo de transporte
            </button>
          )}
        </div>
      )}
    </section>
  );
}
