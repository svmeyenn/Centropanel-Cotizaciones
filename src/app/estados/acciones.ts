"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { MARCAS, codigoParaNuevo, ordenados, type Estado, type TipoEstado } from "@/lib/catalogoEstados";
import type { Vendedor } from "@/types/database";

export type Resultado = { ok: boolean; mensaje?: string };

const TABLAS: Record<TipoEstado, string> = { lead: "estados_lead", cotizacion: "estados_cotizacion" };
const COLUMNAS = "codigo, etiqueta, orden, activo, es_sistema, rol, marcas, protegido, motivo_proteccion";

// Los estados son los mismos en Chile y en Peru, asi que los cambia solo quien
// administra los dos mercados. La base vuelve a exigirlo: esto solo da un
// mensaje claro antes de llegar ahi.
async function exigirAdminGeneral(): Promise<{ ok: true; v: Vendedor } | { ok: false; mensaje: string }> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v) || v.mercado !== "Ambos")
    return { ok: false, mensaje: "Los estados son los mismos en los dos mercados: solo los cambia quien administra ambos." };
  return { ok: true, v };
}

const tipoValido = (t: string): t is TipoEstado => t === "lead" || t === "cotizacion";

function marcasValidas(tipo: TipoEstado, marcas: string[]): string[] | null {
  const permitidas = MARCAS[tipo].map((m) => m.marca);
  const limpias = [...new Set(marcas)];
  return limpias.every((m) => permitidas.includes(m)) ? limpias : null;
}

function refrescar() {
  // Los nombres de los estados se leen en casi todas las pantallas.
  revalidatePath("/", "layout");
}

async function leerTodos(tipo: TipoEstado): Promise<Estado[]> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLAS[tipo]).select(COLUMNAS);
  return ordenados(((data ?? []) as Record<string, unknown>[]).map((f) => ({ ...f, motivo: f.motivo_proteccion ?? null })) as unknown as Estado[]);
}

// El mensaje de la base cuando algo no se puede: ya viene escrito para quien lo lee.
const mensajeDe = (e: { message: string; code?: string }) =>
  e.code === "42501" ? "Su perfil no puede cambiar los estados." : e.message;

export async function crearEstado(tipo: string, etiqueta: string, marcas: string[]): Promise<Resultado> {
  const p = await exigirAdminGeneral();
  if (!p.ok) return p;
  if (!tipoValido(tipo)) return { ok: false, mensaje: "Ese tipo de estado no existe." };

  const nombre = etiqueta.trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 40) return { ok: false, mensaje: "El nombre tiene que tener entre 2 y 40 letras." };
  const m = marcasValidas(tipo, marcas);
  if (!m) return { ok: false, mensaje: "Hay un significado que el sistema no conoce." };

  const todos = await leerTodos(tipo);
  if (todos.some((x) => x.etiqueta.toLowerCase() === nombre.toLowerCase()))
    return { ok: false, mensaje: `Ya hay un estado llamado "${nombre}".` };
  const codigo = codigoParaNuevo(tipo, nombre, todos.map((x) => x.codigo));
  if (!codigo) return { ok: false, mensaje: "Ese nombre no sirve: use letras o numeros." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLAS[tipo]).insert({
    codigo,
    etiqueta: nombre,
    // Al final de la lista; despues se sube o se baja.
    orden: Math.max(0, ...todos.map((x) => x.orden)) + 10,
    marcas: m,
  });
  if (error) return { ok: false, mensaje: mensajeDe(error) };
  refrescar();
  return { ok: true, mensaje: `Estado "${nombre}" agregado.` };
}

