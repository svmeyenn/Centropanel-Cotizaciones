import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { leerParametros, type Parametros } from "@/lib/parametros";
import { uno } from "@/lib/relaciones";
import { impuestoDelPais } from "@/lib/factura";
import { monedaDelPais } from "@/lib/formato";
import { numerosSolicitud } from "@/lib/numerosSolicitud";
import type { EmisorDoc, OrdenDoc, ProveedorDoc, SolicitudDoc } from "@/lib/pdf/ComprasPdf";

// Arma, desde la base, los datos de la solicitud de cotizacion y de la orden de compra que van a un proveedor.
// Los lee con la sesion de quien pide: lo que no ve, no sale. Los usan el PDF, el correo y el WhatsApp.

export interface ProveedorNm {
  id: number;
  id_proveedor: number;
  nombre: string;
  razon_social: string | null;
  rut: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  contacto: string | null;
  estado: string;
}

async function emisor(): Promise<EmisorDoc> {
  const v = await requerirVendedor();
  return { nombre: v.nombre, cargo: v.cargo, email: v.email, telefono: v.telefono };
}

function proveedorDoc(p: { nombre: string; razon_social?: string | null; rut?: string | null; contacto?: string | null; email?: string | null; telefono?: string | null; direccion?: string | null }): ProveedorDoc {
  return { nombre: p.razon_social || p.nombre, rut: p.rut, contacto: p.contacto, email: p.email, telefono: p.telefono, direccion: p.direccion };
}

export interface SolicitudParaEnviar {
  d: SolicitudDoc;
  p: Parametros;
  idNecesidad: number;
  idPais: number;
  estadoSc: string;
  proveedor: ProveedorNm;
}

export async function leerSolicitudDoc(idNm: number, idSc: number, idPart: number): Promise<SolicitudParaEnviar | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nm_detalle", { p_nm: idNm });
  if (error || !data) return null;
  const det = data as {
    nm: { folio: string; id_pais: number; proyecto: string | null; fecha_requerida: string | null; direccion_destino: string | null; contacto_destino: string | null; telefono_destino: string | null; email_destino: string | null; notas: string | null; proyecto_cliente?: string | null; iva_pct: number; modalidad_entrega?: "Despacho" | "Retiro" };
    items: { id: number; sku: string | null; descripcion: string; unidad: string | null; cantidad: number; nota: string | null; id_sc: number | null }[];
    proveedores: ProveedorNm[];
    solicitudes: { id: number; folio: string; estado: string; fecha_entrega: string | null; direccion_destino: string | null; notas: string | null }[];
    maestra: { p: number; i: number; c: number; m: string | null }[];
  };
  const sc = det.solicitudes.find((x) => x.id === idSc);
  // idPart = 0: el PDF sin destinatario, para quien quiere verlo o mandarlo por su cuenta.
  const prov: ProveedorNm | undefined =
    idPart === 0
      ? { id: 0, id_proveedor: 0, nombre: "(Proveedor)", razon_social: null, rut: null, direccion: null, email: null, telefono: null, contacto: null, estado: "Invitado" }
      : det.proveedores.find((x) => x.id === idPart);
  if (!sc || !prov) return null;
  // Con destinatario, solo salen los items que ese proveedor tiene asignados en su maestra, valorizados con su costo.
  // Sin destinatario no hay maestra que consultar: sale la lista sin valorizar.
  const costos = new Map((det.maestra ?? []).filter((x) => x.p === idPart).map((x) => [x.i, { c: Number(x.c), m: x.m }]));
  const items = det.items.filter((i) => i.id_sc === idSc && (idPart === 0 || costos.has(i.id)));
  const moneda = [...costos.values()].find((x) => x.m)?.m ?? monedaDelPais(Number(det.nm.id_pais));
  // El numero propio de esta solicitud para este proveedor; sin destinatario, el de la solicitud.
  const numero = (await numerosSolicitud([{ idSc, idPart }], true)).get(`${idSc}:${idPart}`) ?? sc.folio;
  const p = await leerParametros(Number(det.nm.id_pais));
  return {
    d: {
      folio: numero,
      folioNecesidad: det.nm.folio,
      fecha: new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" }),
      proveedor: proveedorDoc(prov),
      obra: det.nm.proyecto,
      fechaEntrega: sc.fecha_entrega ?? det.nm.fecha_requerida,
      direccionDestino: det.nm.modalidad_entrega === "Retiro" ? null : sc.direccion_destino ?? det.nm.direccion_destino,
      modalidad: det.nm.modalidad_entrega ?? "Despacho",
      contactoDestino: { nombre: det.nm.contacto_destino, telefono: det.nm.telefono_destino, email: det.nm.email_destino },
      notas: [det.nm.notas, sc.notas].filter(Boolean).join("\n") || null,
      impuesto: { nombre: impuestoDelPais(Number(det.nm.id_pais)), pct: Number(det.nm.iva_pct ?? 0) },
      moneda,
      valorizada: idPart > 0,
      items: items.map((i) => ({ sku: i.sku, descripcion: i.descripcion, unidad: i.unidad, cantidad: Number(i.cantidad), nota: i.nota, precio: idPart > 0 && (costos.get(i.id)?.c ?? 0) > 0 ? costos.get(i.id)!.c : null })),
      emisor: await emisor(),
    },
    p,
    idNecesidad: idNm,
    idPais: Number(det.nm.id_pais),
    estadoSc: sc.estado,
    proveedor: prov,
  };
}

