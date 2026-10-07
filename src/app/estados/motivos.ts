"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import type { TipoEstado } from "@/lib/catalogoEstados";
import type { MotivoOpcion } from "@/lib/motivosEstado";

export type Resultado = { ok: boolean; mensaje?: string };

const tipoValido = (t: string): t is TipoEstado => t === "lead" || t === "cotizacion";

// Los motivos, como los estados, son los mismos en Chile y en Peru: los cambia solo
// quien administra los dos mercados. La base vuelve a exigirlo.
async function exigirAdminGeneral(): Promise<string | null> {
  const v = await requerirVendedor();
  return tienePerfilAdmin(v) && v.mercado === "Ambos"
    ? null
    : "Los motivos son los mismos en los dos mercados: solo los cambia quien administra ambos.";
}

const refrescar = () => revalidatePath("/motivos");

// Lo que se ofrece al cambiar a un estado: los motivos activos y si hay que elegir uno.
export async function motivosDe(
  tipo: string,
  estado: string
): Promise<{ motivos: MotivoOpcion[]; obligatorio: boolean }> {
  await requerirVendedor();
  if (!tipoValido(tipo)) return { motivos: [], obligatorio: false };
  const supabase = await createClient();
  const [{ data }, { data: oblig }] = await Promise.all([
    supabase
      .from("motivos_estado")
      .select("id, etiqueta")
      .eq("tipo", tipo)
      .eq("estado", estado)
      .eq("activo", true)
      .order("orden")
      .order("id"),
    supabase.from("motivos_obligatorios").select("estado").eq("tipo", tipo).eq("estado", estado).limit(1),
  ]);
  const motivos = ((data ?? []) as { id: number; etiqueta: string }[]).map((m) => ({ id: Number(m.id), etiqueta: m.etiqueta }));
  return { motivos, obligatorio: motivos.length > 0 && (oblig?.length ?? 0) > 0 };
}

const limpiar = (s: string) => s.trim().replace(/\s+/g, " ");

export async function crearMotivo(tipo: string, estado: string, etiqueta: string): Promise<Resultado> {
  const sin = await exigirAdminGeneral();
  if (sin) return { ok: false, mensaje: sin };
  if (!tipoValido(tipo)) return { ok: false, mensaje: "Ese tipo de estado no existe." };
  const nombre = limpiar(etiqueta);
  if (nombre.length < 2 || nombre.length > 60) return { ok: false, mensaje: "El motivo tiene que tener entre 2 y 60 letras." };

  const supabase = await createClient();
  const { data: previos } = await supabase.from("motivos_estado").select("id, etiqueta, orden").eq("tipo", tipo).eq("estado", estado);
  if ((previos ?? []).some((m) => String(m.etiqueta).toLowerCase() === nombre.toLowerCase()))
    return { ok: false, mensaje: `Ya hay un motivo llamado "${nombre}" en este estado.` };
  const orden = Math.max(0, ...(previos ?? []).map((m) => Number(m.orden))) + 10;
  const { error } = await supabase.from("motivos_estado").insert({ tipo, estado, etiqueta: nombre, orden });
  if (error) return { ok: false, mensaje: error.code === "42501" ? "Su perfil no puede cambiar los motivos." : error.message };
  refrescar();
  return { ok: true, mensaje: `Motivo "${nombre}" agregado.` };
}

export async function guardarMotivo(
  id: number,
  cambios: { etiqueta?: string; activo?: boolean }
): Promise<Resultado> {
  const sin = await exigirAdminGeneral();
  if (sin) return { ok: false, mensaje: sin };
  const cambio: Record<string, unknown> = {};
  if (cambios.etiqueta !== undefined) {
    const nombre = limpiar(cambios.etiqueta);
    if (nombre.length < 2 || nombre.length > 60) return { ok: false, mensaje: "El motivo tiene que tener entre 2 y 60 letras." };
    cambio.etiqueta = nombre;
  }
  if (cambios.activo !== undefined) cambio.activo = cambios.activo;
  if (Object.keys(cambio).length === 0) return { ok: true, mensaje: "Sin cambios." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("motivos_estado")
    .update({ ...cambio, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error)
    return { ok: false, mensaje: error.code === "23505" ? "Ya hay un motivo con ese nombre en este estado." : error.message };
  if (!data?.length) return { ok: false, mensaje: "No se pudo cambiar: su perfil no tiene permiso." };
  refrescar();
  return { ok: true, mensaje: "Cambios guardados." };
}

// Un motivo ya usado se puede eliminar: los registros que lo usaron conservan su nombre.
export async function eliminarMotivo(id: number): Promise<Resultado> {
  const sin = await exigirAdminGeneral();
  if (sin) return { ok: false, mensaje: sin };
  const supabase = await createClient();
  const { data, error } = await supabase.from("motivos_estado").delete().eq("id", id).select("id");
  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No se pudo eliminar: su perfil no tiene permiso." };
  refrescar();
  return { ok: true, mensaje: "Motivo eliminado." };
}

// Subir o bajar un motivo dentro de su estado; el orden se vuelve a numerar de diez en diez.
export async function moverMotivo(id: number, direccion: "subir" | "bajar"): Promise<Resultado> {
  const sin = await exigirAdminGeneral();
  if (sin) return { ok: false, mensaje: sin };
  const supabase = await createClient();
  const { data: uno } = await supabase.from("motivos_estado").select("tipo, estado").eq("id", id).maybeSingle();
  if (!uno) return { ok: false, mensaje: "No se encontro el motivo." };
  const { data } = await supabase
    .from("motivos_estado")
    .select("id, orden")
    .eq("tipo", uno.tipo)
    .eq("estado", uno.estado)
    .order("orden")
    .order("id");
  const lista = (data ?? []) as { id: number; orden: number }[];
  const i = lista.findIndex((m) => Number(m.id) === id);
  const j = direccion === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true };
  [lista[i], lista[j]] = [lista[j], lista[i]];
  for (let k = 0; k < lista.length; k++) {
    const nuevo = (k + 1) * 10;
    if (Number(lista[k].orden) === nuevo) continue;
    const { error } = await supabase.from("motivos_estado").update({ orden: nuevo }).eq("id", lista[k].id);
    if (error) return { ok: false, mensaje: error.message };
  }
  refrescar();
  return { ok: true };
}

export async function fijarObligatorio(tipo: string, estado: string, obligatorio: boolean): Promise<Resultado> {
  const sin = await exigirAdminGeneral();
  if (sin) return { ok: false, mensaje: sin };
  if (!tipoValido(tipo)) return { ok: false, mensaje: "Ese tipo de estado no existe." };
  const supabase = await createClient();
  const { error } = obligatorio
    ? await supabase.from("motivos_obligatorios").upsert({ tipo, estado }, { onConflict: "tipo,estado", ignoreDuplicates: true })
    : await supabase.from("motivos_obligatorios").delete().eq("tipo", tipo).eq("estado", estado);
  if (error) return { ok: false, mensaje: error.code === "42501" ? "Su perfil no puede cambiar los motivos." : error.message };
  refrescar();
  return { ok: true, mensaje: obligatorio ? "Ahora exige elegir un motivo." : "Ya no exige motivo." };
}
