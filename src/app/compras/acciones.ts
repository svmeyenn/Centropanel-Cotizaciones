"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

function refrescar(id?: number) {
  revalidatePath("/compras");
  if (id) revalidatePath(`/compras/${id}`);
}

export async function crearOC(d: {
  id_proyecto: number;
  id_partida: number | null;
  id_proveedor: number | null;
  id_solicitud: number | null;
}) {
  await requerirVendedor();
  const supabase = await createClient();
  if (d.id_solicitud) {
    const { data, error } = await supabase.rpc("oc_desde_solicitud", {
      p_solicitud: d.id_solicitud,
      p_proyecto: d.id_proyecto,
      p_partida: d.id_partida,
    });
    if (error) return { error: error.message };
    refrescar();
    return { ok: true, id: Number(data) };
  }
  if (!d.id_proveedor) return { error: "Elija el proveedor." };
  const { data: py } = await supabase
    .from("proyectos")
    .select("id_pais, paises(moneda_base)")
    .eq("id_proyecto", d.id_proyecto)
    .single();
  if (!py) return { error: "El proyecto no existe." };
  const pais = (Array.isArray(py.paises) ? py.paises[0] : py.paises) as { moneda_base: string } | null;
  const { data, error } = await supabase
    .from("ordenes_compra")
    .insert({
      id_pais: py.id_pais,
      id_proyecto: d.id_proyecto,
      id_partida: d.id_partida,
      id_proveedor: d.id_proveedor,
      moneda: pais?.moneda_base ?? "CLP",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  refrescar();
  return { ok: true, id: Number(data.id) };
}

export async function guardarCabeceraOC(
  id: number,
  d: {
    id_partida: number | null;
    fecha_entrega: string;
    direccion_entrega: string;
    contacto_entrega: string;
    telefono_entrega: string;
    email_entrega: string;
    condiciones_pago: string;
    notas: string;
    descuento_tipo: "pct" | "monto";
    descuento_valor: number;
  }
) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("ordenes_compra")
    .update({
      id_partida: d.id_partida,
      fecha_entrega: d.fecha_entrega || null,
      direccion_entrega: d.direccion_entrega.trim() || null,
      contacto_entrega: d.contacto_entrega.trim() || null,
      telefono_entrega: d.telefono_entrega.trim() || null,
      email_entrega: d.email_entrega.trim() || null,
      condiciones_pago: d.condiciones_pago.trim() || null,
      descuento_tipo: d.descuento_tipo,
      descuento_valor: Math.max(0, Number(d.descuento_valor) || 0),
      notas: d.notas.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  refrescar(id);
  return { ok: true };
}

export async function guardarLineaOC(
  idOc: number,
  idLinea: number | null,
  d: { descripcion: string; unidades: number; costo_unitario: number }
) {
  await requerirVendedor();
  if (!d.descripcion.trim()) return { error: "Indique la descripcion." };
  if (!(d.unidades > 0)) return { error: "Las unidades deben ser mayores que cero." };
  if (!(d.costo_unitario >= 0)) return { error: "El costo no puede ser negativo." };
  const supabase = await createClient();
  const fila = { descripcion: d.descripcion.trim(), unidades: d.unidades, costo_unitario: d.costo_unitario };
  if (idLinea) {
    const { error } = await supabase.from("oc_detalle").update(fila).eq("id", idLinea);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from("oc_detalle")
      .select("id", { count: "exact", head: true })
      .eq("id_oc", idOc);
    const { error } = await supabase.from("oc_detalle").insert({ ...fila, id_oc: idOc, orden: (count ?? 0) + 1 });
    if (error) return { error: error.message };
  }
  refrescar(idOc);
  return { ok: true };
}

export async function borrarLineaOC(idOc: number, idLinea: number) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.from("oc_detalle").delete().eq("id", idLinea);
  if (error) return { error: error.message };
  refrescar(idOc);
  return { ok: true };
}

async function llamar(fn: string, args: Record<string, unknown>, idOc: number) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  refrescar(idOc);
  return { ok: true };
}

export async function enviarAprobacion(id: number) {
  return llamar("oc_enviar_aprobacion", { p_oc: id }, id);
}
export async function aprobarOC(id: number) {
  return llamar("oc_aprobar", { p_oc: id }, id);
}
export async function rechazarOC(id: number, motivo: string) {
  return llamar("oc_rechazar", { p_oc: id, p_motivo: motivo }, id);
}
export async function marcarEnviadaOC(id: number) {
  return llamar("oc_marcar_enviada", { p_oc: id }, id);
}
export async function anularOC(id: number) {
  return llamar("oc_anular", { p_oc: id }, id);
}
export async function recibirOC(id: number, lineas: { id_detalle: number; cantidad: number }[], guia: string) {
  return llamar("oc_recibir", { p_oc: id, p_lineas: lineas, p_guia: guia }, id);
}
export async function facturarOC(id: number, numero: string, fecha: string, monto: number) {
  return llamar("oc_facturar", { p_oc: id, p_numero: numero, p_fecha: fecha || null, p_monto: monto }, id);
}

export async function borrarOC(id: number) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.from("ordenes_compra").delete().eq("id", id);
  if (error) return { error: error.message };
  refrescar();
  return { ok: true };
}

// El pago se solicita como cualquier egreso: queda Pendiente y sale por la
// pantalla de Egresos, donde lo paga quien tiene ese permiso. La base solo
// deja ligarlo a una orden ya autorizada.
export async function solicitarPagoOC(
  idOc: number,
  d: { monto: number; id_cuenta: number; id_categoria: number; documento: string }
) {
  const v = await requerirVendedor();
  if (!(d.monto > 0)) return { error: "Indique el monto." };
  if (!d.id_cuenta || !d.id_categoria) return { error: "Elija la cuenta y la categoria." };
  const supabase = await createClient();
  const { data: oc } = await supabase
    .from("ordenes_compra")
    .select("id_pais, id_proyecto, id_proveedor, num_oc, entidades(razon_social)")
    .eq("id", idOc)
    .single();
  if (!oc) return { error: "La orden no existe." };
  const prov = (Array.isArray(oc.entidades) ? oc.entidades[0] : oc.entidades) as { razon_social: string } | null;
  const { error } = await supabase.from("movimientos").insert({
    id_pais: oc.id_pais,
    tipo: "Egreso",
    monto: d.monto,
    id_cuenta: d.id_cuenta,
    id_categoria: d.id_categoria,
    id_proyecto: oc.id_proyecto,
    id_interlocutor: oc.id_proveedor,
    origen_destino: prov?.razon_social ?? null,
    documento: d.documento.trim() || null,
    comentario: `Pago ${oc.num_oc}`,
    estado_pago: "Pendiente",
    id_vendedor: v.id,
    id_oc: idOc,
  });
  if (error) return { error: error.message };
  refrescar(idOc);
  revalidatePath("/egresos");
  return { ok: true };
}

// Cabecera de una orden ya emitida: entrega, direccion y notas.
export async function actualizarCabeceraOC(
  id: number,
  d: { fecha_entrega: string; direccion_entrega: string; notas: string; contacto_entrega: string; telefono_entrega: string; email_entrega: string }
) {
  await requerirVendedor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("oc_actualizar_cabecera", {
    p_oc: id,
    p_fecha: d.fecha_entrega || null,
    p_direccion: d.direccion_entrega,
    p_notas: d.notas,
    p_contacto: d.contacto_entrega,
    p_telefono: d.telefono_entrega,
    p_email: d.email_entrega,
  });
  if (error) return { error: error.message };
  refrescar(id);
  return { ok: true };
}
