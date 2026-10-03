"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import {
  contactosClientify,
  hayClaveClientify,
  mapearActividad,
  mapearContacto,
  mapearOportunidad,
} from "@/lib/clientify";

export interface ResultadoSync {
  ok?: boolean;
  leidos?: number;
  quitados?: number;
  error?: string;
}

export interface ResultadoCorrida {
  id?: number;
  inicio?: string;
  error?: string;
}

async function exigirAdmin(): Promise<string | null> {
  const v = await requerirVendedor();
  return tienePerfilAdmin(v) ? null : "Solo el Administrador o el Supervisor puede cargar contactos.";
}

// Una carga --por la API o por archivo-- es una "corrida": se abre, se le van
// agregando lotes y se cierra. Al cerrarla, lo que no vino en ella ya no existe
// en Clientify y se quita de la copia.
export async function abrirCorrida(): Promise<ResultadoCorrida> {
  const sinPermiso = await exigirAdmin();
  if (sinPermiso) return { error: sinPermiso };

  const supabase = await createClient();
  const inicio = new Date().toISOString();
  const { data, error } = await supabase
    .from("clientify_sincronizaciones")
    .insert({ inicio })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id, inicio };
}

// Guarda un lote tal como lo entrega Clientify. El upsert solo pisa las columnas
// que se mandan: el enlace de un contacto con su ficha (id_entidad) sobrevive a
// cada carga.
export type TablaClientify = "contactos" | "oportunidades" | "actividad";

export async function guardarLote(
  inicio: string,
  filas: unknown[],
  tabla: TablaClientify = "contactos"
): Promise<{ guardados?: number; error?: string }> {
  const sinPermiso = await exigirAdmin();
  if (sinPermiso) return { error: sinPermiso };
  if (!Array.isArray(filas) || filas.length === 0) return { guardados: 0 };
  if (filas.length > 500) return { error: "El lote es demasiado grande." };

  const crudas = filas.filter(
    (f): f is Record<string, never> => typeof f === "object" && f !== null && "id" in f
  );
  const supabase = await createClient();

  if (tabla === "contactos") {
    const contactos = crudas.map(mapearContacto).filter((c) => Number.isFinite(c.id_clientify));
    const { error } = await supabase
      .from("clientify_contactos")
      .upsert(
        contactos.map((c) => ({ ...c, sincronizado_en: inicio })),
        { onConflict: "id_clientify" }
      );
    return error ? { error: error.message } : { guardados: contactos.length };
  }

  if (tabla === "oportunidades") {
    const ops = crudas.map(mapearOportunidad).filter((o) => Number.isFinite(o.id_clientify));
    const { error } = await supabase
      .from("clientify_oportunidades")
      .upsert(
        ops.map((o) => ({ ...o, sincronizado_en: inicio })),
        { onConflict: "id_clientify" }
      );
    return error ? { error: error.message } : { guardados: ops.length };
  }

  // Actividad: cada fila trae el contacto y los registros de su muro
  // ({ id_contacto, entradas: [...] }).
  const acts = filas.flatMap((f) => {
    const { id_contacto, entradas } = (f ?? {}) as { id_contacto?: number; entradas?: unknown[] };
    if (!Number.isFinite(id_contacto) || !Array.isArray(entradas)) return [];
    return entradas
      .map((e) => mapearActividad(e as Record<string, never>, id_contacto as number))
      .filter((a): a is NonNullable<typeof a> => a !== null);
  });
  if (acts.length === 0) return { guardados: 0 };
  const { error } = await supabase
    .from("clientify_actividad")
    .upsert(
      acts.map((a) => ({ ...a, sincronizado_en: inicio })),
      { onConflict: "id" }
    );
  return error ? { error: error.message } : { guardados: acts.length };
}

// Cierra la corrida. Se quitan los contactos que no vinieron solo si llegaron
// todos los que se esperaban: una lista cortada o vacia no debe vaciar la copia.
export async function cerrarCorrida(
  id: number,
  inicio: string,
  leidos: number,
  esperados: number | null,
  error?: string,
  oportunidades?: { leidas: number; esperadas: number | null }
): Promise<ResultadoSync> {
  const sinPermiso = await exigirAdmin();
  if (sinPermiso) return { error: sinPermiso };

  const supabase = await createClient();

  if (error) {
    await supabase
      .from("clientify_sincronizaciones")
      .update({ fin: new Date().toISOString(), estado: "con error", leidos, error })
      .eq("id", id);
    revalidatePath("/clientify");
    return { error };
  }

  let quitados = 0;
  if (esperados !== null && esperados > 0 && leidos === esperados) {
    const { data: borrados, error: errBorrar } = await supabase
      .from("clientify_contactos")
      .delete()
      .lt("sincronizado_en", inicio)
      .select("id_clientify");
    if (errBorrar) {
      await supabase
        .from("clientify_sincronizaciones")
        .update({ fin: new Date().toISOString(), estado: "con error", leidos, error: errBorrar.message })
        .eq("id", id);
      return { error: errBorrar.message };
    }
    quitados = borrados?.length ?? 0;
  }

  // Igual con las oportunidades: solo si llegaron todas las que se esperaban.
  if (oportunidades && oportunidades.esperadas && oportunidades.leidas === oportunidades.esperadas) {
    await supabase.from("clientify_oportunidades").delete().lt("sincronizado_en", inicio);
  }

  await supabase
    .from("clientify_sincronizaciones")
    .update({ fin: new Date().toISOString(), estado: "ok", leidos, quitados })
    .eq("id", id);

  revalidatePath("/clientify");
  return { ok: true, leidos, quitados };
}

// Trae todos los contactos por la API de Clientify. Solo sirve si la cuenta
// tiene la clave de API; si no, se carga el archivo.
export async function sincronizarClientify(): Promise<ResultadoSync> {
  if (!hayClaveClientify())
    return { error: "Falta cargar la clave de Clientify (CLIENTIFY_API_KEY) en Vercel." };

  const corrida = await abrirCorrida();
  if (corrida.error || !corrida.id || !corrida.inicio) return { error: corrida.error };

  let leidos = 0;
  try {
    for await (const pagina of contactosClientify()) {
      const r = await guardarLote(corrida.inicio, pagina as unknown[]);
      if (r.error) throw new Error(r.error);
      leidos += r.guardados ?? 0;
    }
  } catch (e) {
    return cerrarCorrida(
      corrida.id,
      corrida.inicio,
      leidos,
      null,
      e instanceof Error ? e.message : "Error desconocido."
    );
  }
  // Por la API la lista es la completa: lo leido es lo esperado.
  return cerrarCorrida(corrida.id, corrida.inicio, leidos, leidos);
}
