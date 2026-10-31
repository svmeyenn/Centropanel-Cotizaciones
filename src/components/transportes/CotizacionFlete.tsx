"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adjudicarFlete,
  agregarTransportistaCotizacion,
  cancelarCotizacionFlete,
  guardarRespuestaFlete,
} from "@/app/transportistas/cotizar/acciones";
import type { OpcionTarifa, OpcionVehiculo } from "@/lib/transportes";

interface Fila {
  id: number;
  idTransportista: number;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  vehiculos: OpcionVehiculo[];
  tarifas: OpcionTarifa[];
  idVehiculo: number | null;
  monto: number | null;
  moneda: string;
  plazoDias: number | null;
  validaHasta: string;
  notas: string;
  estado: string;
}

interface Datos {
  origen: string;
  destino: string;
  fecha: string;
  pesoKg: number | null;
  volumenM3: number | null;
  largoMaxM: number | null;
  resumen: string;
  notas: string;
}

const input = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const BTN = "bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40";
const BTN_CLARO = "border border-gray-300 bg-white text-gray-800 text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40";
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const ESTADO: Record<string, string> = {
  Solicitada: "bg-gray-100 text-gray-700",
  Recibida: "bg-dorado/25 text-dorado-osc",
  Rechazada: "text-gray-500",
  Adjudicada: "bg-verde text-white",
};

function mensaje(folio: string, d: Datos, f: Fila, emisor: { nombre: string }) {
  const carga = [d.pesoKg != null ? `${num(d.pesoKg)} kg` : null, d.volumenM3 != null ? `${num(d.volumenM3)} m³` : null, d.largoMaxM != null ? `pieza mas larga ${num(d.largoMaxM)} m` : null]
    .filter(Boolean)
    .join(" · ");
  const lineas: (string | null)[] = [
    `Hola ${f.contacto || f.nombre}, te pedimos una cotizacion de flete (${folio}).`,
    "",
    d.origen ? `Retiro en: ${d.origen}` : null,
    d.destino ? `Entrega en: ${d.destino}` : null,
    d.fecha ? `Fecha requerida: ${d.fecha}` : null,
    carga ? `Carga: ${carga}` : null,
    d.resumen ? `\nDetalle:\n${d.resumen}` : null,
    d.notas ? `\nIndicaciones: ${d.notas}` : null,
    "",
    "Por favor indicanos el valor (indica si incluye IVA y descarga), el vehiculo y el plazo.",
    `Gracias, ${emisor.nombre} - Centro Panel`,
  ];
  return lineas.filter((x): x is string => x !== null).join("\n");
}

