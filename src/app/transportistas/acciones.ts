"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";

// Los transportistas son proveedores con una marca mas. Quien puede modificar pedidos
// y ordenes de compra, o es administrador, administra los transportistas: es la misma
// regla que aplica la base.
async function puedeAdministrar() {
  const v = await requerirVendedor();
  return v.puede_editar || tienePerfilAdmin(v) ? null : "Su perfil no permite modificar transportistas.";
}

export interface DatosTransportista {
  razon_social: string;
  rut: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  cobertura: string;
  notas: string;
  id_pais?: number | null;
  activo?: boolean;
}

function validarTransportista(d: DatosTransportista) {
  if (!d.razon_social.trim()) return "Indique la razon social.";
  if (!d.rut.trim()) return "Indique el RUT o documento de identidad.";
  if (!d.telefono.trim() && !d.email.trim()) return "Indique al menos un telefono o un correo de contacto.";
  return null;
}

export async function crearTransportista(d: DatosTransportista) {
  const err = (await puedeAdministrar()) ?? validarTransportista(d);
  if (err) return { error: err };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .insert({
      razon_social: d.razon_social.trim(),
      nombre_referencia: d.razon_social.trim(),
      rut: d.rut.trim(),
      contacto: d.contacto.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      direccion: d.direccion.trim(),
      ...(d.id_pais ? { id_pais: d.id_pais } : {}),
    })
    .select("id_entidad")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "Ya existe una empresa con esa razon social." : error.message };
  }
  const { error: eTipos } = await supabase.from("entidad_tipos").insert([
    { id_entidad: data.id_entidad, tipo: "proveedor" },
    { id_entidad: data.id_entidad, tipo: "transportista" },
  ]);
  if (eTipos) return { error: eTipos.message };
  const { error: eDatos } = await supabase
    .from("transportistas")
    .insert({ id_entidad: data.id_entidad, cobertura: d.cobertura.trim() || null, notas: d.notas.trim() || null });
  if (eDatos) return { error: eDatos.message };
  revalidatePath("/transportistas");
  return { ok: true, id: Number(data.id_entidad) };
}

