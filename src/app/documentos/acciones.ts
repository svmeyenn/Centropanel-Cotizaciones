"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { BUCKET_DOCUMENTOS } from "@/lib/documentos";
import { EXTENSIONES_PROHIBIDAS, TOPE_ARCHIVO_LEAD } from "@/lib/leads";

export type Resultado = { ok: boolean; mensaje?: string };

// El navegador sube el archivo directo al deposito y despues pide anotarlo aqui con su nota.
export async function registrarDocumento(d: {
  ruta: string;
  nombre: string;
  tipo: string;
  tamano: number;
  nota: string;
  idPais: number | null;
}): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return { ok: false, mensaje: "Solo el administrador sube documentos a la biblioteca." };

  const supabase = await createClient();
  const quitar = () => supabase.storage.from(BUCKET_DOCUMENTOS).remove([d.ruta]);
  const nota = d.nota.trim();

  if (!d.ruta || d.ruta.includes("..") || d.ruta.includes("/")) return { ok: false, mensaje: "La ruta del archivo no es valida." };
  if (!nota) {
    await quitar();
    return { ok: false, mensaje: "Escriba una nota que diga que es el documento." };
  }
  if (!d.nombre.trim() || EXTENSIONES_PROHIBIDAS.test(d.nombre)) {
    await quitar();
    return { ok: false, mensaje: "Ese tipo de archivo no se puede subir." };
  }
  if (d.tamano > TOPE_ARCHIVO_LEAD) {
    await quitar();
    return { ok: false, mensaje: "El archivo pesa mas de 25 MB." };
  }

  // Que lo que se anota exista de verdad en el deposito.
  const { data: presentes } = await supabase.storage.from(BUCKET_DOCUMENTOS).list("", { search: d.ruta });
  if (!(presentes ?? []).some((f) => f.name === d.ruta)) return { ok: false, mensaje: "El archivo no llego al deposito. Intente de nuevo." };

  const { error } = await supabase.from("documentos_comerciales").insert({
    nombre: d.nombre.trim().slice(0, 200),
    nota: nota.slice(0, 500),
    ruta: d.ruta,
    tipo_mime: d.tipo || null,
    tamano: d.tamano,
    id_pais: d.idPais,
    id_vendedor: v.id,
  });
  if (error) {
    await quitar();
    return { ok: false, mensaje: error.message };
  }
  revalidatePath("/documentos");
  return { ok: true, mensaje: "Documento subido." };
}

// Corregir la nota, el mercado o dejarlo fuera de uso sin borrarlo.
export async function editarDocumento(id: number, d: { nota: string; idPais: number | null; activo: boolean }): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return { ok: false, mensaje: "Solo el administrador edita la biblioteca." };
  const nota = d.nota.trim();
  if (!nota) return { ok: false, mensaje: "La nota no puede quedar vacia." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documentos_comerciales")
    .update({ nota: nota.slice(0, 500), id_pais: d.idPais, activo: d.activo })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No se encontro el documento." };
  revalidatePath("/documentos");
  return { ok: true, mensaje: "Guardado." };
}

export async function quitarDocumento(id: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return { ok: false, mensaje: "Solo el administrador quita documentos." };
  const supabase = await createClient();
  // Primero la fila --la base decide si se puede--; solo si se borro se saca el archivo.
  const { data, error } = await supabase.from("documentos_comerciales").delete().eq("id", id).select("ruta");
  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No se encontro el documento." };
  await supabase.storage.from(BUCKET_DOCUMENTOS).remove([data[0].ruta as string]);
  revalidatePath("/documentos");
  return { ok: true, mensaje: "Documento quitado." };
}

// El deposito es privado: para abrir o adjuntar un documento se pide un enlace de diez minutos.
export async function urlDocumento(id: number): Promise<{ url?: string; error?: string }> {
  await requerirVendedor();
  const supabase = await createClient();
  const { data: fila } = await supabase.from("documentos_comerciales").select("ruta").eq("id", id).maybeSingle();
  if (!fila) return { error: "No se encontro el documento." };
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(fila.ruta as string, 60 * 10);
  if (error || !data) return { error: error?.message ?? "No se pudo abrir el documento." };
  return { url: data.signedUrl };
}
