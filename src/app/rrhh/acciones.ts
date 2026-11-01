"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { sumarDias } from "@/lib/formato";
import {
  CLASES,
  ESTADOS_PERSONAL,
  GRATIFICACIONES,
  MEDIOS_PAGO,
  RELACIONES,
  TIPOS_ANTICIPO,
  TIPOS_CONTRATO,
  nivelRRHH,
} from "@/lib/rrhh";
import type { Nivel } from "@/lib/permisos";

// Todo lo de RRHH pasa por aqui. La base vuelve a revisar cada permiso (rrhh_ver/operar/aprobar/admin
// y el mercado de la persona); esto solo evita el viaje y da el mensaje en castellano.
// Un error lanzado dentro de una transicion tumba la pantalla: cada accion devuelve { error } en vez de lanzar.
type Resultado<T = unknown> = ({ ok: true } & T) | { error: string };

async function conPermiso<T = unknown>(minimo: Nivel, fn: () => Promise<Resultado<NoInfer<T>>>): Promise<Resultado<T>> {
  try {
    const v = await requerirVendedor();
    if (!nivelRRHH(v, minimo)) return { error: "Su perfil no permite esta operacion en Recursos humanos." };
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo completar la operacion." };
  }
}

const vacio = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const num = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? n : null);

export interface DatosPersona {
  razon_social: string;
  rut: string;
  email: string;
  telefono: string;
  direccion: string;
  id_pais: number | null;
  relacion: string;
  clase: string;
  cargo: string;
  oficio: string;
  fecha_ingreso: string;
  fecha_termino: string;
  estado: string;
  fecha_nacimiento: string;
  nacionalidad: string;
  cargas_familiares: number;
  contacto_emergencia: string;
  telefono_emergencia: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  notas: string;
}

function validarPersona(d: DatosPersona): string | null {
  if (!d.razon_social.trim()) return "Indique el nombre completo.";
  if (!d.rut.trim()) return "Indique el RUT o documento de identidad.";
  if (!(RELACIONES as readonly string[]).includes(d.relacion)) return "Elija si va a contrato o a honorarios.";
  if (!(CLASES as readonly string[]).includes(d.clase)) return "Elija si es personal administrativo o de obra.";
  if (!(ESTADOS_PERSONAL as readonly string[]).includes(d.estado)) return "Estado no valido.";
  if (d.fecha_termino && d.fecha_ingreso && d.fecha_termino < d.fecha_ingreso) return "La fecha de termino es anterior a la de ingreso.";
  if (!Number.isInteger(d.cargas_familiares) || d.cargas_familiares < 0) return "Las cargas familiares son un numero entero desde cero.";
  return null;
}

export async function crearPersona(d: DatosPersona) {
  return conPermiso<{ id: number }>("operar", async () => {
    const err = validarPersona(d);
    if (err) return { error: err };
    if (!d.id_pais) return { error: "Elija el mercado." };
    const supabase = await createClient();
    const { data: ent, error: e1 } = await supabase
      .from("entidades")
      .insert({
        razon_social: d.razon_social.trim(),
        nombre_referencia: d.razon_social.trim(),
        rut: d.rut.trim(),
        email: vacio(d.email),
        telefono: vacio(d.telefono),
        direccion: vacio(d.direccion),
        id_pais: d.id_pais,
      })
      .select("id_entidad")
      .single();
    if (e1) return { error: e1.code === "23505" ? "Ya existe una persona o empresa con ese nombre." : e1.message };
    const { error: e2 } = await supabase.from("entidad_tipos").insert({ id_entidad: ent.id_entidad, tipo: "empleado" });
    if (e2) return { error: e2.message };
    const { data: p, error: e3 } = await supabase
      .from("rrhh_personal")
      .insert(filaPersonal(d, d.id_pais, Number(ent.id_entidad)))
      .select("id")
      .single();
    if (e3) return { error: e3.message };
    revalidatePath("/rrhh");
    return { ok: true, id: Number(p.id) };
  });
}