export interface OrdenParaEnviar {
  d: OrdenDoc;
  p: Parametros;
  idPais: number;
  // La necesidad de la que salio, si salio de una.
  idNecesidad: number | null;
  idSc: number | null;
  idParticipante: number | null;
  emailProveedor: string | null;
  telefonoProveedor: string | null;
}

export async function leerOrdenDoc(idOc: number): Promise<OrdenParaEnviar | null> {
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("ordenes_compra")
    .select("*, proyectos(nombre, cliente, direccion), entidades(razon_social, nombre_referencia, rut, contacto, email, telefono, direccion)")
    .eq("id", idOc)
    .single();
  if (!o) return null;
  const { data: lineas } = await supabase.from("oc_detalle").select("sku, descripcion, unidades, costo_unitario").eq("id_oc", idOc).order("orden").order("id");
  const prov = uno<{ razon_social: string; nombre_referencia: string | null; rut: string | null; contacto: string | null; email: string | null; telefono: string | null; direccion: string | null }>(o.entidades);
  const proy = uno<{ nombre: string; cliente: string | null; direccion: string | null }>(o.proyectos);
  const { data: sc } = await supabase.from("solicitudes_cotizacion").select("id, id_necesidad, id_participante").eq("id_oc", idOc).maybeSingle();
  const p = await leerParametros(Number(o.id_pais));
  return {
    d: {
      numero: o.num_oc,
      fecha: o.fecha,
      estado: o.estado,
      aprobada: ["Aprobada", "Enviada", "Recibida parcial", "Recibida", "Facturada", "Pagada"].includes(o.estado),
      moneda: o.moneda,
      proveedor: proveedorDoc({ nombre: prov?.nombre_referencia ?? "", razon_social: prov?.razon_social, rut: prov?.rut, contacto: prov?.contacto, email: prov?.email, telefono: prov?.telefono, direccion: prov?.direccion }),
      obra: proy?.nombre ?? null,
      fechaEntrega: o.fecha_entrega,
      direccionDestino: o.modalidad_entrega === "Retiro" ? null : o.direccion_entrega || proy?.direccion || null,
      modalidad: (o.modalidad_entrega as "Despacho" | "Retiro") ?? "Despacho",
      contactoDestino: { nombre: o.contacto_entrega, telefono: o.telefono_entrega, email: o.email_entrega },
      condicionesPago: o.condiciones_pago,
      notas: o.notas,
      total: Number(o.total),
      subtotal: Number(o.subtotal),
      descuento: { tipo: (o.descuento_tipo as "pct" | "monto") ?? "pct", valor: Number(o.descuento_valor ?? 0), monto: Number(o.descuento_monto ?? 0) },
      subtotalNeto: Number(o.subtotal_neto),
      impuesto: { nombre: impuestoDelPais(Number(o.id_pais)), pct: Number(o.iva_pct ?? 0), monto: Number(o.iva_monto ?? 0) },
      lineas: (lineas ?? []).map((l) => ({ sku: l.sku as string | null, descripcion: l.descripcion, unidades: Number(l.unidades), costo: Number(l.costo_unitario) })),
      emisor: await emisor(),
    },
    p,
    idPais: Number(o.id_pais),
    idNecesidad: sc ? Number(sc.id_necesidad) : null,
    idSc: sc ? Number(sc.id) : null,
    idParticipante: sc?.id_participante ? Number(sc.id_participante) : null,
    emailProveedor: prov?.email ?? null,
    telefonoProveedor: prov?.telefono ?? null,
  };
}
