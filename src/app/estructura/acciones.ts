"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

export type Resultado = { ok: boolean; mensaje?: string };

const texto = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};

async function exigir(): Promise<Resultado & { esGeneral?: boolean }> {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores)
    return { ok: false, mensaje: "Su perfil no permite administrar la estructura." };
  return { ok: true, esGeneral: v.mercado === "Ambos" };
}

function refrescar() {
  revalidatePath("/estructura");
  revalidatePath("/mantenedores", "layout");
  revalidatePath("/egresos");
  revalidatePath("/ingresos");
  revalidatePath("/resumen-proyecto");
}

const choque = (code?: string) =>
  code === "23505" ? "Ya existe uno con ese codigo o nombre en este lugar." : null;

export async function guardarUnidad(_p: Resultado | null, d: FormData): Promise<Resultado> {
  const p = await exigir();
  if (!p.ok) return p;
  const codigo = texto(d.get("codigo"))?.toUpperCase();
  const nombre = texto(d.get("nombre"));
  if (!codigo || !nombre) return { ok: false, mensaje: "El codigo y el nombre son obligatorios." };
  const fila = {
    codigo,
    nombre,
    orden: Number(d.get("orden")) || 0,
    activa: d.get("activa") === "on",
  };
  const supabase = await createClient();
  const id = Number(d.get("id")) || null;
  const { error } = id
    ? await supabase.from("unidades_negocio").update(fila).eq("id", id)
    : await supabase.from("unidades_negocio").insert({ ...fila, id_pais: Number(d.get("id_pais")) });
  if (error) return { ok: false, mensaje: choque(error.code) ?? error.message };
  refrescar();
  return { ok: true, mensaje: "Unidad de negocio guardada." };
}

export async function guardarCentro(_p: Resultado | null, d: FormData): Promise<Resultado> {
  const p = await exigir();
  if (!p.ok) return p;
  const codigo = texto(d.get("codigo"))?.toUpperCase();
  const nombre = texto(d.get("nombre"));
  if (!codigo || !nombre) return { ok: false, mensaje: "El codigo y el nombre son obligatorios." };
  const fila = {
    codigo,
    nombre,
    orden: Number(d.get("orden")) || 0,
    activo: d.get("activo") === "on",
  };
  const supabase = await createClient();
  const id = Number(d.get("id")) || null;
  const { error } = id
    ? await supabase.from("centros_costo").update(fila).eq("id", id)
    : await supabase.from("centros_costo").insert({ ...fila, id_unidad: Number(d.get("id_unidad")) });
  if (error) return { ok: false, mensaje: choque(error.code) ?? error.message };
  refrescar();
  return { ok: true, mensaje: "Centro de costo guardado." };
}

// Clasifica un movimiento que no tiene proyecto con centro de costo. Los que
// tienen proyecto toman el del proyecto.
export async function asignarCentroCosto(idMov: number, idCentro: number | null): Promise<Resultado> {
  const p = await exigir();
  if (!p.ok) return p;
  if (!idCentro) return { ok: false, mensaje: "Elija el centro de costo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mov_asignar_centro_costo", { p_mov: idMov, p_cc: idCentro });
  if (error) return { ok: false, mensaje: error.message };
  refrescar();
  return { ok: true, mensaje: "Movimiento clasificado." };
}

// Paises para clasificar el origen de los leads. Un pais nuevo nace sin
// operacion: no tiene unidades ni lleva ventas hasta que se habilite como
// mercado.
export async function guardarPais(_p: Resultado | null, d: FormData): Promise<Resultado> {
  const p = await exigir();
  if (!p.ok) return p;
  if (!p.esGeneral) return { ok: false, mensaje: "Solo quien administra los dos mercados crea o edita paises." };
  const codigo = texto(d.get("codigo"))?.toUpperCase();
  const nombre = texto(d.get("nombre"));
  if (!codigo || !nombre) return { ok: false, mensaje: "El codigo y el nombre son obligatorios." };
  const fila = {
    codigo,
    nombre,
    moneda_base: texto(d.get("moneda_base"))?.toUpperCase() ?? "USD",
    prefijo_telefono: texto(d.get("prefijo_telefono")) ?? "",
    etiqueta_id: texto(d.get("etiqueta_id")) ?? "ID",
    activo: d.get("activo") === "on",
  };
  const supabase = await createClient();
  const id = Number(d.get("id")) || null;
  const { error } = id
    ? await supabase.from("paises").update(fila).eq("id", id)
    : await supabase.from("paises").insert({ ...fila, opera: false, orden: 99 });
  if (error) return { ok: false, mensaje: error.code === "23505" ? "Ya existe un pais con ese codigo." : error.message };
  refrescar();
  revalidatePath("/leads");
  return { ok: true, mensaje: "Pais guardado." };
}