function filaPersonal(d: DatosPersona, idPais: number, idEntidad: number) {
  return {
    id_pais: idPais,
    id_entidad: idEntidad,
    relacion: d.relacion,
    clase: d.clase,
    cargo: vacio(d.cargo),
    oficio: vacio(d.oficio),
    fecha_ingreso: vacio(d.fecha_ingreso),
    fecha_termino: vacio(d.fecha_termino),
    estado: d.estado,
    fecha_nacimiento: vacio(d.fecha_nacimiento),
    nacionalidad: vacio(d.nacionalidad),
    cargas_familiares: d.cargas_familiares,
    contacto_emergencia: vacio(d.contacto_emergencia),
    telefono_emergencia: vacio(d.telefono_emergencia),
    banco: vacio(d.banco),
    tipo_cuenta: vacio(d.tipo_cuenta),
    numero_cuenta: vacio(d.numero_cuenta),
    notas: vacio(d.notas),
  };
}

export async function actualizarPersona(id: number, idEntidad: number, d: DatosPersona) {
  return conPermiso("operar", async () => {
    const err = validarPersona(d);
    if (err) return { error: err };
    const supabase = await createClient();
    const { error: e1 } = await supabase
      .from("entidades")
      .update({
        razon_social: d.razon_social.trim(),
        rut: d.rut.trim(),
        email: vacio(d.email),
        telefono: vacio(d.telefono),
        direccion: vacio(d.direccion),
      })
      .eq("id_entidad", idEntidad);
    if (e1) return { error: e1.code === "23505" ? "Ya existe otra persona o empresa con ese nombre." : e1.message };
    const { id_pais: _p, id_entidad: _e, ...cambios } = filaPersonal(d, d.id_pais ?? 0, idEntidad);
    void _p;
    void _e;
    const { error: e2 } = await supabase.from("rrhh_personal").update(cambios).eq("id", id);
    if (e2) return { error: e2.message };
    revalidatePath("/rrhh");
    revalidatePath(`/rrhh/${id}`);
    return { ok: true };
  });
}

export interface DatosContrato {
  tipo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  sueldo_base: number | null;
  valor_hora: number | null;
  monto_honorario: number | null;
  jornada_horas: number | null;
  gratificacion: string;
  gratificacion_monto: number | null;
  colacion: number | null;
  movilizacion: number | null;
  id_prevision: number | null;
  id_salud: number | null;
  salud_plan_uf: number | null;
  id_mutual: number | null;
  tasa_mutual_extra: number | null;
  seguro_cesantia: boolean;
  pensionado: boolean;
  notas: string;
}

