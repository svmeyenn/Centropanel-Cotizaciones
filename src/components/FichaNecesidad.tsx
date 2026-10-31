"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import VentanaNuevaMateria from "@/components/VentanaNuevaMateria";
import { COLOR_NM } from "@/lib/compras";
import { dinero, fecha as fmtFecha } from "@/lib/formato";
import { impuestoDelPais, porcentajeImpuesto, rotuloDescuento, subtotalLinea, totalesFactura } from "@/lib/factura";
import {
  abrirSolicitud,
  adjudicarSolicitud,
  actualizarCabeceraSolicitud,
  actualizarCabeceraNecesidad,
  actualizarCostos,
  diferenciasCosto,
  type DiferenciaCosto,
  agregarItems,
  anularNecesidad,
  anularSolicitud,
  buscarItemsCompra,
  crearSolicitud,
  declinarProveedor,
  enlaceCotizacionPdf,
  enviarSolicitud,
  reversarEnvioSolicitud,
  generarOC,
  invitarProveedor,
  quitarItem,
  quitarItemsSolicitud,
  quitarProveedor,
  registrarCotizacion,
  revocarAdjudicacion,
  subirCotizacionPdf,
  type ItemBuscado,
  type Resultado,
} from "@/app/necesidades/acciones";

export type Detalle = {
  nm: {
    id: number;
    folio: string;
    id_pais: number;
    id_proyecto: number | null;
    id_pedido: number | null;
    estado: string;
    fecha_requerida: string | null;
    direccion_destino: string | null;
    modalidad_entrega: "Despacho" | "Retiro";
    contacto_destino: string | null;
    telefono_destino: string | null;
    email_destino: string | null;
    notas: string | null;
    proyecto: string | null;
    num_pedido: string | null;
    solicitante: string | null;
    puede_comprar: boolean;
    iva_pct: number;
  };
  items: Item[];
  proveedores: Prov[];
  precios: { p: number; i: number; v: number }[];
  // Lo que cada proveedor tiene asignado en su maestra, con su costo.
  maestra: { p: number; i: number; c: number; m: string | null }[];
  // Items que se sacaron a mano de la solicitud de un proveedor.
  excluidos?: { p: number; i: number }[];
  solicitudes: Sol[];
};
type Item = {
  id: number;
  orden: number;
  descripcion: string;
  sku: string | null;
  unidad: string | null;
  cantidad: number;
  partida: string | null;
  nota: string | null;
  id_sc: number | null;
  folio_sc: string | null;
};
type Prov = {
  id: number;
  id_proveedor: number;
  nombre: string;
  estado: "Invitado" | "Respondio" | "Declino";
  moneda: string | null;
  plazo_dias: number | null;
  descuento_pct: number;
  condiciones_pago: string | null;
  validez: string | null;
  archivo_ruta: string | null;
  archivo_nombre: string | null;
  notas: string | null;
};
type Sol = {
  id: number;
  folio: string;
  estado: "Borrador" | "En cotizacion" | "Abierta" | "Adjudicada" | "Anulada";
  id_padre: number | null;
  folio_padre: string | null;
  id_participante: number | null;
  id_oc: number | null;
  num_oc: string | null;
  fecha_entrega: string | null;
  direccion_destino: string | null;
  notas: string | null;
  items: number[];
};

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";
const BTN = "border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";
const BTN_VERDE = "bg-verde text-white text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";
const BTN_ROJO = "border border-red-300 bg-white text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";