export default function CotizacionFlete({
  id,
  estado,
  documento,
  datos,
  emisor,
  moneda,
  filas,
  otros,
  puedeEditar,
}: {
  id: number;
  estado: string;
  documento: { href: string; texto: string } | null;
  datos: Datos;
  emisor: { nombre: string; telefono: string; email: string };
  moneda: string;
  filas: Fila[];
  otros: { id: number; nombre: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const folio = `FLT-${String(id).padStart(4, "0")}`;
  const abierta = estado === "Abierta";
  const editable = puedeEditar && abierta;
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [extra, setExtra] = useState("");

  const ofertas = filas.filter((f) => f.monto != null && f.estado !== "Rechazada");
  const menor = ofertas.length ? Math.min(...ofertas.map((f) => f.monto as number)) : null;

  function correr(fn: () => Promise<{ error?: string } | undefined>, ok: string) {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setAviso(ok);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="sticky top-2 z-10 shadow bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
      {aviso && <div role="status" className="sticky top-2 z-10 shadow bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">{aviso}</div>}

      <section className="bg-white border border-gray-200 rounded p-4 space-y-2" aria-labelledby="t-viaje">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="t-viaje" className="text-sm font-semibold text-verde">El viaje</h2>
          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${estado === "Adjudicada" ? "bg-verde text-white" : estado === "Cancelada" ? "bg-gray-100 text-gray-700" : "bg-dorado/25 text-dorado-osc"}`}>{estado}</span>
          {documento && <Link href={documento.href} className="text-xs text-verde underline">{documento.texto}</Link>}
          {editable && (
            <button className={`${BTN_CLARO} ml-auto`} disabled={pendiente} onClick={() => window.confirm("Cancelar esta cotizacion de flete?") && correr(() => cancelarCotizacionFlete(id), "Cotizacion cancelada.")}>
              Cancelar cotizacion
            </button>
          )}
        </div>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Dato t="Retiro en" v={datos.origen} />
          <Dato t="Entrega en" v={datos.destino} />
          <Dato t="Fecha requerida" v={datos.fecha} />
          <Dato t="Carga" v={[datos.pesoKg != null ? `${num(datos.pesoKg)} kg` : null, datos.volumenM3 != null ? `${num(datos.volumenM3)} m³` : null, datos.largoMaxM != null ? `${num(datos.largoMaxM)} m` : null].filter(Boolean).join(" · ")} />
        </dl>
        {datos.resumen && <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 border border-gray-100 rounded p-2">{datos.resumen}</pre>}
        {datos.notas && <p className="text-xs text-gray-600">Indicaciones: {datos.notas}</p>}
      </section>

      <section aria-labelledby="t-comp" className="space-y-2">
        <h2 id="t-comp" className="text-sm font-semibold text-verde">Ofertas</h2>
        <p className="text-xs text-gray-600 max-w-3xl">
          Pida el precio por WhatsApp o correo con el mensaje de cada fila y registre aqui lo que conteste. La oferta mas baja queda destacada; la
          tarifa vigente del transportista aparece de referencia. Al adjudicar, el pedido (o la orden) queda con ese transportista y su valor.
        </p>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2">Transportista</th>
                  <th scope="col" className="text-left px-3 py-2">Pedir precio</th>
                  <th scope="col" className="text-left px-3 py-2">Vehiculo</th>
                  <th scope="col" className="text-right px-3 py-2">Tarifa de referencia</th>
                  <th scope="col" className="text-left px-3 py-2 w-56">Su oferta</th>
                  <th scope="col" className="text-left px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <FilaOferta key={`${f.id}-${f.estado}-${f.monto}`} f={f} id={id} folio={folio} datos={datos} emisor={emisor} moneda={moneda} esMenor={menor != null && f.monto === menor && f.estado !== "Rechazada"} editable={editable} correr={correr} pendiente={pendiente} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {editable && otros.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Agregar transportista" className="border border-gray-300 rounded px-2 py-1 bg-white" value={extra} onChange={(e) => setExtra(e.target.value)}>
              <option value="">Agregar otro transportista</option>
              {otros.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <button className={BTN} disabled={!extra || pendiente} onClick={() => correr(() => agregarTransportistaCotizacion(id, Number(extra)), "Transportista agregado.")}>Agregar</button>
          </div>
        )}
      </section>
    </div>
  );
}

function FilaOferta({
  f, id, folio, datos, emisor, moneda, esMenor, editable, correr, pendiente,
}: {
  f: Fila; id: number; folio: string; datos: Datos; emisor: { nombre: string; telefono: string; email: string }; moneda: string;
  esMenor: boolean; editable: boolean; pendiente: boolean;
  correr: (fn: () => Promise<{ error?: string } | undefined>, ok: string) => void;
}) {
  const [idV, setIdV] = useState<number | null>(f.idVehiculo);
  const [monto, setMonto] = useState(f.monto == null ? "" : String(f.monto).replace(".", ","));
  const [plazo, setPlazo] = useState(f.plazoDias == null ? "" : String(f.plazoDias));
  const [valida, setValida] = useState(f.validaHasta);
  const [notas, setNotas] = useState(f.notas);
  const [copiado, setCopiado] = useState(false);
  const texto = mensaje(folio, datos, f, emisor);
  const tel = f.telefono.replace(/\D/g, "");
  const ref = f.tarifas.length ? [...f.tarifas].sort((a, b) => a.monto - b.monto)[0] : null;
  const cerrada = f.estado === "Adjudicada" || f.estado === "Rechazada";
  const valor = monto.trim() === "" ? null : Number(monto.replace(/\./g, "").replace(",", "."));

  const guardar = (noCotiza: boolean) =>
    correr(
      () => guardarRespuestaFlete(id, f.id, { idVehiculo: idV, monto: valor, moneda, plazoDias: plazo.trim() === "" ? null : Number(plazo), validaHasta: valida, notas, noCotiza }),
      noCotiza ? "Quedo como que no cotiza." : "Oferta registrada."
    );

  return (
    <tr className={`border-t border-gray-100 align-top ${esMenor ? "bg-green-50" : "hover:bg-crema"} ${f.estado === "Rechazada" ? "text-gray-500" : ""}`}>
      <th scope="row" className="text-left px-3 py-2 font-normal">
        <Link href={`/transportistas/${f.idTransportista}`} className="text-verde font-semibold underline">{f.nombre}</Link>
        <div className="text-gray-500">{[f.contacto, f.telefono].filter(Boolean).join(" · ")}</div>
      </th>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {tel && (
            <a className={BTN} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`}>WhatsApp</a>
          )}
          {f.email && (
            <a className={BTN_CLARO} href={`mailto:${f.email}?subject=${encodeURIComponent(`Cotizacion de flete ${folio}`)}&body=${encodeURIComponent(texto)}`}>Correo</a>
          )}
          <button
            className={BTN_CLARO}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(texto);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              } catch {
                window.prompt("Copie el mensaje:", texto);
              }
            }}
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <select aria-label={`Vehiculo de ${f.nombre}`} className={input} disabled={!editable || cerrada} value={idV ?? ""} onChange={(e) => setIdV(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Sin definir</option>
          {f.vehiculos.map((v) => <option key={v.id} value={v.id}>{v.etiqueta}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-600">
        {ref ? (<>{ref.moneda} {num(ref.monto)}<div className="text-[11px]">{ref.tipo_cobro.toLowerCase()}{f.tarifas.length > 1 ? ` · ${f.tarifas.length} tarifas` : ""}</div></>) : "—"}
      </td>
      <td className="px-3 py-2">
        <div className="space-y-1">
          <input aria-label={`Valor ofrecido por ${f.nombre}`} inputMode="decimal" className={`${input} text-right`} placeholder={`Valor (${moneda})`} disabled={!editable || cerrada} value={monto} onChange={(e) => setMonto(e.target.value)} />
          <div className="flex gap-1">
            <input aria-label={`Plazo en dias de ${f.nombre}`} inputMode="numeric" className={input} placeholder="Plazo (dias)" disabled={!editable || cerrada} value={plazo} onChange={(e) => setPlazo(e.target.value)} />
            <input aria-label={`Valida hasta, ${f.nombre}`} type="date" className={input} disabled={!editable || cerrada} value={valida} onChange={(e) => setValida(e.target.value)} />
          </div>
          <input aria-label={`Notas de ${f.nombre}`} className={input} placeholder="Notas (incluye IVA, descarga...)" disabled={!editable || cerrada} value={notas} onChange={(e) => setNotas(e.target.value)} />
          {editable && !cerrada && (
            <div className="flex flex-wrap gap-1">
              <button className={BTN} disabled={pendiente || valor == null} onClick={() => guardar(false)}>Registrar oferta</button>
              <button className={BTN_CLARO} disabled={pendiente} onClick={() => guardar(true)}>No cotiza</button>
              {f.estado === "Recibida" && f.monto != null && (
                <button className="bg-dorado text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40" disabled={pendiente} onClick={() => window.confirm(`Adjudicar el flete a ${f.nombre} por ${moneda} ${num(f.monto!)}?`) && correr(() => adjudicarFlete(id, f.id), "Flete adjudicado: el documento quedo con este transportista.")}>
                  Adjudicar
                </button>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${ESTADO[f.estado] ?? ""}`}>{f.estado === "Rechazada" && f.monto == null ? "No cotiza" : f.estado}</span>
        {esMenor && <div className="text-[11px] text-green-800 font-semibold mt-1">La mas baja</div>}
      </td>
    </tr>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-dorado-osc font-semibold">{t}</dt>
      <dd className="text-gray-800">{v || <span className="text-gray-500">—</span>}</dd>
    </div>
  );
}