export async function guardarContrato(idPersonal: number, idContrato: number | null, moneda: string, d: DatosContrato) {
  return conPermiso("operar", async () => {
    if (!(TIPOS_CONTRATO as readonly string[]).includes(d.tipo)) return { error: "Elija el tipo de contrato." };
    if (!d.fecha_inicio) return { error: "Indique la fecha de inicio." };
    if (d.fecha_fin && d.fecha_fin < d.fecha_inicio) return { error: "El contrato termina antes de empezar." };
    if (!(GRATIFICACIONES as readonly string[]).includes(d.gratificacion)) return { error: "Elija la gratificacion." };
    const honorarios = d.tipo === "Honorarios";
    if (honorarios && !(d.monto_honorario && d.monto_honorario > 0)) return { error: "Indique el monto mensual de honorarios." };
    if (!honorarios && !(d.sueldo_base && d.sueldo_base > 0) && !(d.valor_hora && d.valor_hora > 0)) {
      return { error: "Indique el sueldo base (o el valor por hora)." };
    }
    for (const [n, t] of [
      [d.sueldo_base, "El sueldo base"],
      [d.valor_hora, "El valor por hora"],
      [d.monto_honorario, "El honorario"],
      [d.colacion, "La colacion"],
      [d.movilizacion, "La movilizacion"],
      [d.gratificacion_monto, "La gratificacion garantizada"],
      [d.salud_plan_uf, "El plan de salud"],
      [d.tasa_mutual_extra, "La tasa adicional de la mutual"],
    ] as const) {
      if (n != null && (!Number.isFinite(n) || n < 0)) return { error: `${t} debe ser un numero desde cero.` };
    }
    if (!honorarios && d.gratificacion === "Garantizada" && !(d.gratificacion_monto && d.gratificacion_monto > 0)) {
      return { error: "Indique el monto de la gratificacion garantizada." };
    }
    const supabase = await createClient();
    // Un solo contrato vigente por persona: el anterior termina el dia antes de que empiece el nuevo.
    if (d.estado === "Vigente") {
      let q = supabase.from("rrhh_contratos").select("id, fecha_inicio").eq("id_personal", idPersonal).eq("estado", "Vigente");
      if (idContrato != null) q = q.neq("id", idContrato);
      const { data: previos } = await q;
      for (const p of previos ?? []) {
        const fin = sumarDias(d.fecha_inicio, -1);
        const { error } = await supabase
          .from("rrhh_contratos")
          .update({ estado: "Terminado", fecha_fin: fin < String(p.fecha_inicio) ? String(p.fecha_inicio) : fin })
          .eq("id", p.id);
        if (error) return { error: error.message };
      }
    }
    const fila = {
      id_personal: idPersonal,
      tipo: d.tipo,
      descripcion: vacio(d.descripcion),
      fecha_inicio: d.fecha_inicio,
      fecha_fin: vacio(d.fecha_fin),
      estado: d.estado,
      moneda,
      sueldo_base: honorarios ? null : num(d.sueldo_base),
      valor_hora: honorarios ? null : num(d.valor_hora),
      monto_honorario: honorarios ? num(d.monto_honorario) : null,
      jornada_horas: honorarios ? null : num(d.jornada_horas),
      gratificacion: honorarios ? "Ninguna" : d.gratificacion,
      gratificacion_monto: d.gratificacion === "Garantizada" ? num(d.gratificacion_monto) : null,
      colacion: honorarios ? null : num(d.colacion),
      movilizacion: honorarios ? null : num(d.movilizacion),
      id_prevision: honorarios ? null : d.id_prevision,
      id_salud: honorarios ? null : d.id_salud,
      salud_plan_uf: honorarios ? null : num(d.salud_plan_uf),
      id_mutual: honorarios ? null : d.id_mutual,
      tasa_mutual_extra: honorarios ? null : num(d.tasa_mutual_extra),
      seguro_cesantia: honorarios ? false : d.seguro_cesantia,
      pensionado: honorarios ? false : d.pensionado,
      notas: vacio(d.notas),
    };
    const { error } =
      idContrato == null
        ? await supabase.from("rrhh_contratos").insert(fila)
        : await supabase.from("rrhh_contratos").update(fila).eq("id", idContrato);
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

export async function guardarImputaciones(
  idPersonal: number,
  filas: { id_centro_costo: number; id_proyecto: number | null; porcentaje: number }[]
) {
  return conPermiso("operar", async () => {
    if (filas.length === 0) return { error: "Indique al menos un centro de costo." };
    if (filas.some((f) => !f.id_centro_costo)) return { error: "Elija el centro de costo de cada linea." };
    if (filas.some((f) => !Number.isFinite(f.porcentaje) || f.porcentaje <= 0)) return { error: "Cada porcentaje debe ser mayor que cero." };
    const suma = filas.reduce((s, f) => s + f.porcentaje, 0);
    if (Math.abs(suma - 100) > 0.001) return { error: `Los porcentajes suman ${Math.round(suma * 100) / 100}: deben sumar 100.` };
    const supabase = await createClient();
    const { error: e1 } = await supabase.from("rrhh_imputaciones").delete().eq("id_personal", idPersonal);
    if (e1) return { error: e1.message };
    const { error: e2 } = await supabase
      .from("rrhh_imputaciones")
      .insert(filas.map((f) => ({ id_personal: idPersonal, id_centro_costo: f.id_centro_costo, id_proyecto: f.id_proyecto, porcentaje: f.porcentaje })));
    if (e2) return { error: e2.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

export async function guardarItemRecurrente(
  idPersonal: number,
  id: number | null,
  d: { id_concepto: number; monto: number; desde: string; hasta: string; nota: string }
) {
  return conPermiso("operar", async () => {
    if (!d.id_concepto) return { error: "Elija el concepto." };
    if (!Number.isFinite(d.monto) || d.monto <= 0) return { error: "El monto debe ser mayor que cero." };
    if (d.desde && d.hasta && d.hasta < d.desde) return { error: "La vigencia termina antes de empezar." };
    const fila = { id_personal: idPersonal, id_concepto: d.id_concepto, monto: d.monto, desde: vacio(d.desde), hasta: vacio(d.hasta), nota: vacio(d.nota) };
    const supabase = await createClient();
    const { error } =
      id == null ? await supabase.from("rrhh_items_recurrentes").insert(fila) : await supabase.from("rrhh_items_recurrentes").update(fila).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

export async function eliminarItemRecurrente(idPersonal: number, id: number) {
  return conPermiso("operar", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("rrhh_items_recurrentes").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

export async function guardarNovedad(
  idPersonal: number,
  id: number | null,
  d: { periodo: string; id_concepto: number; cantidad: number | null; monto: number; id_proyecto: number | null; nota: string }
) {
  return conPermiso("operar", async () => {
    if (!d.periodo) return { error: "Indique el mes." };
    if (!d.id_concepto) return { error: "Elija el concepto." };
    if (!Number.isFinite(d.monto) || d.monto <= 0) return { error: "El monto debe ser mayor que cero." };
    const fila = {
      id_personal: idPersonal,
      periodo: `${d.periodo.slice(0, 7)}-01`,
      id_concepto: d.id_concepto,
      cantidad: num(d.cantidad),
      monto: d.monto,
      id_proyecto: d.id_proyecto,
      nota: vacio(d.nota),
    };
    const supabase = await createClient();
    const { error } = id == null ? await supabase.from("rrhh_novedades").insert(fila) : await supabase.from("rrhh_novedades").update(fila).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

export async function eliminarNovedad(idPersonal: number, id: number) {
  return conPermiso("operar", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("rrhh_novedades").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

export async function guardarAnticipo(
  idPersonal: number,
  d: { tipo: string; fecha: string; concepto: string; monto_total: number; cuotas: number; desde_periodo: string; nota: string }
) {
  return conPermiso("operar", async () => {
    if (!(TIPOS_ANTICIPO as readonly string[]).includes(d.tipo)) return { error: "Elija el tipo." };
    if (!Number.isFinite(d.monto_total) || d.monto_total <= 0) return { error: "El monto debe ser mayor que cero." };
    if (!Number.isInteger(d.cuotas) || d.cuotas < 1 || d.cuotas > 60) return { error: "Las cuotas son un numero entero entre 1 y 60." };
    if (!d.desde_periodo) return { error: "Indique desde que mes se descuenta." };
    const supabase = await createClient();
    const { data: p } = await supabase.from("rrhh_personal").select("id_pais").eq("id", idPersonal).single();
    const dec = Number(p?.id_pais) === 1 ? 0 : 2;
    const cuota = Math.round((d.monto_total / d.cuotas) * 10 ** dec) / 10 ** dec;
    const { error } = await supabase.from("rrhh_anticipos").insert({
      id_personal: idPersonal,
      tipo: d.tipo,
      fecha: vacio(d.fecha),
      concepto: vacio(d.concepto),
      monto_total: d.monto_total,
      cuotas: d.cuotas,
      desde_periodo: `${d.desde_periodo.slice(0, 7)}-01`,
      monto_cuota: cuota,
      nota: vacio(d.nota),
    });
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

export async function anularAnticipo(idPersonal: number, id: number) {
  return conPermiso("operar", async () => {
    const supabase = await createClient();
    const { data: a } = await supabase.from("rrhh_anticipos").select("monto_descontado").eq("id", id).single();
    if (Number(a?.monto_descontado ?? 0) > 0) return { error: "Ya se descontaron cuotas en liquidaciones aprobadas: anule esas liquidaciones primero." };
    const { error } = await supabase.from("rrhh_anticipos").update({ estado: "Anulado" }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/${idPersonal}`);
    return { ok: true };
  });
}

// ---- Liquidaciones y honorarios ----

export async function crearLiquidacion(idPersonal: number, periodo: string, dias: number, bruto: number | null) {
  return conPermiso<{ id: number }>("operar", async () => {
    if (!periodo) return { error: "Indique el mes." };
    if (!Number.isFinite(dias) || dias <= 0 || dias > 31) return { error: "Los dias trabajados van de 1 a 31." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("rrhh_crear_liquidacion", {
      p_personal: idPersonal,
      p_periodo: `${periodo.slice(0, 7)}-01`,
      p_dias: dias,
      p_bruto: bruto,
    });
    if (error) return { error: error.code === "23505" ? "Esa persona ya tiene una liquidacion para ese mes." : error.message };
    revalidatePath("/rrhh/liquidaciones");
    return { ok: true, id: Number(data) };
  });
}

export async function generarLiquidaciones(idPais: number, periodo: string) {
  return conPermiso<{ creadas: number; errores: { id_personal: number; nombre: string; error: string }[] }>("operar", async () => {
    if (!periodo) return { error: "Indique el mes." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("rrhh_generar_liquidaciones", { p_pais: idPais, p_periodo: `${periodo.slice(0, 7)}-01` });
    if (error) return { error: error.message };
    revalidatePath("/rrhh/liquidaciones");
    const r = data as { creadas: number; errores: { id_personal: number; nombre: string; error: string }[] };
    return { ok: true, creadas: r.creadas, errores: r.errores };
  });
}

export async function recalcularLiquidacion(id: number) {
  return conPermiso("operar", async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("rrhh_calcular", { p_id: id });
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/liquidaciones/${id}`);
    return { ok: true };
  });
}

// Los datos de la boleta que el trabajador emitio en el SII o la SUNAT: numero, fecha y monto bruto.
export async function guardarDatosLiquidacion(
  id: number,
  d: { dias_trabajados: number; boleta_numero: string; boleta_fecha: string; boleta_bruto: number | null; nota: string }
) {
  return conPermiso("operar", async () => {
    if (!Number.isFinite(d.dias_trabajados) || d.dias_trabajados <= 0 || d.dias_trabajados > 31) return { error: "Los dias trabajados van de 1 a 31." };
    if (d.boleta_bruto != null && (!Number.isFinite(d.boleta_bruto) || d.boleta_bruto < 0)) return { error: "El bruto de la boleta debe ser un numero desde cero." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("rrhh_liquidaciones")
      .update({
        dias_trabajados: d.dias_trabajados,
        boleta_numero: vacio(d.boleta_numero),
        boleta_fecha: vacio(d.boleta_fecha),
        boleta_bruto: d.boleta_bruto,
        nota: vacio(d.nota),
      })
      .eq("id", id);
    if (error) return { error: error.message };
    const { error: e2 } = await supabase.rpc("rrhh_calcular", { p_id: id });
    if (e2) return { error: e2.message };
    revalidatePath(`/rrhh/liquidaciones/${id}`);
    return { ok: true };
  });
}

export async function aprobarLiquidacion(id: number) {
  return conPermiso("aprobar", async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("rrhh_aprobar_liquidacion", { p_id: id });
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/liquidaciones/${id}`);
    revalidatePath("/rrhh/liquidaciones");
    return { ok: true };
  });
}

export async function pagarLiquidacion(id: number, fecha: string, medio: string, cuenta: number | null) {
  return conPermiso("aprobar", async () => {
    if (!fecha) return { error: "Indique la fecha de pago." };
    if (!(MEDIOS_PAGO as readonly string[]).includes(medio)) return { error: "Elija el medio de pago." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("rrhh_pagar_liquidacion", { p_id: id, p_fecha: fecha, p_medio: medio, p_cuenta: cuenta });
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/liquidaciones/${id}`);
    revalidatePath("/rrhh/liquidaciones");
    revalidatePath("/egresos");
    revalidatePath("/conciliacion");
    return { ok: true };
  });
}

export async function anularLiquidacion(id: number, motivo: string) {
  return conPermiso("operar", async () => {
    if (!motivo.trim()) return { error: "Indique el motivo de la anulacion." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("rrhh_anular_liquidacion", { p_id: id, p_motivo: motivo.trim() });
    if (error) return { error: error.message };
    revalidatePath(`/rrhh/liquidaciones/${id}`);
    revalidatePath("/rrhh/liquidaciones");
    revalidatePath("/egresos");
    revalidatePath("/conciliacion");
    return { ok: true };
  });
}

// ---- Parametros de remuneraciones (solo quien administra) ----

export async function guardarParametro(
  idPais: number,
  id: number | null,
  d: { codigo: string; id_institucion: number | null; valor: number; vigente_desde: string; nota: string; validado: boolean }
) {
  return conPermiso("administrar", async () => {
    if (!d.codigo.trim()) return { error: "Indique el codigo del parametro." };
    if (!Number.isFinite(d.valor)) return { error: "El valor debe ser un numero." };
    if (!d.vigente_desde) return { error: "Indique desde cuando rige." };
    const fila = {
      id_pais: idPais,
      codigo: d.codigo.trim().toUpperCase(),
      id_institucion: d.id_institucion,
      valor: d.valor,
      vigente_desde: d.vigente_desde,
      nota: vacio(d.nota),
      validado: d.validado,
    };
    const supabase = await createClient();
    const { error } = id == null ? await supabase.from("rrhh_parametros").insert(fila) : await supabase.from("rrhh_parametros").update(fila).eq("id", id);
    if (error) return { error: error.code === "23505" ? "Ya existe ese parametro con esa fecha de vigencia." : error.message };
    revalidatePath("/rrhh/parametros");
    return { ok: true };
  });
}

export async function eliminarParametro(id: number) {
  return conPermiso("administrar", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("rrhh_parametros").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/rrhh/parametros");
    return { ok: true };
  });
}

export async function guardarTramo(
  idPais: number,
  id: number | null,
  d: { vigente_desde: string; desde: number; hasta: number | null; factor: number; rebaja: number; validado: boolean }
) {
  return conPermiso("administrar", async () => {
    if (!d.vigente_desde) return { error: "Indique desde cuando rige." };
    if (!Number.isFinite(d.desde) || d.desde < 0) return { error: "El limite inferior debe ser un numero desde cero." };
    if (d.hasta != null && d.hasta <= d.desde) return { error: "El limite superior debe ser mayor que el inferior." };
    if (!Number.isFinite(d.factor) || d.factor < 0) return { error: "El factor debe ser un numero desde cero." };
    const fila = { id_pais: idPais, vigente_desde: d.vigente_desde, desde: d.desde, hasta: d.hasta, factor: d.factor, rebaja: d.rebaja || 0, validado: d.validado };
    const supabase = await createClient();
    const { error } = id == null ? await supabase.from("rrhh_tramos_impuesto").insert(fila) : await supabase.from("rrhh_tramos_impuesto").update(fila).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/rrhh/parametros");
    return { ok: true };
  });
}

export async function eliminarTramo(id: number) {
  return conPermiso("administrar", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("rrhh_tramos_impuesto").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/rrhh/parametros");
    return { ok: true };
  });
}

export async function guardarInstitucion(idPais: number, id: number | null, d: { tipo: string; nombre: string; activo: boolean }) {
  return conPermiso("administrar", async () => {
    if (!d.nombre.trim()) return { error: "Indique el nombre." };
    if (!d.tipo) return { error: "Elija el tipo." };
    const fila = { id_pais: idPais, tipo: d.tipo, nombre: d.nombre.trim(), activo: d.activo };
    const supabase = await createClient();
    const { error } = id == null ? await supabase.from("rrhh_instituciones").insert(fila) : await supabase.from("rrhh_instituciones").update(fila).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/rrhh/parametros");
    return { ok: true };
  });
}
