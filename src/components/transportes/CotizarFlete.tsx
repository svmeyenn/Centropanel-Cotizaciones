"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import { crearCotizacionFlete } from "@/app/transportistas/cotizar/acciones";
import { ajusteVehiculo, folioFlete, resumirCarga, type LineaCarga } from "@/lib/carga";
import type { OpcionTransportista } from "@/lib/transportes";

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full bg-white";

// Pedir precio de flete a varios transportistas a la vez. Cada uno recibe la misma carga, y las respuestas se
// comparan lado a lado en la cotizacion.
export default function CotizarFlete({
  idPedido,
  idOc,
  origenInicial,
  destinoInicial,
  fechaInicial,
  lineas,
  transportistas,
  existentes,
  puedeEditar,
}: {
  idPedido?: number;
  idOc?: number;
  origenInicial: string;
  destinoInicial: string;
  fechaInicial: string;
  lineas: LineaCarga[];
  transportistas: OpcionTransportista[];
  existentes: { id: number; estado: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const resumen = resumirCarga(lineas);
  // Quien tiene vehiculos y ninguno aguanta la carga, no se ofrece de entrada.
  const estado = (t: OpcionTransportista): "cabe" | "no_cabe" | "sin_datos" => {
    const conDatos = t.vehiculos.filter((v) => v.capacidad_kg != null || v.capacidad_m3 != null || v.largo_carga_m != null);
    if (conDatos.length === 0) return "sin_datos";
    return conDatos.some((v) => ajusteVehiculo(resumen, v).ok) ? "cabe" : "no_cabe";
  };
  const [abierto, setAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<Set<number>>(() => new Set(transportistas.filter((t) => estado(t) !== "no_cabe").map((t) => t.id)));
  const [origen, setOrigen] = useState(origenInicial);
  const [destino, setDestino] = useState(destinoInicial);
  const [fecha, setFecha] = useState(fechaInicial);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function crear() {
    setError(null);
    empezar(async () => {
      const r = await crearCotizacionFlete({
        idPedido: idPedido ?? null,
        idOc: idOc ?? null,
        origen,
        destino,
        fechaRequerida: fecha,
        notas,
        transportistas: [...elegidos],
      });
      if (r?.error) setError(r.error);
      else if (r?.id) router.push(`/transportistas/cotizar/${r.id}`);
    });
  }

  return (
    <div className="text-xs space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {puedeEditar && (
          <button type="button" onClick={() => setAbierto(true)} className="border border-gray-300 bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded">
            Cotizar flete con varios transportistas
          </button>
        )}
        {existentes.map((c) => (
          <Link key={c.id} href={`/transportistas/cotizar/${c.id}`} className="underline text-verde">
            {folioFlete(c.id)} ({c.estado.toLowerCase()})
          </Link>
        ))}
      </div>
      {abierto && (
        <Ventana titulo="Cotizar flete" subtitulo="Se pide el mismo precio a cada transportista elegido" onCerrar={() => setAbierto(false)}>
          <div className="space-y-3 text-sm">
            <div className="grid sm:grid-cols-3 gap-3">
              <label>
                <span className="block text-dorado-osc font-semibold mb-1">Retiro en</span>
                <input className={input} value={origen} onChange={(e) => setOrigen(e.target.value)} />
              </label>
              <label>
                <span className="block text-dorado-osc font-semibold mb-1">Entrega en</span>
                <input className={input} value={destino} onChange={(e) => setDestino(e.target.value)} />
              </label>
              <label>
                <span className="block text-dorado-osc font-semibold mb-1">Fecha requerida</span>
                <input type="date" className={input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
            </div>
            <fieldset>
              <legend className="text-dorado-osc font-semibold mb-1">Transportistas a consultar</legend>
              {transportistas.length === 0 ? (
                <p className="text-xs text-amber-700">No hay transportistas activos en este mercado.</p>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-2">
                  {transportistas.map((t) => {
                    const e = estado(t);
                    const tarifa = t.tarifas.length ? Math.min(...t.tarifas.map((x) => x.monto)) : null;
                    return (
                      <li key={t.id}>
                        <label className="flex items-start gap-2 border border-gray-200 rounded px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={elegidos.has(t.id)}
                            onChange={(ev) => {
                              const n = new Set(elegidos);
                              if (ev.target.checked) n.add(t.id);
                              else n.delete(t.id);
                              setElegidos(n);
                            }}
                          />
                          <span>
                            <span className="font-semibold">{t.nombre}</span>
                            <span className="block text-xs text-gray-600">
                              {e === "cabe" && "Tiene un vehiculo en que cabe la carga"}
                              {e === "no_cabe" && <span className="text-red-700">Ningun vehiculo aguanta esta carga</span>}
                              {e === "sin_datos" && "Sin capacidades cargadas en sus vehiculos"}
                              {tarifa != null && ` · tarifa desde ${tarifa.toLocaleString("es-CL")}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
            <label className="block">
              <span className="block text-dorado-osc font-semibold mb-1">Indicaciones para los transportistas</span>
              <input className={input} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: descarga con grua, acceso por calle angosta" />
            </label>
            {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded p-2">{error}</div>}
            <div className="flex gap-2">
              <button onClick={crear} disabled={pendiente || elegidos.size === 0} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40">
                {pendiente ? "Creando..." : `Crear cotizacion (${elegidos.size})`}
              </button>
              <button onClick={() => setAbierto(false)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">Cancelar</button>
            </div>
          </div>
        </Ventana>
      )}
    </div>
  );
}
