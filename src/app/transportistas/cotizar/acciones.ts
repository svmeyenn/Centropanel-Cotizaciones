"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { cargarCarga, resumirCarga } from "@/lib/carga";

async function puedeAdministrar() {
  const v = await requerirVendedor();
  return v.puede_editar || tienePerfilAdmin(v) ? null : "Su perfil no permite cotizar fletes.";
}

export interface DatosNuevaCotizacion {
  idPedido: number | null;
  idOc: number | null;
  origen: string;
  destino: string;
  fechaRequerida: string;
  notas: string;
  transportistas: number[];
}

// La carga se vuelve a calcular aqui desde los catalogos: lo que viaja al transportista no depende de lo que mande el navegador.
export async function crearCotizacionFlete(d: DatosNuevaCotizacion) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  if ((d.idPedido == null) === (d.idOc == null)) return { error: "La cotizacion es de un pedido o de una orden de compra." };
  if (d.transportistas.length === 0) return { error: "Elija al menos un transportista." };
  const v = await requerirVendedor();
  const supabase = await createClient();

  const { data: doc } = d.idPedido != null
    ? await supabase.from("pedidos").select("id_pais").eq("id", d.idPedido).single()
    : await supabase.from("ordenes_compra").select("id_pais").eq("id", d.idOc!).single();
  if (!doc) return { error: "El documento no existe." };

  const lineas = await cargarCarga(supabase, d.idPedido != null ? { pedido: d.idPedido } : { oc: d.idOc! });
  const r = resumirCarga(lineas);
  const resumen = lineas
    .slice(0, 12)
    .map((l) => `${l.unidades.toLocaleString("es-CL")} x ${l.descripcion}`)
    .join("\n") + (lineas.length > 12 ? `\n... y ${lineas.length - 12} items mas` : "");

  const { data: cot, error } = await supabase
    .from("flete_cotizaciones")
    .insert({
      id_pais: doc.id_pais,
      id_pedido: d.idPedido,
      id_oc: d.idOc,
      origen: d.origen.trim() || null,
      destino: d.destino.trim() || null,
      fecha_requerida: d.fechaRequerida || null,
      peso_kg: r.sinPeso === r.lineas ? null : Math.round(r.pesoKg * 10) / 10,
      volumen_m3: r.sinMedidas === r.lineas ? null : Math.round(r.volumenM3 * 100) / 100,
      largo_max_m: r.largoMaxM > 0 ? Math.round(r.largoMaxM * 100) / 100 : null,
      resumen_carga: resumen || null,
      notas: d.notas.trim() || null,
      creado_por: v.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: e2 } = await supabase
    .from("flete_cotizacion_respuestas")
    .insert(d.transportistas.map((t) => ({ id_cotizacion: cot.id, id_transportista: t })));
  if (e2) return { error: e2.message };

  revalidatePath("/transportistas/cotizar");
  return { ok: true, id: Number(cot.id) };
}

export async function agregarTransportistaCotizacion(idCot: number, idTransportista: number) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("flete_cotizacion_respuestas").insert({ id_cotizacion: idCot, id_transportista: idTransportista });
  if (error) return { error: error.code === "23505" ? "Ese transportista ya esta en la cotizacion." : error.message };
  revalidatePath(`/transportistas/cotizar/${idCot}`);
  return { ok: true };
}

export interface DatosRespuesta {
  idVehiculo: number | null;
  monto: number | null;
  moneda: string;
  plazoDias: number | null;
  validaHasta: string;
  notas: string;
  noCotiza: boolean;
}

// Lo que contesto el transportista. Con valor queda recibida; si dijo que no puede, rechazada.
export async function guardarRespuestaFlete(idCot: number, idResp: number, d: DatosRespuesta) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  if (!d.noCotiza && d.monto == null) return { error: "Indique el valor que ofrecio, o marque que no cotiza." };
  if (d.monto != null && (!Number.isFinite(d.monto) || d.monto < 0)) return { error: "El valor debe ser un monto desde cero." };
  if (d.plazoDias != null && (!Number.isInteger(d.plazoDias) || d.plazoDias < 0)) return { error: "El plazo son dias enteros." };
  const supabase = await createClient();
  const { data: actual } = await supabase.from("flete_cotizacion_respuestas").select("estado").eq("id", idResp).eq("id_cotizacion", idCot).single();
  if (!actual) return { error: "La respuesta no existe." };
  if (actual.estado === "Adjudicada") return { error: "Esta respuesta ya fue adjudicada." };
  const { error } = await supabase
    .from("flete_cotizacion_respuestas")
    .update({
      id_vehiculo: d.noCotiza ? null : d.idVehiculo,
      monto: d.noCotiza ? null : d.monto,
      moneda: d.noCotiza ? null : d.moneda.trim().toUpperCase() || null,
      plazo_dias: d.noCotiza ? null : d.plazoDias,
      valida_hasta: d.noCotiza ? null : d.validaHasta || null,
      notas: d.notas.trim() || null,
      estado: d.noCotiza ? "Rechazada" : "Recibida",
      recibida_en: new Date().toISOString(),
    })
    .eq("id", idResp)
    .eq("id_cotizacion", idCot);
  if (error) return { error: error.message };
  revalidatePath(`/transportistas/cotizar/${idCot}`);
  return { ok: true };
}

export async function adjudicarFlete(idCot: number, idResp: number) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.rpc("flete_adjudicar", { p_respuesta: idResp });
  if (error) return { error: error.message };
  revalidatePath(`/transportistas/cotizar/${idCot}`);
  revalidatePath("/transportistas/cotizar");
  revalidatePath("/pedidos");
  revalidatePath("/compras");
  return { ok: true };
}

export async function cancelarCotizacionFlete(idCot: number) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("flete_cotizaciones").update({ estado: "Cancelada" }).eq("id", idCot).eq("estado", "Abierta");
  if (error) return { error: error.message };
  revalidatePath(`/transportistas/cotizar/${idCot}`);
  revalidatePath("/transportistas/cotizar");
  return { ok: true };
}