// Cambiar un estado. Uno del sistema se renombra y se deja de ofrecer --salvo los
// protegidos, que el sistema necesita--, pero no cambia de significado. Uno
// agregado puede cambiar todo menos su codigo. La base protege cada regla.
export async function guardarEstado(
  tipo: string,
  codigo: string,
  cambios: { etiqueta?: string; activo?: boolean; marcas?: string[] }
): Promise<Resultado> {
  const p = await exigirAdminGeneral();
  if (!p.ok) return p;
  if (!tipoValido(tipo)) return { ok: false, mensaje: "Ese tipo de estado no existe." };

  const cambio: Record<string, unknown> = {};
  if (cambios.etiqueta !== undefined) {
    const nombre = cambios.etiqueta.trim().replace(/\s+/g, " ");
    if (nombre.length < 2 || nombre.length > 40) return { ok: false, mensaje: "El nombre tiene que tener entre 2 y 40 letras." };
    const todos = await leerTodos(tipo);
    if (todos.some((x) => x.codigo !== codigo && x.etiqueta.toLowerCase() === nombre.toLowerCase()))
      return { ok: false, mensaje: `Ya hay un estado llamado "${nombre}".` };
    cambio.etiqueta = nombre;
  }
  if (cambios.activo !== undefined) cambio.activo = cambios.activo;
  if (cambios.marcas !== undefined) {
    const m = marcasValidas(tipo, cambios.marcas);
    if (!m) return { ok: false, mensaje: "Hay un significado que el sistema no conoce." };
    cambio.marcas = m;
  }
  if (Object.keys(cambio).length === 0) return { ok: true, mensaje: "Sin cambios." };

  const supabase = await createClient();
  const { data, error } = await supabase.from(TABLAS[tipo]).update(cambio).eq("codigo", codigo).select("codigo");
  if (error) return { ok: false, mensaje: mensajeDe(error) };
  // Una actualizacion que la base no deja hacer no da error: no toca ninguna fila.
  if (!data || data.length === 0) return { ok: false, mensaje: "No se pudo cambiar: su perfil no tiene permiso." };
  refrescar();
  return { ok: true, mensaje: "Cambios guardados." };
}

export async function eliminarEstado(tipo: string, codigo: string): Promise<Resultado> {
  const p = await exigirAdminGeneral();
  if (!p.ok) return p;
  if (!tipoValido(tipo)) return { ok: false, mensaje: "Ese tipo de estado no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase.from(TABLAS[tipo]).delete().eq("codigo", codigo).select("codigo");
  if (error) return { ok: false, mensaje: mensajeDe(error) };
  if (!data || data.length === 0) return { ok: false, mensaje: "No se pudo eliminar: su perfil no tiene permiso." };
  refrescar();
  return { ok: true, mensaje: "Estado eliminado." };
}

// Subir o bajar un estado en la lista. El orden se vuelve a numerar de diez en
// diez: dos estados con el mismo numero no se pueden intercambiar.
export async function moverEstado(tipo: string, codigo: string, direccion: "subir" | "bajar"): Promise<Resultado> {
  const p = await exigirAdminGeneral();
  if (!p.ok) return p;
  if (!tipoValido(tipo)) return { ok: false, mensaje: "Ese tipo de estado no existe." };

  const lista = await leerTodos(tipo);
  const i = lista.findIndex((x) => x.codigo === codigo);
  const j = direccion === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true };
  [lista[i], lista[j]] = [lista[j], lista[i]];

  const supabase = await createClient();
  for (let k = 0; k < lista.length; k++) {
    const nuevo = (k + 1) * 10;
    if (lista[k].orden === nuevo) continue;
    const { error } = await supabase.from(TABLAS[tipo]).update({ orden: nuevo }).eq("codigo", lista[k].codigo);
    if (error) return { ok: false, mensaje: mensajeDe(error) };
  }
  refrescar();
  return { ok: true };
}

// Volver a crear los estados originales que se eliminaron, con su codigo y su
// significado de origen. Solo agrega los que faltan.
export async function restaurarEstados(tipo: string): Promise<Resultado> {
  const p = await exigirAdminGeneral();
  if (!p.ok) return p;
  if (!tipoValido(tipo)) return { ok: false, mensaje: "Ese tipo de estado no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estados_restaurar", { p_tipo: tipo });
  if (error) return { ok: false, mensaje: mensajeDe(error) };
  refrescar();
  const n = Number(data ?? 0);
  return { ok: true, mensaje: n === 0 ? "No faltaba ninguno." : n === 1 ? "Se restauro 1 estado." : `Se restauraron ${n} estados.` };
}
