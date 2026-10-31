"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { guardarRetiroOC } from "@/app/transportistas/acciones";
import type { OpcionTransportista } from "@/lib/transportes";
import type { LineaCarga } from "@/lib/carga";
import CargaViaje from "@/components/transportes/CargaViaje";
import CotizarFlete from "@/components/transportes/CotizarFlete";

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full bg-white";
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

// En una orden con retiro, quien va a buscar la carga: Centro Panel con lo suyo o un transportista.
// Si la orden es con despacho, el proveedor entrega y aqui no hay nada que elegir.
export default function RetiroOC({
  idOC,
  inicial,
  transportistas,
  carga,
  cotizacion,
  puedeEditar,
}: {
  idOC: number;
  inicial: { idTransportista: number | null; idVehiculo: number | null };
  transportistas: OpcionTransportista[];
  carga: LineaCarga[];
  cotizacion: { origen: string; destino: string; fecha: string; existentes: { id: number; estado: string }[] };
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [propio, setPropio] = useState(inicial.idTransportista == null);
  const [idT, setIdT] = useState<number | null>(inicial.idTransportista);
  const [idV, setIdV] = useState<number | null>(inicial.idVehiculo);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const t = transportistas.find((x) => x.id === idT) ?? null;
  const cambio = (propio ? null : idT) !== inicial.idTransportista || (propio ? null : idV) !== inicial.idVehiculo;

  function guardar() {
    setError(null);
    setAviso(null);
    if (!propio && idT == null) {
      setError("Elija el transportista.");
      return;
    }
    empezar(async () => {
      const r = await guardarRetiroOC(idOC, propio ? null : idT, propio ? null : idV);
      if (r?.error) setError(r.error);
      else {
        setAviso("Retiro guardado.");
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="t-retiro" className="bg-white border border-gray-200 rounded p-3 space-y-3 mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="t-retiro" className="text-sm font-semibold text-verde">Quien retira la carga</h2>
        <Link href="/transportistas" className="text-xs text-verde underline">Administrar transportistas</Link>
      </div>
      <fieldset disabled={!puedeEditar} className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="sr-only">Quien retira</legend>
        <label className="text-sm flex items-start gap-2 max-w-xs">
          <input type="radio" name="retira" className="mt-1" checked={propio} onChange={() => setPropio(true)} />
          <span>
            <span className="font-semibold text-gray-900">Retiro propio</span>
            <span className="block text-xs text-gray-600">Va Centro Panel con sus propios medios.</span>
          </span>
        </label>
        <label className="text-sm flex items-start gap-2 max-w-xs">
          <input type="radio" name="retira" className="mt-1" checked={!propio} onChange={() => setPropio(false)} />
          <span>
            <span className="font-semibold text-gray-900">Transportista</span>
            <span className="block text-xs text-gray-600">Una empresa de transporte va a buscarla.</span>
          </span>
        </label>
      </fieldset>
      {!propio && (
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">Transportista</span>
            <select className={input} disabled={!puedeEditar} value={idT ?? ""} onChange={(e) => { setIdT(e.target.value ? Number(e.target.value) : null); setIdV(null); }}>
              <option value="">-- elija --</option>
              {transportistas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">Vehiculo</span>
            <select className={input} disabled={!puedeEditar || !t} value={idV ?? ""} onChange={(e) => setIdV(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin definir</option>
              {t?.vehiculos.map((x) => <option key={x.id} value={x.id}>{x.etiqueta}</option>)}
            </select>
          </label>
          {t && t.tarifas.length > 0 && (
            <div className="text-xs text-gray-600 self-end">
              Tarifas vigentes: {t.tarifas.slice(0, 3).map((x) => `${x.moneda} ${num(x.monto)} ${x.tipo_cobro.toLowerCase()}`).join(" · ")}
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-dorado-osc">CARGA A RETIRAR</h3>
        <CargaViaje lineas={carga} vehiculo={propio ? null : (t?.vehiculos.find((x) => x.id === idV) ?? null)} puedeCompletar={puedeEditar} />
      </div>
      <CotizarFlete
        idOc={idOC}
        origenInicial={cotizacion.origen}
        destinoInicial={cotizacion.destino}
        fechaInicial={cotizacion.fecha}
        lineas={carga}
        transportistas={transportistas}
        existentes={cotizacion.existentes}
        puedeEditar={puedeEditar}
      />
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{error}</div>}
      {aviso && <div role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-2">{aviso}</div>}
      {puedeEditar && (
        <button className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40" disabled={pendiente || !cambio} onClick={guardar}>
          {pendiente ? "Guardando..." : "Guardar retiro"}
        </button>
      )}
    </section>
  );
}
