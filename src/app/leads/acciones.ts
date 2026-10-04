"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { puedeCargarLeads } from "@/lib/leads";
import {
  contactosClientify,
  hayClaveClientify,
  mapearActividad,
  mapearContacto,
  mapearOportunidad,
} from "@/lib/clientify";
import type { LeadImportado } from "@/lib/importarLeads";
import type { OportunidadImportada } from "@/lib/importarOportunidades";

export interface ResultadoSync {
  ok?: boolean;
  leidos?: number;
  quitados?: number;
  enlazados?: number;
  error?: string;
}

export interface ResultadoCorrida {
  id?: number;
  inicio?: string;
  error?: string;
}

async function exigirAdmin(): Promise<string | null> {
  const v = await requerirVendedor();
  // El archivo trae los contactos de los dos paises: lo carga el Administrador
  // que trabaja los dos mercados.
  return puedeCargarLeads(v)
    ? null
    : "Solo el Administrador de los dos mercados puede cargar contactos.";
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

// Importar la planilla de contactos (.xlsx). Un lead que ya esta se completa y se
// pone al dia; uno que no esta se agrega. Nunca se borra nada, y lo que la planilla
// trae vacio no borra lo que ya hay: los emails y telefonos se suman a los que
// tenia, con sus marcas de WhatsApp.
const ultimos9 = (t: string) => t.replace(/\D/g, "").slice(-9);

export async function guardarLoteLeads(
  inicio: string,
  leads: LeadImportado[]
): Promise<{ nuevos?: number; actualizados?: number; error?: string }> {
  const sinPermiso = await exigirAdmin();
  if (sinPermiso) return { error: sinPermiso };
  if (!Array.isArray(leads) || leads.length === 0) return { nuevos: 0, actualizados: 0 };
  if (leads.length > 300) return { error: "El lote es demasiado grande." };

  const supabase = await createClient();
  const ids = leads.map((l) => l.id).filter((n) => Number.isInteger(n));

  const [{ data: previos }, { data: duenos }] = await Promise.all([
    supabase
      .from("clientify_contactos")
      .select(
        "id_clientify, nombre, apellido, empresa, cargo, propietario, propietario_email, estado, origen, creado_clientify, ultimo_contacto, etiquetas, observaciones, campos_personalizados, direccion, ciudad, comuna, region, pais, emails, telefonos"
      )
      .in("id_clientify", ids),
    supabase.from("clientify_contactos").select("propietario, propietario_email").not("propietario_email", "is", null).limit(2000),
  ]);
  const previo = new Map((previos ?? []).map((p) => [Number(p.id_clientify), p]));
  // La planilla trae el nombre del propietario y no su email: se toma el que ya
  // tienen sus otros leads.
  const emailDe = new Map<string, string>();
  for (const d of duenos ?? [])
    if (d.propietario && d.propietario_email) emailDe.set(String(d.propietario), String(d.propietario_email));

  let nuevos = 0;
  const filas = leads.map((l) => {
    const p = previo.get(l.id);
    if (!p) nuevos++;

    const emails = [...((p?.emails as { email?: string }[] | null) ?? [])];
    for (const e of l.emails)
      if (!emails.some((x) => (x.email ?? "").toLowerCase() === e)) emails.push({ email: e });
    const telefonos = [...((p?.telefonos as { phone?: string }[] | null) ?? [])];
    for (const t of l.telefonos)
      if (!telefonos.some((x) => ultimos9(x.phone ?? "") === ultimos9(t))) telefonos.push({ phone: t });

    // Los campos propios se renuevan por nombre; los que el archivo no trae se conservan.
    const campos = [...((p?.campos_personalizados as { field: string; value: string }[] | null) ?? [])];
    for (const c of l.campos) {
      const i = campos.findIndex((x) => x.field === c.field);
      if (i >= 0) campos[i] = c;
      else campos.push(c);
    }

    const propietario = l.propietario ?? (p?.propietario as string | null) ?? null;
    return {
      id_clientify: l.id,
      nombre: l.nombre ?? p?.nombre ?? null,
      apellido: l.apellido ?? p?.apellido ?? null,
      empresa: l.empresa ?? p?.empresa ?? null,
      cargo: l.cargo ?? p?.cargo ?? null,
      propietario,
      propietario_email: (propietario ? emailDe.get(propietario) : null) ?? p?.propietario_email ?? null,
      estado: l.estado ?? p?.estado ?? null,
      // Del origen manda el que ya estaba: el archivo lo dice con otras palabras.
      origen: (p?.origen as string | null) ?? l.origen ?? null,
      creado_clientify: l.creado ?? p?.creado_clientify ?? null,
      ultimo_contacto: l.ultimo_contacto ?? p?.ultimo_contacto ?? null,
      etiquetas: l.etiquetas.length ? l.etiquetas : ((p?.etiquetas as string[] | null) ?? []),
      observaciones: l.observaciones ?? p?.observaciones ?? null,
      campos_personalizados: campos,
      direccion: l.direccion ?? p?.direccion ?? null,
      ciudad: l.ciudad ?? p?.ciudad ?? null,
      comuna: l.ciudad ?? p?.comuna ?? null,
      region: l.region ?? p?.region ?? null,
      pais: l.pais ?? p?.pais ?? null,
      email: emails[0]?.email ?? null,
      emails,
      telefono: telefonos[0]?.phone ?? null,
      telefonos,
      sincronizado_en: inicio,
    };
  });

  const { error } = await supabase.from("clientify_contactos").upsert(filas, { onConflict: "id_clientify" });
  if (error) return { error: error.message };
  return { nuevos, actualizados: leads.length - nuevos };
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
    revalidatePath("/leads");
    return { error };
  }

  let quitados = 0;
  if (esperados !== null && esperados > 0 && leidos === esperados) {
    const { data: borrados, error: errBorrar } = await supabase
      .from("clientify_contactos")
      .delete()
      .eq("fuente", "clientify")
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

  // Con los contactos al dia, se enlazan con su ficha de cliente los que se
  // reconocen sin duda (mismo email, o mismo telefono y nombre parecido).
  const { enlazados } = await enlazarLeadsConClientes();

  revalidatePath("/leads");
  return { ok: true, leidos, quitados, enlazados };
}

// Enlaza cada lead con la ficha de cliente que es la misma persona, cuando la
// coincidencia es segura. Nunca pisa un enlace que ya existe. Solo el
// Administrador; la base lo comprueba igual.
export async function enlazarLeadsConClientes(): Promise<{
  enlazados: number;
  pendientes: number;
  error?: string;
}> {
  const sinPermiso = await exigirAdmin();
  if (sinPermiso) return { enlazados: 0, pendientes: 0, error: sinPermiso };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clientify_enlazar_fichas");
  if (error) return { enlazados: 0, pendientes: 0, error: error.message };

  const r = (data ?? {}) as {
    por_email?: number;
    por_telefono_y_nombre?: number;
    pendientes_de_revisar?: number;
  };
  revalidatePath("/leads");
  return {
    enlazados: (r.por_email ?? 0) + (r.por_telefono_y_nombre ?? 0),
    pendientes: r.pendientes_de_revisar ?? 0,
  };
}

// Trae todos los contactos por la API de Clientify. Solo sirve si la cuenta
// tiene la clave de API; si no, se carga el archivo.
export async function sincronizarClientify(): Promise<ResultadoSync> {
  if (!hayClaveClientify())
    return { error: "Falta cargar la clave de la API (CLIENTIFY_API_KEY) en Vercel." };

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

// --- Oportunidades del CRM ---------------------------------------------------

// Sube un lote de oportunidades leidas de la planilla. Completa y pone al dia:
// lo que el archivo no trae no se borra, y los folios de cotizacion ya enlazados
// se conservan. El archivo trae el nombre del propietario y no su email: se toma
// el que ya usan sus leads.
export async function guardarLoteOportunidades(
  oportunidades: OportunidadImportada[]
): Promise<{ nuevas?: number; actualizadas?: number; error?: string }> {
  const sinPermiso = await exigirAdmin();
  if (sinPermiso) return { error: sinPermiso };
  if (!Array.isArray(oportunidades) || oportunidades.length === 0)
    return { nuevas: 0, actualizadas: 0 };
  if (oportunidades.length > 300) return { error: "El lote es demasiado grande." };

  const supabase = await createClient();
  const ids = oportunidades.map((o) => o.id).filter((n) => Number.isInteger(n));

  const [{ data: previas }, { data: duenos }] = await Promise.all([
    supabase
      .from("clientify_oportunidades")
      .select("id_clientify, cotizaciones, propietario_email, id_contacto, id_empresa, id_etapa, id_pipeline")
      .in("id_clientify", ids),
    supabase
      .from("clientify_contactos")
      .select("propietario, propietario_email")
      .not("propietario_email", "is", null)
      .limit(2000),
  ]);
  const previa = new Map((previas ?? []).map((p) => [Number(p.id_clientify), p]));
  const emailDe = new Map<string, string>();
  for (const d of duenos ?? [])
    if (d.propietario && d.propietario_email)
      emailDe.set(String(d.propietario).toLowerCase(), String(d.propietario_email));

  let nuevas = 0;
  const filas = oportunidades.map((o) => {
    const p = previa.get(o.id);
    if (!p) nuevas++;

    // Los folios ya enlazados se mantienen; los del nombre se suman.
    const cotizaciones = [...((p?.cotizaciones as string[] | null) ?? [])];
    for (const c of o.cotizaciones) if (!cotizaciones.includes(c)) cotizaciones.push(c);

    return {
      id_clientify: o.id,
      nombre: o.nombre,
      monto: o.monto,
      moneda: o.moneda,
      estado: o.estado,
      etapa: o.etapa,
      proceso: o.proceso,
      probabilidad: o.probabilidad,
      razon_perdida: o.razon_perdida,
      razon_ganada: o.razon_ganada,
      id_contacto: o.id_contacto ?? p?.id_contacto ?? null,
      id_empresa: p?.id_empresa ?? null,
      id_etapa: p?.id_etapa ?? null,
      id_pipeline: p?.id_pipeline ?? null,
      propietario_email:
        (o.propietario ? emailDe.get(o.propietario.toLowerCase()) : null) ?? p?.propietario_email ?? null,
      creado_clientify: o.creado,
      modificado_clientify: o.modificado,
      cierre_esperado: o.cierre_esperado,
      cierre_real: o.cierre_real,
      cotizaciones,
      sincronizado_en: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("clientify_oportunidades")
    .upsert(filas, { onConflict: "id_clientify" });
  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath("/");
  return { nuevas, actualizadas: filas.length - nuevas };
}