export default function FichaNecesidad({
  detalle,
  moneda,
  proveedoresDisponibles,
}: {
  detalle: Detalle;
  moneda: string;
  proveedoresDisponibles: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const { nm, items, proveedores, solicitudes } = detalle;
  const comprador = nm.puede_comprar;
  const abierta = nm.estado !== "Anulada" && nm.estado !== "Cerrada";
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();
  const [cotizando, setCotizando] = useState<Prov | null>(null);
  const [abriendo, setAbriendo] = useState<Sol | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [editandoDestino, setEditandoDestino] = useState(false);
  const [invitar, setInvitar] = useState("");

  // precio[participante][item]
  const precio = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of detalle.precios) m.set(`${x.p}:${x.i}`, Number(x.v));
    return m;
  }, [detalle.precios]);
  // maestra[participante:item] = costo del item en la maestra del proveedor; sin entrada, no lo tiene asignado.
  const maestra = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of detalle.maestra ?? []) m.set(`${x.p}:${x.i}`, Number(x.c));
    return m;
  }, [detalle.maestra]);
  const excluidos = useMemo(() => new Set((detalle.excluidos ?? []).map((x) => `${x.p}:${x.i}`)), [detalle.excluidos]);
  const itemPor = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const provPor = useMemo(() => new Map(proveedores.map((p) => [p.id, p])), [proveedores]);
  const vigentes = solicitudes.filter((s) => s.estado !== "Abierta" && s.estado !== "Anulada");
  const historial = solicitudes.filter((s) => s.estado === "Abierta" || s.estado === "Anulada");
  const sinSolicitud = items.filter((i) => i.id_sc == null);

  function ejecutar(f: () => Promise<Resultado>, mensajeOk?: string, alTerminar?: () => void) {
    setAviso(null);
    empezar(async () => {
      const r = await f();
      if (!r.ok) return setAviso({ ok: false, texto: r.error ?? "No se pudo." });
      if (mensajeOk) setAviso({ ok: true, texto: mensajeOk });
      alTerminar?.();
      router.refresh();
    });
  }

  const total = (s: Sol, idPart: number): number | null => {
    let t = 0;
    for (const id of s.items) {
      const p = precio.get(`${idPart}:${id}`);
      if (p == null) return null;
      t += p * Number(itemPor.get(id)?.cantidad ?? 0);
    }
    return s.items.length === 0 ? null : t;
  };
  const cotizaron = proveedores.filter((p) => p.estado === "Respondio");

  return (
    <div className="space-y-4 text-xs">
      {/* Cabecera */}
      <section className="bg-white border border-gray-200 rounded p-3 flex flex-wrap items-start gap-x-8 gap-y-2">
        <div>
          <span className={ROTULO}>Estado</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${COLOR_NM[nm.estado] ?? ""}`}>{nm.estado}</span>
        </div>
        <div>
          <span className={ROTULO}>Para</span>
          {nm.proyecto && (
            <Link href={`/proyectos/${nm.id_proyecto}`} className="text-verde underline block">
              {nm.proyecto}
            </Link>
          )}
          {nm.num_pedido && (
            <Link href={`/pedidos/${nm.id_pedido}`} className="text-verde underline block">
              Pedido {nm.num_pedido}
            </Link>
          )}
        </div>
        <div>
          <span className={ROTULO}>Entrega en destino</span>
          {nm.fecha_requerida ? fmtFecha(nm.fecha_requerida) : "—"}
        </div>
        <div className="max-w-sm">
          <span className={ROTULO}>Entrega</span>
          {nm.modalidad_entrega === "Retiro" ? "Retiro en el proveedor" : <>Despacho a bodega{nm.direccion_destino ? `: ${nm.direccion_destino}` : ""}</>}
        </div>
        <div className="max-w-xs">
          <span className={ROTULO}>Contacto en destino</span>
          {nm.contacto_destino ?? "—"}
          {(nm.telefono_destino || nm.email_destino) && <span className="block text-gray-600">{[nm.telefono_destino, nm.email_destino].filter(Boolean).join(" | ")}</span>}
        </div>
        <div>
          <span className={ROTULO}>Pidio</span>
          {nm.solicitante ?? "—"}
        </div>
        {nm.notas && (
          <div className="max-w-md">
            <span className={ROTULO}>Notas</span>
            {nm.notas}
          </div>
        )}
        {comprador && abierta && (
          <div className="ml-auto flex gap-1.5">
            <button type="button" className={BTN} disabled={pendiente} onClick={() => setEditandoDestino(true)}>
              Editar cabecera
            </button>
            <button
              type="button"
              className={BTN_ROJO}
              disabled={pendiente}
              onClick={() => confirm(`Anular la necesidad ${nm.folio}? Se anulan todas sus solicitudes.`) && ejecutar(() => anularNecesidad(nm.id), "Necesidad anulada.")}
            >
              Anular necesidad
            </button>
          </div>
        )}
      </section>

      {aviso && (
        <p className={`rounded px-3 py-2 border ${aviso.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`} role={aviso.ok ? "status" : "alert"}>
          {aviso.texto}
        </p>
      )}

      {/* Items */}
      <section className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white px-3 py-1.5 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase">Items · {items.length}</h2>
          {abierta && (
            <button type="button" className="bg-white text-verde text-[11px] font-semibold px-2 py-0.5 rounded" onClick={() => setAgregando(true)}>
              Agregar items
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-1.5">Item</th>
                <th className="text-right px-3 py-1.5 w-28">Cantidad</th>
                <th className="text-left px-3 py-1.5 w-24">Unidad</th>
                <th className="text-left px-3 py-1.5">Partida</th>
                <th className="text-left px-3 py-1.5 w-28">Solicitud</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">{i.sku && <span className="font-mono text-[10px] text-gray-500 mr-1.5">{i.sku}</span>}{i.descripcion}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{Number(i.cantidad).toLocaleString("es-CL")}</td>
                  <td className="px-3 py-1.5">{i.unidad ?? ""}</td>
                  <td className="px-3 py-1.5 text-gray-600">{i.partida ?? ""}</td>
                  <td className="px-3 py-1.5">{i.folio_sc ?? <span className="text-amber-700">sin solicitud</span>}</td>
                  <td className="px-3 py-1.5 text-right">
                    {abierta && (i.id_sc == null || solicitudes.find((s) => s.id === i.id_sc)?.estado === "Borrador") && (
                      <button type="button" className="text-red-700 underline text-[11px]" disabled={pendiente} onClick={() => ejecutar(() => quitarItem(nm.id, i.id))}>
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {comprador && abierta && sinSolicitud.length > 0 && (
          <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-amber-900 flex flex-wrap items-center gap-2">
            {sinSolicitud.length} item{sinSolicitud.length > 1 ? "s" : ""} sin solicitud de cotizacion.
            <button type="button" className={BTN_VERDE} disabled={pendiente} onClick={() => ejecutar(() => crearSolicitud(nm.id, null), "Solicitud creada con esos items.")}>
              Crear solicitud con esos items
            </button>
          </div>
        )}
      </section>

      {/* Proveedores */}
      <section className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white px-3 py-1.5">
          <h2 className="text-[11px] font-semibold uppercase">Proveedores invitados · {proveedores.length}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-1.5">Proveedor</th>
                <th className="text-left px-3 py-1.5">Estado</th>
                <th className="text-left px-3 py-1.5">Plazo</th>
                <th className="text-left px-3 py-1.5">Condiciones de pago</th>
                <th className="text-left px-3 py-1.5">Valida hasta</th>
                <th className="text-left px-3 py-1.5">Cotizacion</th>
                <th className="w-56" />
              </tr>
            </thead>
            <tbody>
              {proveedores.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-4">
                    Invite a los proveedores a los que les va a pedir precio.
                  </td>
                </tr>
              )}
              {proveedores.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 font-semibold">{p.nombre}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 rounded text-[10px] font-semibold ${p.estado === "Respondio" ? "bg-emerald-100 text-emerald-800" : p.estado === "Declino" ? "bg-gray-200 text-gray-600" : "bg-amber-100 text-amber-800"}`}>
                      {p.estado === "Respondio" ? "Respondio" : p.estado === "Declino" ? "Declino" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{p.plazo_dias != null ? `${p.plazo_dias} dias` : ""}</td>
                  <td className="px-3 py-1.5">{p.condiciones_pago ?? ""}</td>
                  <td className="px-3 py-1.5">{p.validez ? fmtFecha(p.validez) : ""}</td>
                  <td className="px-3 py-1.5">
                    {p.archivo_ruta ? (
                      <button
                        type="button"
                        className="text-verde underline"
                        onClick={async () => {
                          const r = await enlaceCotizacionPdf(p.archivo_ruta!);
                          if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
                          else setAviso({ ok: false, texto: r.error ?? "No se pudo abrir." });
                        }}
                      >
                        {p.archivo_nombre ?? "Ver PDF"}
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap space-x-1.5">
                    <Link href={`/necesidades/${nm.id}/proveedor/${p.id}`} className={BTN}>
                      Ver detalle
                    </Link>
                    {comprador && (
                      <Link href={`/necesidades/${nm.id}/proveedor/${p.id}/enviar`} className={BTN}>
                        Enviar
                      </Link>
                    )}
                    {comprador && abierta && p.estado !== "Declino" && (
                      <button type="button" className={BTN_VERDE} onClick={() => setCotizando(p)}>
                        {p.estado === "Respondio" ? "Editar cotizacion" : "Registrar cotizacion"}
                      </button>
                    )}
                    {comprador && abierta && p.estado !== "Declino" && (
                      <button type="button" className={BTN} disabled={pendiente} onClick={() => ejecutar(() => declinarProveedor(nm.id, p.id))}>
                        Declino
                      </button>
                    )}
                    {comprador && abierta && (
                      <button type="button" className={BTN_ROJO} disabled={pendiente} onClick={() => ejecutar(() => quitarProveedor(nm.id, p.id))}>
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {comprador && abierta && (
          <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem]">
              <label htmlFor="nm-invitar" className={ROTULO}>Invitar proveedor</label>
              <select id="nm-invitar" className={CAMPO} value={invitar} onChange={(e) => setInvitar(e.target.value)}>
                <option value="">-- elija --</option>
                {proveedoresDisponibles.filter((d) => !proveedores.some((p) => p.id_proveedor === d.id)).map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <button type="button" className={BTN_VERDE} disabled={pendiente || !invitar} onClick={() => ejecutar(() => invitarProveedor(nm.id, Number(invitar)), undefined, () => setInvitar(""))}>
              Invitar
            </button>
          </div>
        )}
      </section>

      {/* Solicitudes de cotizacion y cuadro comparativo */}
      {vigentes.map((s) => (
        <TarjetaSolicitud
          key={s.id}
          s={s}
          destinoNm={{ fecha: nm.fecha_requerida, direccion: nm.direccion_destino }}
          items={s.items.map((id) => itemPor.get(id)).filter((x): x is Item => !!x)}
          proveedores={proveedores.filter((p) => p.estado !== "Declino")}
          precio={precio}
          maestra={maestra}
          excluidos={excluidos}
          total={total}
          moneda={moneda}
          ivaPct={Number(nm.iva_pct ?? 0)}
          impuesto={impuestoDelPais(nm.id_pais)}
          comprador={comprador}
          pendiente={pendiente}
          ejecutar={ejecutar}
          idNm={nm.id}
          adjudicada={s.id_participante ? provPor.get(s.id_participante) ?? null : null}
          alAbrir={() => setAbriendo(s)}
          hayCotizaciones={cotizaron.length > 0}
        />
      ))}

      {historial.length > 0 && (
        <section className="bg-white border border-gray-200 rounded p-3">
          <h2 className="text-[11px] font-semibold uppercase text-gray-600 mb-1.5">Historial de solicitudes</h2>
          <ul className="space-y-0.5">
            {historial.map((s) => (
              <li key={s.id} className="text-gray-700">
                <span className="font-semibold">{s.folio}</span>{" "}
                <span className={`px-1.5 rounded text-[10px] font-semibold ${COLOR_NM[s.estado] ?? "bg-gray-100"}`}>{s.estado}</span>
                {s.estado === "Abierta" && (
                  <span className="text-gray-600"> · se abrio en {solicitudes.filter((h) => h.id_padre === s.id).map((h) => h.folio).join(", ")}</span>
                )}
                {s.folio_padre && <span className="text-gray-600"> · viene de {s.folio_padre}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cotizando && (
        <VentanaCotizacion
          prov={cotizando}
          items={items}
          precio={precio}
          maestra={maestra}
          idNm={nm.id}
          moneda={moneda}
          ivaPct={Number(nm.iva_pct ?? 0)}
          impuesto={impuestoDelPais(nm.id_pais)}
          alCerrar={(hecho) => {
            setCotizando(null);
            if (hecho) {
              setAviso({ ok: true, texto: "Cotizacion guardada." });
              router.refresh();
            }
          }}
        />
      )}
      {abriendo && (
        <VentanaApertura
          s={abriendo}
          items={abriendo.items.map((id) => itemPor.get(id)).filter((x): x is Item => !!x)}
          alCerrar={() => setAbriendo(null)}
          alAbrir={(grupos) =>
            ejecutar(() => abrirSolicitud(nm.id, abriendo.id, grupos), `${abriendo.folio} abierta en ${grupos.length} solicitudes.`, () => setAbriendo(null))
          }
          pendiente={pendiente}
        />
      )}
      {editandoDestino && <VentanaCabeceraNecesidad idNm={nm.id} fecha={nm.fecha_requerida} direccion={nm.direccion_destino} modalidad={nm.modalidad_entrega} notas={nm.notas} contacto={{ contacto: nm.contacto_destino ?? "", telefono: nm.telefono_destino ?? "", email: nm.email_destino ?? "" }} alCerrar={(hecho) => { setEditandoDestino(false); if (hecho) router.refresh(); }} />}
      {agregando && <VentanaAgregarItems idNm={nm.id} idPais={nm.id_pais} puedeCrearMateria={comprador} alCerrar={(hecho) => { setAgregando(false); if (hecho) router.refresh(); }} />}
    </div>
  );
}

// Una solicitud con su cuadro comparativo: items en filas, proveedores en columnas, el mejor precio de cada item
// destacado, y el total de cada proveedor si cotizo todo.
function TarjetaSolicitud({
  s, destinoNm, items, proveedores: todosLosProveedores, precio, maestra, excluidos, total, moneda, ivaPct, impuesto, comprador, pendiente, ejecutar, idNm, adjudicada, alAbrir, hayCotizaciones,
}: {
  s: Sol;
  destinoNm: { fecha: string | null; direccion: string | null };
  items: Item[];
  proveedores: Prov[];
  precio: Map<string, number>;
  maestra: Map<string, number>;
  excluidos: Set<string>;
  total: (s: Sol, idPart: number) => number | null;
  moneda: string;
  ivaPct: number;
  impuesto: string;
  comprador: boolean;
  pendiente: boolean;
  ejecutar: (f: () => Promise<Resultado>, ok?: string, fin?: () => void) => void;
  idNm: number;
  adjudicada: Prov | null;
  alAbrir: () => void;
  hayCotizaciones: boolean;
}) {
  // Solo las columnas de los proveedores a los que se les pide algo de esta solicitud: el que no vende ningun item del
  // listado --o a quien se le sacaron todos-- no aparece.
  const proveedores = todosLosProveedores.filter((p) => items.some((i) => precio.has(`${p.id}:${i.id}`) || maestra.has(`${p.id}:${i.id}`)));
  // Cada proveedor con la estructura de una factura: subtotal, descuento, subtotal despues del descuento, impuesto y total.
  const desglose = proveedores.map((p) => {
    const sub = total(s, p.id);
    return sub == null ? null : totalesFactura(sub, { tipo: "pct", valor: Number(p.descuento_pct ?? 0) }, ivaPct, moneda);
  });
  const totales = desglose.map((d) => (d ? d.total : null));
  const mejorTotal = Math.min(...totales.filter((t): t is number => t != null));
  const enCotizacion = s.estado === "En cotizacion";
  const adj = s.estado === "Adjudicada";
  const [editando, setEditando] = useState(false);
  const router = useRouter();
  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden">
      {editando && <VentanaCabeceraSolicitud s={s} idNm={idNm} destinoNm={destinoNm} alCerrar={(hecho) => { setEditando(false); if (hecho) router.refresh(); }} />}
      <div className="bg-verde text-white px-3 py-1.5 flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase">
          {s.folio} · {items.length} item{items.length === 1 ? "" : "s"}
        </h2>
        <span className={`px-1.5 rounded text-[10px] font-semibold ${COLOR_NM[s.estado] ?? "bg-gray-100"} text-gray-900`}>{s.estado}</span>
        {s.folio_padre && <span className="text-[10px] text-white/80">viene de {s.folio_padre}</span>}
        {adj && adjudicada && <span className="text-[11px]">Adjudicada a {adjudicada.nombre}</span>}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {comprador && s.estado === "Borrador" && (
            <button type="button" className="bg-white text-verde text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40" disabled={pendiente} onClick={() => ejecutar(() => enviarSolicitud(idNm, s.id), "Enviada a cotizar.")}>
              Enviar a cotizar
            </button>
          )}
          {comprador && enCotizacion && (
            <button
              type="button"
              className="bg-white text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40"
              disabled={pendiente}
              title="Vuelve la solicitud a borrador. Los correos o WhatsApp ya enviados no se pueden retirar."
              onClick={() =>
                confirm(`Reversar el envio de ${s.folio}? Vuelve a borrador. Lo que ya se envio a los proveedores no se puede retirar: avisele si corresponde.`) &&
                ejecutar(() => reversarEnvioSolicitud(idNm, s.id), "Envio reversado: la solicitud volvio a borrador.")
              }
            >
              Reversar envio
            </button>
          )}
          {comprador && (s.estado === "Borrador" || enCotizacion) && items.length >= 2 && (
            <button type="button" className="bg-white text-verde text-[11px] font-semibold px-2 py-0.5 rounded" onClick={alAbrir}>
              Abrir en varias
            </button>
          )}
          {comprador && adj && !s.id_oc && (
            <>
              <button type="button" className="bg-dorado text-negro text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40" disabled={pendiente} onClick={() => ejecutar(() => generarOC(idNm, s.id), "Orden de compra generada.")}>
                Generar orden de compra
              </button>
              <button type="button" className="bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40" disabled={pendiente} onClick={() => ejecutar(() => revocarAdjudicacion(idNm, s.id), "Adjudicacion revocada.")}>
                Revocar adjudicacion
              </button>
            </>
          )}
          <a href={`/necesidades/${idNm}/solicitud/${s.id}/0/pdf`} target="_blank" rel="noopener noreferrer" className="bg-white text-verde text-[11px] font-semibold px-2 py-0.5 rounded">
            PDF
          </a>
          {comprador && (s.estado === "Borrador" || enCotizacion) && (
            <Link href={`/necesidades/${idNm}/solicitud/${s.id}`} className="bg-white text-verde text-[11px] font-semibold px-2 py-0.5 rounded">
              Enviar a proveedores
            </Link>
          )}
          {s.id_oc && (
            <Link href={`/compras/${s.id_oc}`} className="bg-white text-verde text-[11px] font-semibold px-2 py-0.5 rounded">
              Ver {s.num_oc}
            </Link>
          )}
          {comprador && (s.estado === "Borrador" || enCotizacion) && (
            <button type="button" className="bg-white text-verde text-[11px] font-semibold px-2 py-0.5 rounded" onClick={() => setEditando(true)}>
              Editar cabecera
            </button>
          )}
          {comprador && !s.id_oc && (
            <button type="button" className="bg-white text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40" disabled={pendiente} onClick={() => confirm(`Anular ${s.folio}? Sus items quedan sin solicitud.`) && ejecutar(() => anularSolicitud(idNm, s.id), "Solicitud anulada.")}>
              Anular
            </button>
          )}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-1.5">Item</th>
              <th className="text-right px-3 py-1.5 w-24">Cantidad</th>
              {proveedores.map((p) => (
                <th key={p.id} className={`text-right px-3 py-1.5 min-w-[8rem] ${adj && adjudicada?.id === p.id ? "bg-emerald-100 text-emerald-900" : ""}`}>
                  {p.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const precios = proveedores.map((p) => precio.get(`${p.id}:${i.id}`));
              const mejor = Math.min(...precios.filter((x): x is number => x != null));
              return (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">
                    {i.sku && <span className="font-mono text-[10px] text-gray-500 mr-1.5">{i.sku}</span>}{i.descripcion}
                    {comprador && (s.estado === "Borrador" || enCotizacion) && (
                      <button
                        type="button"
                        className="ml-2 text-red-700 underline text-[11px] disabled:opacity-40"
                        disabled={pendiente}
                        title="Quita el item de esta solicitud para todos los proveedores"
                        onClick={() => confirm(`Quitar "${i.descripcion}" de ${s.folio}? Queda sin solicitud.`) && ejecutar(() => quitarItemsSolicitud(idNm, s.id, [i.id]), "Item quitado de la solicitud.")}
                      >
                        Quitar
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{Number(i.cantidad).toLocaleString("es-CL")} {i.unidad ?? ""}</td>
                  {proveedores.map((p, k) => {
                    const v = precios[k];
                    const esMejor = v != null && v === mejor && precios.filter((x) => x != null).length > 1;
                    return (
                      <td key={p.id} className={`px-3 py-1.5 text-right tabular-nums ${esMejor ? "bg-emerald-50 text-emerald-800 font-semibold" : ""}`}>
                        {v != null ? dinero(v, moneda) : maestra.has(`${p.id}:${i.id}`) ? <span className="text-gray-400">sin precio</span> : excluidos.has(`${p.id}:${i.id}`) ? <span className="text-gray-400 italic" title="Se saco de su solicitud">excluido</span> : <span className="text-gray-300 italic" title="No lo tiene asignado en su maestra">no lo vende</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {[
              { r: "Subtotal", v: (d: ReturnType<typeof totalesFactura>, p: Prov) => dinero(d.subtotal, moneda) },
              { r: "Descuento", v: (d: ReturnType<typeof totalesFactura>, p: Prov) => (d.descuento > 0 ? `- ${dinero(d.descuento, moneda)}` : dinero(0, moneda)), rot: (p: Prov) => rotuloDescuento({ tipo: "pct", valor: Number(p.descuento_pct ?? 0) }) },
              { r: "Subtotal despues del descuento", v: (d: ReturnType<typeof totalesFactura>, p: Prov) => dinero(d.subtotalNeto, moneda) },
              { r: `${impuesto} ${porcentajeImpuesto(ivaPct)}`, v: (d: ReturnType<typeof totalesFactura>, p: Prov) => dinero(d.iva, moneda) },
            ].map((f, i) => (
              <tr key={f.r} className={`bg-gray-50 ${i === 0 ? "border-t-2 border-gray-200" : ""}`}>
                <td className="px-3 py-1 text-right text-gray-600" colSpan={2}>{f.r}</td>
                {proveedores.map((p, k) => (
                  <td key={p.id} className="px-3 py-1 text-right tabular-nums text-gray-700">
                    {desglose[k] ? f.v(desglose[k]!, p) : <span className="text-gray-300">—</span>}
                    {f.rot && desglose[k] && Number(p.descuento_pct ?? 0) > 0 ? <span className="block text-[10px] text-gray-400">{f.rot(p)}</span> : null}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="px-3 py-1.5 text-right" colSpan={2}>TOTAL A PAGAR</td>
              {proveedores.map((p, k) => {
                const t = totales[k];
                return (
                  <td key={p.id} className={`px-3 py-1.5 text-right tabular-nums ${t != null && t === mejorTotal ? "text-emerald-800" : ""}`}>
                    {t != null ? dinero(t, moneda) : <span className="text-gray-400 font-normal">incompleto</span>}
                  </td>
                );
              })}
            </tr>
            {comprador && enCotizacion && (
              <tr className="bg-white">
                <td className="px-3 py-1.5" colSpan={2}>
                  {!hayCotizaciones && <span className="text-gray-500 font-normal">Todavia no hay cotizaciones registradas.</span>}
                </td>
                {proveedores.map((p, k) => (
                  <td key={p.id} className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      className={BTN_VERDE}
                      disabled={pendiente || totales[k] == null || p.estado !== "Respondio"}
                      title={totales[k] == null ? "No cotizo todos los items de esta solicitud" : undefined}
                      onClick={() => confirm(`Adjudicar ${s.folio} a ${p.nombre}?`) && ejecutar(() => adjudicarSolicitud(idNm, s.id, p.id), `${s.folio} adjudicada a ${p.nombre}.`)}
                    >
                      Adjudicar
                    </button>
                  </td>
                ))}
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function VentanaCotizacion({
  prov, items, precio, maestra, idNm, moneda, ivaPct, impuesto, alCerrar,
}: {
  prov: Prov;
  items: Item[];
  precio: Map<string, number>;
  maestra: Map<string, number>;
  idNm: number;
  moneda: string;
  ivaPct: number;
  impuesto: string;
  alCerrar: (hecho: boolean) => void;
}) {
  const [cab, setCab] = useState({
    moneda: prov.moneda ?? moneda,
    plazo_dias: prov.plazo_dias != null ? String(prov.plazo_dias) : "",
    condiciones_pago: prov.condiciones_pago ?? "",
    validez: prov.validez ?? "",
    descuento_pct: prov.descuento_pct ? String(prov.descuento_pct) : "",
    notas: prov.notas ?? "",
  });
  const [valores, setValores] = useState<Record<number, string>>(() => {
    const o: Record<number, string> = {};
    for (const i of items) {
      const v = precio.get(`${prov.id}:${i.id}`);
      o[i.id] = v != null ? String(v) : "";
    }
    return o;
  });
  const archivo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  // Lo cotizado que difiere de su maestra, para preguntar si se actualiza el costo.
  const [diferencias, setDiferencias] = useState<DiferenciaCosto[] | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const asignado = (idItem: number) => maestra.has(`${prov.id}:${idItem}`);

  // El precio escrito en un item, o nada si esta en blanco.
  function valorDe(id: number): number | null {
    const t = (valores[id] ?? "").trim().replace(",", ".");
    const n = Number(t);
    return t === "" || !Number.isFinite(n) ? null : n;
  }
  // La cotizacion con la estructura de una factura, a medida que se escriben los precios.
  const subtotalLineas = items.reduce((a, i) => a + (valorDe(i.id) != null ? subtotalLinea(Number(i.cantidad), valorDe(i.id)!, cab.moneda) : 0), 0);
  const factura = totalesFactura(subtotalLineas, { tipo: "pct", valor: Number(cab.descuento_pct) || 0 }, ivaPct, cab.moneda);

  function guardar() {
    setError(null);
    const precios = items.filter((i) => asignado(i.id)).map((i) => {
      const t = (valores[i.id] ?? "").trim().replace(",", ".");
      return { id_item: i.id, precio: t === "" ? null : Number(t) };
    });
    if (precios.some((p) => p.precio != null && !(p.precio >= 0))) return setError("Hay un precio invalido.");
    empezar(async () => {
      const r = await registrarCotizacion(idNm, prov.id, cab, precios);
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      const f = archivo.current?.files?.[0];
      if (f) {
        const d = new FormData();
        d.set("archivo", f);
        const s = await subirCotizacionPdf(idNm, prov.id, d);
        if (!s.ok) return setError(`Los precios quedaron guardados, pero el archivo no: ${s.error}`);
      }
      // Si lo cotizado no coincide con el costo de su maestra, se pregunta si se actualiza.
      const dif = await diferenciasCosto(prov.id);
      if (dif.length > 0) {
        setDiferencias(dif);
        setElegidas(new Set(dif.filter((x) => x.misma_moneda).map((x) => x.id_item)));
        return;
      }
      alCerrar(true);
    });
  }

  function actualizarMaestra() {
    empezar(async () => {
      const r = await actualizarCostos(idNm, prov.id, [...elegidas]);
      if (!r.ok) return setError(r.error ?? "No se pudo actualizar.");
      alCerrar(true);
    });
  }

  if (diferencias) {
    return (
      <Ventana titulo="El costo cotizado difiere de la maestra" subtitulo={`${prov.nombre}: ¿actualiza su costo en la maestra de proveedores?`} onCerrar={() => alCerrar(true)} ancho="max-w-3xl">
        <div className="space-y-3 text-xs">
          <p className="text-gray-700">La cotizacion ya quedo guardada. Elija los items cuyo costo en la maestra del proveedor pasa a ser el cotizado.</p>
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="w-8 px-2 py-1.5" />
                <th className="text-left px-2 py-1.5">Item</th>
                <th className="text-right px-2 py-1.5">Costo en maestra</th>
                <th className="text-right px-2 py-1.5">Cotizado</th>
                <th className="text-right px-2 py-1.5">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {diferencias.map((x) => {
                const dif = x.precio - x.costo_actual;
                return (
                  <tr key={x.id_item} className="border-t border-gray-100">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        aria-label={`Actualizar ${x.descripcion}`}
                        disabled={!x.misma_moneda}
                        checked={elegidas.has(x.id_item)}
                        onChange={(e) => {
                          const n = new Set(elegidas);
                          if (e.target.checked) n.add(x.id_item);
                          else n.delete(x.id_item);
                          setElegidas(n);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1">
                      {x.sku && <span className="font-mono text-[10px] text-gray-500 mr-1.5">{x.sku}</span>}
                      {x.descripcion}
                      {x.es_preferente && <span className="ml-1.5 text-[10px] text-amber-700">preferente: recostea paneles y cotizaciones sin pedido</span>}
                      {!x.misma_moneda && <span className="ml-1.5 text-[10px] text-gray-500">moneda distinta ({x.moneda}): no se actualiza aqui</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{dinero(x.costo_actual, x.moneda)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{dinero(x.precio, x.moneda)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${dif > 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {dif > 0 ? "+" : ""}
                      {dinero(dif, x.moneda)} ({x.costo_actual > 0 ? `${dif > 0 ? "+" : ""}${Math.round((dif / x.costo_actual) * 1000) / 10}%` : "nuevo"})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} disabled={pendiente} onClick={() => alCerrar(true)}>No actualizar</button>
            <button type="button" className={BTN_VERDE} disabled={pendiente || elegidas.size === 0} onClick={actualizarMaestra}>
              {pendiente ? "Actualizando..." : `Actualizar ${elegidas.size} costo${elegidas.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </Ventana>
    );
  }

  return (
    <Ventana titulo={`Cotizacion de ${prov.nombre}`} subtitulo="Precio unitario por item; deje en blanco lo que no cotizo" onCerrar={() => alCerrar(false)} ancho="max-w-4xl">
      <div className="space-y-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-5">
          <div>
            <label htmlFor="cz-moneda" className={ROTULO}>Moneda</label>
            <input id="cz-moneda" className={CAMPO} value={cab.moneda} onChange={(e) => setCab({ ...cab, moneda: e.target.value.toUpperCase() })} maxLength={3} />
          </div>
          <div>
            <label htmlFor="cz-plazo" className={ROTULO}>Plazo de entrega (dias)</label>
            <input id="cz-plazo" inputMode="numeric" className={CAMPO} value={cab.plazo_dias} onChange={(e) => setCab({ ...cab, plazo_dias: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div>
            <label htmlFor="cz-cond" className={ROTULO}>Condiciones de pago</label>
            <input id="cz-cond" className={CAMPO} value={cab.condiciones_pago} onChange={(e) => setCab({ ...cab, condiciones_pago: e.target.value })} />
          </div>
          <div>
            <label htmlFor="cz-valida" className={ROTULO}>Valida hasta</label>
            <input id="cz-valida" type="date" className={CAMPO} value={cab.validez} onChange={(e) => setCab({ ...cab, validez: e.target.value })} />
          </div>
          <div>
            <label htmlFor="cz-desc" className={ROTULO}>Descuento (%)</label>
            <input id="cz-desc" inputMode="decimal" className={CAMPO} value={cab.descuento_pct} onChange={(e) => setCab({ ...cab, descuento_pct: e.target.value.replace(",", ".") })} />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5">Item</th>
                <th className="text-right px-3 py-1.5 w-24">Cantidad</th>
                <th className="text-right px-3 py-1.5 w-36">Precio unitario</th>
                <th className="text-right px-3 py-1.5 w-32">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="px-3 py-1">{i.sku && <span className="font-mono text-[10px] text-gray-500 mr-1.5">{i.sku}</span>}{i.descripcion}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{Number(i.cantidad).toLocaleString("es-CL")}</td>
                  <td className="px-3 py-1">
                    <input
                      aria-label={`Precio de ${i.descripcion}`}
                      inputMode="decimal"
                      className={`${CAMPO} text-right ${asignado(i.id) ? "" : "bg-gray-100"}`}
                      disabled={!asignado(i.id)}
                      placeholder={asignado(i.id) ? "" : "sin asignar"}
                      value={valores[i.id] ?? ""}
                      onChange={(e) => setValores({ ...valores, [i.id]: e.target.value })}
                    />
                    <span className="block text-[10px] text-right text-gray-500 mt-0.5">
                      {asignado(i.id) ? `Maestra: ${dinero(maestra.get(`${prov.id}:${i.id}`) ?? 0, cab.moneda)}` : "No lo tiene en su maestra"}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{valorDe(i.id) != null ? dinero(subtotalLinea(Number(i.cantidad), valorDe(i.id)!, cab.moneda), cab.moneda) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ml-auto w-72 text-xs">
          {[
            ["Subtotal", dinero(factura.subtotal, cab.moneda)],
            [rotuloDescuento({ tipo: "pct", valor: Number(cab.descuento_pct) || 0 }), factura.descuento > 0 ? `- ${dinero(factura.descuento, cab.moneda)}` : dinero(0, cab.moneda)],
            ["Subtotal despues del descuento", dinero(factura.subtotalNeto, cab.moneda)],
            [`${impuesto} ${porcentajeImpuesto(ivaPct)}`, dinero(factura.iva, cab.moneda)],
          ].map(([r, v]) => (
            <div key={r} className="flex justify-between py-0.5 border-b border-gray-100">
              <span className="text-gray-600">{r}</span>
              <span className="tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex justify-between py-1 font-semibold">
            <span>TOTAL A PAGAR</span>
            <span className="tabular-nums">{dinero(factura.total, cab.moneda)}</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="cz-notas" className={ROTULO}>Notas</label>
            <input id="cz-notas" className={CAMPO} value={cab.notas} onChange={(e) => setCab({ ...cab, notas: e.target.value })} />
          </div>
          <div>
            <label htmlFor="cz-pdf" className={ROTULO}>Cotizacion del proveedor (PDF, hasta 4 MB)</label>
            <input id="cz-pdf" ref={archivo} type="file" accept="application/pdf,image/*" className="text-xs" />
            {prov.archivo_nombre && <span className="block text-[10px] text-gray-500 mt-0.5">Ya hay un archivo: {prov.archivo_nombre}. Subir otro lo reemplaza.</span>}
          </div>
        </div>
        {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN} onClick={() => alCerrar(false)} disabled={pendiente}>Cancelar</button>
          <button type="button" className={BTN_VERDE} onClick={guardar} disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar cotizacion"}</button>
        </div>
      </div>
    </Ventana>
  );
}

// Abrir una solicitud en dos o mas: cada item se asigna a un grupo y cada grupo sera su propia solicitud.
function VentanaApertura({
  s, items, alCerrar, alAbrir, pendiente,
}: {
  s: Sol;
  items: Item[];
  alCerrar: () => void;
  alAbrir: (grupos: number[][]) => void;
  pendiente: boolean;
}) {
  const [n, setN] = useState(2);
  const [grupo, setGrupo] = useState<Record<number, number>>(() => Object.fromEntries(items.map((i, k) => [i.id, k % 2])));
  const [error, setError] = useState<string | null>(null);
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function abrir() {
    const grupos: number[][] = Array.from({ length: n }, () => []);
    for (const i of items) grupos[Math.min(grupo[i.id] ?? 0, n - 1)].push(i.id);
    if (grupos.some((g) => g.length === 0)) return setError("Cada grupo necesita al menos un item.");
    setError(null);
    alAbrir(grupos);
  }

  return (
    <Ventana titulo={`Abrir ${s.folio}`} subtitulo="Reparta los items: cada grupo sera una solicitud que se adjudica por separado" onCerrar={alCerrar} ancho="max-w-3xl">
      <div className="space-y-3 text-xs">
        <div className="flex items-center gap-2">
          <label htmlFor="ap-n" className={ROTULO + " mb-0"}>Abrir en</label>
          <select id="ap-n" className="border border-gray-300 rounded px-2 py-1 text-xs bg-white" value={n} onChange={(e) => setN(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((k) => (
              <option key={k} value={k}>{k} solicitudes</option>
            ))}
          </select>
          <span className="text-gray-500">({Array.from({ length: n }, (_, k) => `${s.folio}-${letras[k]}`).join(", ")})</span>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-1.5">Item</th>
              <th className="text-right px-3 py-1.5 w-24">Cantidad</th>
              <th className="text-left px-3 py-1.5 w-40">Va a</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-gray-100">
                <td className="px-3 py-1">{i.sku && <span className="font-mono text-[10px] text-gray-500 mr-1.5">{i.sku}</span>}{i.descripcion}</td>
                <td className="px-3 py-1 text-right tabular-nums">{Number(i.cantidad).toLocaleString("es-CL")}</td>
                <td className="px-3 py-1">
                  <select
                    aria-label={`Solicitud de ${i.descripcion}`}
                    className="border border-gray-300 rounded px-2 py-0.5 text-xs w-full bg-white"
                    value={Math.min(grupo[i.id] ?? 0, n - 1)}
                    onChange={(e) => setGrupo({ ...grupo, [i.id]: Number(e.target.value) })}
                  >
                    {Array.from({ length: n }, (_, k) => (
                      <option key={k} value={k}>{`${s.folio}-${letras[k]}`}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-gray-600">Los precios que ya enviaron los proveedores se conservan: no hay que volver a pedirlos.</p>
        {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN} onClick={alCerrar} disabled={pendiente}>Cancelar</button>
          <button type="button" className={BTN_VERDE} onClick={abrir} disabled={pendiente}>{pendiente ? "Abriendo..." : "Abrir solicitud"}</button>
        </div>
      </div>
    </Ventana>
  );
}

// Fecha de entrega en destino y direccion de destino: van en la solicitud y en la orden de compra.
function VentanaCabeceraNecesidad({ idNm, fecha, direccion, modalidad, notas, contacto, alCerrar }: { idNm: number; fecha: string | null; direccion: string | null; modalidad: "Despacho" | "Retiro"; notas: string | null; contacto: { contacto: string; telefono: string; email: string }; alCerrar: (hecho: boolean) => void }) {
  const [f, setF] = useState(fecha ?? "");
  const [d, setD] = useState(direccion ?? "");
  const [n, setN] = useState(notas ?? "");
  const [mod, setMod] = useState<"Despacho" | "Retiro">(modalidad);
  const [c, setC] = useState(contacto);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await actualizarCabeceraNecesidad(idNm, f, mod === "Retiro" ? "" : d, n, c, mod);
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      alCerrar(true);
    });
  }
  return (
    <Ventana titulo="Cabecera de la necesidad" subtitulo="La entrega y la direccion van en las solicitudes y en las ordenes de compra" onCerrar={() => alCerrar(false)} ancho="max-w-2xl">
      <form className="space-y-3 text-xs" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div>
          <label htmlFor="nm-dest-mod" className={ROTULO}>Entrega</label>
          <select id="nm-dest-mod" className="border border-gray-300 rounded px-2 py-1 text-xs bg-white" value={mod} onChange={(e) => setMod(e.target.value as "Despacho" | "Retiro")}>
            <option value="Despacho">Despacho a la bodega de Centro Panel</option>
            <option value="Retiro">Retiro en el proveedor</option>
          </select>
        </div>
        <div>
          <label htmlFor="nm-dest-fecha" className={ROTULO}>Fecha de entrega en destino</label>
          <input id="nm-dest-fecha" type="date" className="border border-gray-300 rounded px-2 py-1 text-xs bg-white" value={f} onChange={(e) => setF(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nm-dest-dir" className={ROTULO}>Direccion de destino</label>
          <textarea id="nm-dest-dir" rows={2} disabled={mod === "Retiro"} placeholder={mod === "Retiro" ? "Retira Centro Panel en el proveedor" : "Si queda vacia, la bodega de Centro Panel"} className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white disabled:bg-gray-100" value={d} onChange={(e) => setD(e.target.value)} maxLength={300} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="nm-dest-contacto" className={ROTULO}>Contacto en destino</label>
            <input id="nm-dest-contacto" className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white" value={c.contacto} onChange={(e) => setC({ ...c, contacto: e.target.value })} maxLength={120} />
          </div>
          <div>
            <label htmlFor="nm-dest-tel" className={ROTULO}>Telefono</label>
            <input id="nm-dest-tel" className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white" value={c.telefono} onChange={(e) => setC({ ...c, telefono: e.target.value })} maxLength={40} />
          </div>
          <div>
            <label htmlFor="nm-dest-email" className={ROTULO}>Correo</label>
            <input id="nm-dest-email" type="email" className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} maxLength={120} />
          </div>
        </div>
        <div>
          <label htmlFor="nm-dest-notas" className={ROTULO}>Notas</label>
          <textarea id="nm-dest-notas" rows={3} className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white" value={n} onChange={(e) => setN(e.target.value)} maxLength={500} />
        </div>
        <p className="text-gray-600">Las solicitudes con cabecera propia y las ordenes de compra que ya se generaron no cambian: se corrigen en cada una.</p>
        {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN} onClick={() => alCerrar(false)} disabled={pendiente}>Cancelar</button>
          <button type="submit" className={BTN_VERDE} disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </Ventana>
  );
}

// Cabecera propia de una solicitud: entrega, direccion y notas. Vacias, valen las de la necesidad.
function VentanaCabeceraSolicitud({ s, idNm, destinoNm, alCerrar }: { s: Sol; idNm: number; destinoNm: { fecha: string | null; direccion: string | null }; alCerrar: (hecho: boolean) => void }) {
  const [f, setF] = useState(s.fecha_entrega ?? "");
  const [d, setD] = useState(s.direccion_destino ?? "");
  const [n, setN] = useState(s.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await actualizarCabeceraSolicitud(idNm, s.id, f, d, n);
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      alCerrar(true);
    });
  }
  return (
    <Ventana titulo={`Cabecera de ${s.folio}`} subtitulo="Lo que se deja vacio toma el valor de la necesidad" onCerrar={() => alCerrar(false)} ancho="max-w-lg">
      <form className="space-y-3 text-xs" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div>
          <label htmlFor="sc-fecha" className={ROTULO}>Fecha de entrega en destino</label>
          <input id="sc-fecha" type="date" className="border border-gray-300 rounded px-2 py-1 text-xs bg-white" value={f} onChange={(e) => setF(e.target.value)} />
          <span className="ml-2 text-gray-500">{destinoNm.fecha ? `Necesidad: ${fmtFecha(destinoNm.fecha)}` : ""}</span>
        </div>
        <div>
          <label htmlFor="sc-dir" className={ROTULO}>Direccion de destino</label>
          <textarea id="sc-dir" rows={2} className={CAMPO} value={d} onChange={(e) => setD(e.target.value)} maxLength={300} placeholder={destinoNm.direccion ?? ""} />
        </div>
        <div>
          <label htmlFor="sc-notas" className={ROTULO}>Notas para el proveedor</label>
          <textarea id="sc-notas" rows={3} className={CAMPO} value={n} onChange={(e) => setN(e.target.value)} maxLength={500} />
        </div>
        {s.estado === "En cotizacion" && <p className="text-amber-700">La solicitud ya se envio: si cambia algo, vuelva a enviarla a los proveedores.</p>}
        {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN} onClick={() => alCerrar(false)} disabled={pendiente}>Cancelar</button>
          <button type="submit" className="bg-verde text-white text-[11px] font-semibold px-2.5 py-1 rounded disabled:opacity-50" disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </Ventana>
  );
}

function VentanaAgregarItems({ idNm, idPais, puedeCrearMateria, alCerrar }: { idNm: number; idPais: number; puedeCrearMateria: boolean; alCerrar: (hecho: boolean) => void }) {
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<ItemBuscado[]>([]);
  const [elegidos, setElegidos] = useState<{ it: ItemBuscado; cantidad: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [creandoMateria, setCreandoMateria] = useState(false);
  const ultima = useRef(0);

  function elegir(it: ItemBuscado) {
    setElegidos((prev) => (prev.some((e) => e.it.id === it.id && e.it.tipo === it.tipo) ? prev : [...prev, { it, cantidad: "1" }]));
    setBusca("");
    setEncontrados([]);
  }

  useEffect(() => {
    if (busca.trim().length < 2) return setEncontrados([]);
    const n = ++ultima.current;
    const t = setTimeout(async () => {
      const r = await buscarItemsCompra(busca, idPais);
      if (n === ultima.current) setEncontrados(r);
    }, 250);
    return () => clearTimeout(t);
  }, [busca, idPais]);

  function guardar() {
    setError(null);
    const items = elegidos.map((e) => ({
      id_materia_prima: e.it.tipo === "materia_prima" ? e.it.id : null,
      id_producto: e.it.tipo === "producto" ? e.it.id : null,
      cantidad: Number(e.cantidad.replace(",", ".")),
    }));
    if (items.length === 0) return setError("Agregue al menos un item.");
    if (items.some((i) => !(i.cantidad > 0))) return setError("Cada item necesita una cantidad mayor que cero.");
    empezar(async () => {
      const r = await agregarItems(idNm, items);
      if (!r.ok) setError(r.error ?? "No se pudo agregar.");
      else alCerrar(true);
    });
  }

  return (
    <Ventana titulo="Agregar items" subtitulo="Quedan sin solicitud hasta que cree una con ellos" onCerrar={() => alCerrar(false)} ancho="max-w-2xl">
      <div className="space-y-3 text-xs">
        <div className="relative">
          <label htmlFor="ai-busca" className={ROTULO}>Materia prima o producto</label>
          <input id="ai-busca" className={CAMPO} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nombre o SKU (minimo 2 letras)" autoComplete="off" autoFocus />
          {busca.trim().length >= 2 && (encontrados.length > 0 || puedeCrearMateria) && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow max-h-56 overflow-y-auto">
              {encontrados.map((it) => (
                <li key={`${it.tipo}-${it.id}`}>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 hover:bg-crema"
                    onClick={() => elegir(it)}
                  >
                    {it.descripcion} <span className="text-gray-500">· {it.tipo === "producto" ? "producto" : "materia prima"}</span>
                  </button>
                </li>
              ))}
              {puedeCrearMateria && (
                <li className="border-t border-gray-200">
                  <button type="button" className="w-full text-left px-2 py-1.5 text-verde font-semibold hover:bg-crema" onClick={() => setCreandoMateria(true)}>
                    No esta? Crear la materia prima &laquo;{busca.trim()}&raquo;
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
        {creandoMateria && (
          <VentanaNuevaMateria
            idPais={idPais}
            nombreInicial={busca.trim()}
            alCerrar={() => setCreandoMateria(false)}
            alCrear={(item) => {
              setCreandoMateria(false);
              elegir(item);
            }}
          />
        )}
        {elegidos.map((e, i) => (
          <div key={`${e.it.tipo}-${e.it.id}`} className="flex items-center gap-2">
            <span className="flex-1">{e.it.descripcion}</span>
            <input
              aria-label={`Cantidad de ${e.it.descripcion}`}
              inputMode="decimal"
              className="border border-gray-300 rounded px-2 py-1 text-xs w-24 text-right bg-white"
              value={e.cantidad}
              onChange={(ev) => setElegidos(elegidos.map((x, j) => (j === i ? { ...x, cantidad: ev.target.value } : x)))}
            />
            <button type="button" className="text-red-700 underline" onClick={() => setElegidos(elegidos.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
        {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN} onClick={() => alCerrar(false)} disabled={pendiente}>Cancelar</button>
          <button type="button" className={BTN_VERDE} onClick={guardar} disabled={pendiente}>{pendiente ? "Agregando..." : "Agregar"}</button>
        </div>
      </div>
    </Ventana>
  );
}
