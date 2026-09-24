"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { GRUPOS_DESCUENTO } from "@/lib/descuentos";

// Familias y subfamilias del catalogo: la clasificacion con que se lee el
// catalogo y, en el caso de la familia, lo que decide a que descuento de la
// cotizacion pertenece un producto.

type Resultado = { error?: string };

async function admin(): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede administrar el catalogo." };
  }
  return {};
}

function refrescar() {
  revalidatePath("/familias");
  revalidatePath("/productos");
  revalidatePath("/cotizaciones");
}

function duplicado(mensaje: string, e: { code?: string; message: string }) {
  return { error: e.code === "23505" ? mensaje : e.message };
}

export async function crearFamilia(
  idPais: number,
  nombre: string,
  grupo: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  const n = nombre.trim();
  if (!n) return { error: "Indique el nombre de la familia." };
  if (!(GRUPOS_DESCUENTO as readonly string[]).includes(grupo)) {
    return { error: "Grupo de descuento no valido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("familias")
    .insert({ id_pais: idPais, nombre: n, grupo });
  if (error) return duplicado("Ya existe una familia con ese nombre.", error);
  refrescar();
  return {};
}

// Renombrar arrastra a los productos: si no, quedarian apuntando a una familia
// que ya no existe. Las subfamilias las arrastra la propia base.
export async function renombrarFamilia(
  idPais: number,
  nombre: string,
  nuevo: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  const n = nuevo.trim();
  if (!n) return { error: "Indique el nombre nuevo." };
  if (n === nombre) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("familias")
    .update({ nombre: n })
    .eq("id_pais", idPais)
    .eq("nombre", nombre);
  if (error) return duplicado("Ya existe una familia con ese nombre.", error);

  const { error: eProd } = await supabase
    .from("productos")
    .update({ familia: n })
    .eq("id_pais", idPais)
    .eq("familia", nombre);
  if (eProd) return { error: eProd.message };

  refrescar();
  return {};
}

export async function eliminarFamilia(
  idPais: number,
  nombre: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;

  const supabase = await createClient();
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("id_pais", idPais)
    .eq("familia", nombre);
  if (count && count > 0) {
    return {
      error: `La familia tiene ${count} producto${count > 1 ? "s" : ""}. Muevalos antes de eliminarla.`,
    };
  }

  const { error } = await supabase
    .from("familias")
    .delete()
    .eq("id_pais", idPais)
    .eq("nombre", nombre);
  if (error) return { error: error.message };
  refrescar();
  return {};
}

export async function crearSubfamilia(
  idPais: number,
  familia: string,
  nombre: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  const n = nombre.trim();
  if (!n) return { error: "Indique el nombre de la subfamilia." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subfamilias")
    .insert({ id_pais: idPais, familia, nombre: n });
  if (error) {
    return duplicado("Ya existe una subfamilia con ese nombre en la familia.", error);
  }
  refrescar();
  return {};
}

export async function renombrarSubfamilia(
  idPais: number,
  familia: string,
  nombre: string,
  nuevo: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  const n = nuevo.trim();
  if (!n) return { error: "Indique el nombre nuevo." };
  if (n === nombre) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("subfamilias")
    .update({ nombre: n })
    .eq("id_pais", idPais)
    .eq("familia", familia)
    .eq("nombre", nombre);
  if (error) {
    return duplicado("Ya existe una subfamilia con ese nombre en la familia.", error);
  }

  const { error: eProd } = await supabase
    .from("productos")
    .update({ subfamilia: n })
    .eq("id_pais", idPais)
    .eq("familia", familia)
    .eq("subfamilia", nombre);
  if (eProd) return { error: eProd.message };

  refrescar();
  return {};
}

export async function eliminarSubfamilia(
  idPais: number,
  familia: string,
  nombre: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;

  const supabase = await createClient();
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("id_pais", idPais)
    .eq("familia", familia)
    .eq("subfamilia", nombre);
  if (count && count > 0) {
    return {
      error: `La subfamilia tiene ${count} producto${count > 1 ? "s" : ""}. Muevalos antes de eliminarla.`,
    };
  }

  const { error } = await supabase
    .from("subfamilias")
    .delete()
    .eq("id_pais", idPais)
    .eq("familia", familia)
    .eq("nombre", nombre);
  if (error) return { error: error.message };
  refrescar();
  return {};
}

// Mover un producto de familia o subfamilia sin salir del panel.
export async function moverProducto(
  id: number,
  familia: string,
  subfamilia: string | null
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;

  const supabase = await createClient();
  const { error } = await supabase
    .from("productos")
    .update({ familia, subfamilia: subfamilia || null })
    .eq("id", id);
  if (error) return { error: error.message };
  refrescar();
  return {};
}
