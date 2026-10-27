import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { leerParametros, type Parametros } from "@/lib/parametros";
import { uno } from "@/lib/relaciones";
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
    nm: { folio: string; id_pais: number; proyecto: string | null; fecha_requerida: string | null; direccion_destino: string | null; notas: string | null };
    items: { id: number; descripcion: string; unidad: string | null; cantidad: number; nota: string | null; id_sc: number | null }[];
    proveedores: ProveedorNm[];
    solicitudes: { id: number; folio: string; estado: string }[];
  };
  const sc = det.solicitudes.find((x) => x.id === idSc);
  const prov = det.proveedores.find((x) => x.id === idPart);
  if (!sc || !prov) return null;
  const items = det.items.filter((i) => i.id_sc === idSc);
  const p = await leerParametros(Number(det.nm.id_pais));
  return {
    d: {
      folio: sc.folio,
      folioNecesidad: det.nm.folio,
      fecha: new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" }),
      proveedor: proveedorDoc(prov),
      obra: det.nm.proyecto,
      fechaEntrega: det.nm.fecha_requerida,
      direccionDestino: det.nm.direccion_destino,
      notas: det.nm.notas,
      items: items.map((i) => ({ descripcion: i.descripcion, unidad: i.unidad, cantidad: Number(i.cantidad), nota: i.nota })),
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
    .select("*, proyectos(nombre, direccion), entidades(razon_social, nombre_referencia, rut, contacto, email, telefono, direccion)")
    .eq("id", idOc)
    .single();
  if (!o) return null;
  const { data: lineas } = await supabase.from("oc_detalle").select("descripcion, unidades, costo_unitario").eq("id_oc", idOc).order("orden").order("id");
  const prov = uno<{ razon_social: string; nombre_referencia: string | null; rut: string | null; contacto: string | null; email: string | null; telefono: string | null; direccion: string | null }>(o.entidades);
  const proy = uno<{ nombre: string; direccion: string | null }>(o.proyectos);
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
      direccionDestino: o.direccion_entrega || proy?.direccion || null,
      condicionesPago: o.condiciones_pago,
      notas: o.notas,
      total: Number(o.total),
      lineas: (lineas ?? []).map((l) => ({ descripcion: l.descripcion, unidades: Number(l.unidades), costo: Number(l.costo_unitario) })),
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
