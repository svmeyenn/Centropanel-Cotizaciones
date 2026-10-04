"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { puedeCargarLeads } from "@/lib/leads";
import {
  cambiosParaLead,
  comparar,
  coincidenciaSegura,
  grupoDe,
  traeContacto,
  type CampoMeta,
  type FilaArchivoMeta,
  type FilaMeta,
  type ModoMeta,
} from "@/lib/meta";
import type { Resultado } from "@/app/clientify/actividad-lead";

// Comparar los leads de Meta con los del sistema, y decidir que hacer con cada
// uno: corregir un dato, agregar el que falta, o agregarlo entero como lead nuevo.
// Como la carga de Clientify, es del Administrador que trabaja los dos mercados.

async function exigir(): Promise<string | null> {
  const v = await requerirVendedor();
  return puedeCargarLeads(v) ? null : "Solo el Administrador de los dos mercados puede trabajar con los leads de Meta.";
}

function refrescar() {
  revalidatePath("/clientify/meta");
  revalidatePath("/clientify");
}

export async function cargarLoteMeta(filas: FilaArchivoMeta[]): Promise<{ guardados?: number; error?: string }> {
  const sin = await exigir();
  if (sin) return { error: sin };
  if (!Array.isArray(filas) || filas.length === 0) return { guardados: 0 };
  if (filas.length > 500) return { error: "El lote es demasiado grande." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("meta_cargar", { p_filas: filas });
  if (error) return { error: error.message };
  refrescar();
  return { guardados: Number(data ?? 0) };
}

async function filaDe(id: number): Promise<FilaMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("meta_comparar", { p_id: id });
  return ((data ?? []) as FilaMeta[])[0] ?? null;
}

async function escribir(f: FilaMeta, acciones: { campo: CampoMeta; modo: ModoMeta }[]): Promise<Resultado> {
  if (!f.id_lead) return { ok: false, mensaje: "Este lead de Meta no tiene un lead existente con que compararse." };
  const { cambios, error } = cambiosParaLead(f, acciones);
  if (error) return { ok: false, mensaje: error };
  if (Object.keys(cambios).length === 0) return { ok: true, mensaje: "No hay nada que cambiar." };

  const supabase = await createClient();
  const { error: err } = await supabase.rpc("lead_guardar_datos", {
    p_lead: f.id_lead,
    p_campos: cambios,
    p_id_pais: null,
  });
  return err ? { ok: false, mensaje: err.message } : { ok: true, mensaje: "Lead actualizado." };
}

export async function aplicarMeta(
  idMeta: number,
  acciones: { campo: CampoMeta; modo: ModoMeta }[]
): Promise<Resultado> {
  const sin = await exigir();
  if (sin) return { ok: false, mensaje: sin };
  const f = await filaDe(idMeta);
  if (!f) return { ok: false, mensaje: "No se encontro el lead de Meta." };
  const r = await escribir(f, acciones);
  if (r.ok) refrescar();
  return r;
}

export async function agregarMetaComoLead(idMeta: number): Promise<Resultado & { id_lead?: number }> {
  const sin = await exigir();
  if (sin) return { ok: false, mensaje: sin };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("meta_agregar_lead", { p_id: idMeta });
  if (error) return { ok: false, mensaje: error.message };
  refrescar();
  return { ok: true, mensaje: "Agregado como lead nuevo.", id_lead: Number(data) };
}

export async function ignorarMeta(idMeta: number, ignorar: boolean): Promise<Resultado> {
  const sin = await exigir();
  if (sin) return { ok: false, mensaje: sin };
  const supabase = await createClient();
  const { error } = await supabase.rpc("meta_descartar", { p_id: idMeta, p_valor: ignorar });
  if (error) return { ok: false, mensaje: error.message };
  refrescar();
  return { ok: true, mensaje: ignorar ? "Ignorado." : "Vuelve a la lista." };
}

export type TipoMasivo = "faltantes" | "nuevos_con_contacto" | "nuevos_sin_contacto";

// Aplica una misma accion a todos los que corresponden. Cada fila se vuelve a
// leer antes de escribirla: dos filas de Meta de la misma persona no deben
// terminar como dos leads.
export async function aplicarMasivoMeta(tipo: TipoMasivo): Promise<Resultado> {
  const sin = await exigir();
  if (sin) return { ok: false, mensaje: sin };

  const supabase = await createClient();
  const { data } = await supabase.rpc("meta_comparar", { p_id: null });
  const filas = (data ?? []) as FilaMeta[];
  let hechos = 0;
  let fallos = 0;

  for (const base of filas) {
    if (base.descartado) continue;
    const g = grupoDe(base);
    if (tipo === "faltantes") {
      // Solo los que coinciden por email o telefono, y solo lo que falta: lo que
      // difiere se revisa a mano.
      if (g !== "faltantes" || !coincidenciaSegura(base)) continue;
      const acciones = comparar(base)
        .filter((c) => c.estado === "falta" && c.puedeAgregar)
        .map((c) => ({ campo: c.campo, modo: "agregar" as ModoMeta }));
      const nombre = comparar(base).find((c) => c.campo === "nombre" && c.estado === "falta");
      if (nombre) acciones.push({ campo: "nombre", modo: "agregar" });
      const r = await escribir(base, acciones);
      if (r.ok) hechos++;
      else fallos++;
    } else {
      if (g !== "nuevo") continue;
      if ((tipo === "nuevos_con_contacto") !== traeContacto(base)) continue;
      const actual = await filaDe(base.id);
      if (!actual || actual.id_lead || actual.descartado) continue;
      const { error } = await supabase.rpc("meta_agregar_lead", { p_id: base.id });
      if (error) fallos++;
      else hechos++;
    }
  }
  refrescar();
  return {
    ok: fallos === 0,
    mensaje: `${hechos} ${tipo === "faltantes" ? "leads completados" : "leads agregados"}${fallos ? `; ${fallos} fallaron` : ""}.`,
  };
}