// Un proveedor que ya existe y que tambien transporta: no se duplica, se le suma la marca.
export async function marcarProveedorTransportista(idEntidad: number) {
  try {
    const err = await puedeAdministrar();
    if (err) return { error: err };
    const supabase = await createClient();
    const { error } = await supabase.from("entidad_tipos").upsert({ id_entidad: idEntidad, tipo: "transportista" });
    if (error) return { error: `entidad_tipos: ${error.message}` };
    const { error: e2 } = await supabase.from("transportistas").upsert({ id_entidad: idEntidad });
    if (e2) return { error: `transportistas: ${e2.message}` };
    revalidatePath("/transportistas");
    return { ok: true };
  } catch (e) {
    return { error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function actualizarTransportista(id: number, d: DatosTransportista) {
  const err = (await puedeAdministrar()) ?? validarTransportista(d);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase
    .from("entidades")
    .update({
      razon_social: d.razon_social.trim(),
      rut: d.rut.trim(),
      contacto: d.contacto.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      direccion: d.direccion.trim(),
      activo: d.activo ?? true,
    })
    .eq("id_entidad", id);
  if (error) {
    return { error: error.code === "23505" ? "Ya existe otra empresa con esa razon social." : error.message };
  }
  const { error: e2 } = await supabase
    .from("transportistas")
    .upsert({ id_entidad: id, cobertura: d.cobertura.trim() || null, notas: d.notas.trim() || null, actualizado_en: new Date().toISOString() });
  if (e2) return { error: e2.message };
  revalidatePath("/transportistas");
  revalidatePath(`/transportistas/${id}`);
  return { ok: true };
}

export const TIPOS_VEHICULO = ["Camioneta", "Camion", "Camion con pluma", "Semirremolque", "Otro"] as const;

export interface DatosVehiculo {
  tipo: string;
  patente: string;
  descripcion: string;
  capacidad_kg: number | null;
  capacidad_m3: number | null;
  largo_carga_m: number | null;
  activo: boolean;
  notas: string;
}

export async function guardarVehiculo(idEntidad: number, id: number | null, d: DatosVehiculo) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  if (!(TIPOS_VEHICULO as readonly string[]).includes(d.tipo)) return { error: "Elija el tipo de vehiculo." };
  if (!d.patente.trim()) return { error: "Indique la patente." };
  for (const [n, t] of [[d.capacidad_kg, "La capacidad"], [d.capacidad_m3, "El volumen"], [d.largo_carga_m, "El largo de carga"]] as const) {
    if (n != null && (!Number.isFinite(n) || n < 0)) return { error: `${t} debe ser un numero desde cero.` };
  }
  const fila = {
    id_entidad: idEntidad,
    tipo: d.tipo,
    patente: d.patente.trim().toUpperCase(),
    descripcion: d.descripcion.trim() || null,
    capacidad_kg: d.capacidad_kg,
    capacidad_m3: d.capacidad_m3,
    largo_carga_m: d.largo_carga_m,
    activo: d.activo,
    notas: d.notas.trim() || null,
  };
  const supabase = await createClient();
  const { error } = id == null
    ? await supabase.from("transporte_vehiculos").insert(fila)
    : await supabase.from("transporte_vehiculos").update(fila).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Ese transportista ya tiene un vehiculo con esa patente." : error.message };
  revalidatePath(`/transportistas/${idEntidad}`);
  return { ok: true };
}

export const TIPOS_COBRO = ["Viaje", "Por km", "Por dia", "Por hora"] as const;

export interface DatosTarifa {
  id_vehiculo: number | null; // vacio: tarifa general del transportista
  origen: string;
  destino: string;
  tipo_cobro: string;
  monto: number;
  moneda: string;
  vigente_desde: string;
  vigente_hasta: string;
  activa: boolean;
  notas: string;
}

export async function guardarTarifa(idEntidad: number, id: number | null, d: DatosTarifa) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  if (!(TIPOS_COBRO as readonly string[]).includes(d.tipo_cobro)) return { error: "Elija como se cobra." };
  if (!Number.isFinite(d.monto) || d.monto < 0) return { error: "El monto debe ser un numero desde cero." };
  if (d.vigente_desde && d.vigente_hasta && d.vigente_hasta < d.vigente_desde) {
    return { error: "La vigencia termina antes de empezar." };
  }
  const fila = {
    id_entidad: idEntidad,
    id_vehiculo: d.id_vehiculo,
    origen: d.origen.trim() || null,
    destino: d.destino.trim() || null,
    tipo_cobro: d.tipo_cobro,
    monto: d.monto,
    moneda: d.moneda.trim().toUpperCase() || "CLP",
    vigente_desde: d.vigente_desde || null,
    vigente_hasta: d.vigente_hasta || null,
    activa: d.activa,
    notas: d.notas.trim() || null,
  };
  const supabase = await createClient();
  const { error } = id == null
    ? await supabase.from("transporte_tarifas").insert(fila)
    : await supabase.from("transporte_tarifas").update(fila).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/transportistas/${idEntidad}`);
  return { ok: true };
}

export async function eliminarTarifa(idEntidad: number, id: number) {
  const err = await puedeAdministrar();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("transporte_tarifas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/transportistas/${idEntidad}`);
  return { ok: true };
}

export const MODALIDADES_PEDIDO = ["Despacho propio", "Retiro del cliente", "Transportista"] as const;

// Como sale el pedido: con camion de Centro Panel, lo retira el cliente, o lo lleva un transportista.
export async function guardarDespachoPedido(
  idPedido: number,
  d: { modalidad: string; idTransportista: number | null; idVehiculo: number | null; flete: number | null }
) {
  const v = await requerirVendedor();
  if (!v.puede_editar && !tienePerfilAdmin(v)) return { error: "Su perfil no permite modificar pedidos." };
  if (!(MODALIDADES_PEDIDO as readonly string[]).includes(d.modalidad)) return { error: "Modalidad no valida." };
  const conTransportista = d.modalidad === "Transportista";
  if (conTransportista && d.idTransportista == null) return { error: "Elija el transportista." };
  if (d.flete != null && (!Number.isFinite(d.flete) || d.flete < 0)) return { error: "El flete debe ser un monto desde cero." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({
      modalidad_despacho: d.modalidad,
      id_transportista: conTransportista ? d.idTransportista : null,
      id_vehiculo: conTransportista ? d.idVehiculo : null,
      flete_estimado: conTransportista ? d.flete : null,
    })
    .eq("id", idPedido);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

// Orden de compra con retiro: quien va a buscar la carga. Sin transportista, retira Centro Panel con lo suyo.
export async function guardarRetiroOC(idOC: number, idTransportista: number | null, idVehiculo: number | null) {
  const v = await requerirVendedor();
  if (!v.puede_editar && !tienePerfilAdmin(v)) return { error: "Su perfil no permite modificar ordenes de compra." };
  const supabase = await createClient();
  // La OC aprobada no se edita por tabla (solo el borrador): la asignacion pasa por una funcion que revisa perfil y mercado.
  const { error } = await supabase.rpc("oc_asignar_transporte", { p_oc: idOC, p_transportista: idTransportista, p_vehiculo: idVehiculo });
  if (error) return { error: error.message };
  revalidatePath(`/compras/${idOC}`);
  return { ok: true };
}
