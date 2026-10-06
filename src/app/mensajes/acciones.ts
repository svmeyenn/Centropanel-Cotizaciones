"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import type { Canal } from "@/lib/mensajes";

export type Resultado = { ok: boolean; mensaje?: string };

// Las plantillas de correo y de WhatsApp para escribirle a un lead. Las cambia
// quien administra; la base lo comprueba igual.
async function exigirAdmin(): Promise<Resultado | null> {
  const v = await requerirVendedor();
  return tienePerfilAdmin(v) ? null : { ok: false, mensaje: "Solo quien administra puede cambiar los mensajes." };
}

const mensajeDe = (e: { message: string; code?: string }) =>
  e.code === "42501" ? "Su perfil no puede cambiar los mensajes." : e.code === "23505" ? "Ya hay un mensaje con ese nombre." : e.message;

function limpiar(canal: Canal, nombre: string, asunto: string, cuerpo: string): { error: string } | { nombre: string; asunto: string | null; cuerpo: string } {
  const n = nombre.trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 60) return { error: "El nombre tiene que tener entre 2 y 60 letras." };
  const a = asunto.trim();
  if (canal === "email" && (a.length < 2 || a.length > 200)) return { error: "El asunto del correo es obligatorio (hasta 200 letras)." };
  const c = cuerpo.replace(/\r\n/g, "\n").trim();
  if (!c) return { error: "Escriba el texto del mensaje." };
  if (c.length > 4000) return { error: "El texto es muy largo: maximo 4000 letras." };
  return { nombre: n, asunto: canal === "email" ? a : null, cuerpo: c };
}

// La linea es un texto libre --paneles, casas, y las que vengan--: se acepta cualquiera con forma de clave.
const lineaValida = (l: string) => /^[a-z0-9_-]{1,40}$/.test(l);

export async function crearPlantilla(linea: string, canal: string, nombre: string, asunto: string, cuerpo: string): Promise<Resultado> {
  const no = await exigirAdmin();
  if (no) return no;
  if (canal !== "email" && canal !== "whatsapp") return { ok: false, mensaje: "Ese canal no existe." };
  if (!lineaValida(linea)) return { ok: false, mensaje: "Esa linea no es valida." };
  const l = limpiar(canal, nombre, asunto, cuerpo);
  if ("error" in l) return { ok: false, mensaje: l.error };

  const supabase = await createClient();
  const { data: ult } = await supabase.from("plantillas_mensaje").select("orden").eq("canal", canal).eq("linea", linea).order("orden", { ascending: false }).limit(1);
  const { error } = await supabase.from("plantillas_mensaje").insert({ canal, linea, ...l, orden: ((ult?.[0]?.orden as number | undefined) ?? 0) + 10 });
  if (error) return { ok: false, mensaje: mensajeDe(error) };
  revalidatePath("/mensajes");
  return { ok: true, mensaje: `Mensaje "${l.nombre}" agregado.` };
}

export async function guardarPlantilla(
  id: number,
  canal: string,
  cambios: { nombre: string; asunto: string; cuerpo: string; activo: boolean }
): Promise<Resultado> {
  const no = await exigirAdmin();
  if (no) return no;
  if (canal !== "email" && canal !== "whatsapp") return { ok: false, mensaje: "Ese canal no existe." };
  const l = limpiar(canal, cambios.nombre, cambios.asunto, cambios.cuerpo);
  if ("error" in l) return { ok: false, mensaje: l.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("plantillas_mensaje").update({ ...l, activo: cambios.activo }).eq("id", id).select("id");
  if (error) return { ok: false, mensaje: mensajeDe(error) };
  // Una actualizacion que la base no deja hacer no da error: no toca ninguna fila.
  if (!data || data.length === 0) return { ok: false, mensaje: "No se pudo guardar: su perfil no tiene permiso." };
  revalidatePath("/mensajes");
  return { ok: true, mensaje: "Cambios guardados." };
}

export async function eliminarPlantilla(id: number): Promise<Resultado> {
  const no = await exigirAdmin();
  if (no) return no;
  const supabase = await createClient();
  const { data, error } = await supabase.from("plantillas_mensaje").delete().eq("id", id).select("id");
  if (error) return { ok: false, mensaje: mensajeDe(error) };
  if (!data || data.length === 0) return { ok: false, mensaje: "No se pudo eliminar: su perfil no tiene permiso." };
  revalidatePath("/mensajes");
  return { ok: true, mensaje: "Mensaje eliminado." };
}

// Subir o bajar en la lista. El orden se vuelve a numerar de diez en diez.
export async function moverPlantilla(linea: string, canal: string, id: number, direccion: "subir" | "bajar"): Promise<Resultado> {
  const no = await exigirAdmin();
  if (no) return no;
  if (canal !== "email" && canal !== "whatsapp") return { ok: false, mensaje: "Ese canal no existe." };
  const supabase = await createClient();
  const { data } = await supabase.from("plantillas_mensaje").select("id, orden").eq("canal", canal).eq("linea", linea).order("orden").order("id");
  const lista = (data ?? []) as { id: number; orden: number }[];
  const i = lista.findIndex((x) => x.id === id);
  const j = direccion === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true };
  [lista[i], lista[j]] = [lista[j], lista[i]];
  for (let k = 0; k < lista.length; k++) {
    const nuevo = (k + 1) * 10;
    if (lista[k].orden === nuevo) continue;
    const { error } = await supabase.from("plantillas_mensaje").update({ orden: nuevo }).eq("id", lista[k].id);
    if (error) return { ok: false, mensaje: mensajeDe(error) };
  }
  revalidatePath("/mensajes");
  return { ok: true };
}
