"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

// Listas con que se clasifican las materias primas: etiqueta, familia y
// unidad por mercado, y el tipo, que ademas define si el insumo puede ser
// nucleo o cara de un panel y por eso vale para todos los mercados.
export type Resultado = { error?: string };
export type ClaseMateria = "Etiqueta" | "Familia" | "Unidad";

const CLASES: ClaseMateria[] = ["Etiqueta", "Familia", "Unidad"];

// La columna de materias_primas que guarda cada clase.
const COLUMNA: Record<ClaseMateria, string> = {
  Etiqueta: "etiqueta",
  Familia: "familia",
  Unidad: "unidad",
};

async function admin(): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede administrar estas listas." };
  }
  return {};
}

function refrescar() {
  revalidatePath("/parametros-materias");
  revalidatePath("/materias-primas");
  revalidatePath("/configurador");
}

export async function crearParametroMateria(
  idPais: number,
  clase: string,
  nombre: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  if (!CLASES.includes(clase as ClaseMateria)) return { error: "Lista no valida." };
  const n = nombre.trim();
  if (!n) return { error: "Indique el nombre." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("parametros_materia")
    .insert({ id_pais: idPais, clase, nombre: n });
  if (error) {
    return {
      error: error.code === "23505" ? "Ese valor ya existe en la lista." : error.message,
    };
  }
  refrescar();
  return {};
}

// Renombrar arrastra a las materias primas que lo usan: si no, quedarian con
// un valor que ya no esta en la lista.
export async function renombrarParametroMateria(
  idPais: number,
  clase: string,
  nombre: string,
  nuevo: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  if (!CLASES.includes(clase as ClaseMateria)) return { error: "Lista no valida." };
  const n = nuevo.trim();
  if (!n) return { error: "Indique el nombre nuevo." };
  if (n === nombre) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("parametros_materia")
    .update({ nombre: n })
    .eq("id_pais", idPais)
    .eq("clase", clase)
    .eq("nombre", nombre);
  if (error) {
    return {
      error: error.code === "23505" ? "Ese valor ya existe en la lista." : error.message,
    };
  }

  const { error: eMat } = await supabase
    .from("materias_primas")
    .update({ [COLUMNA[clase as ClaseMateria]]: n })
    .eq("id_pais", idPais)
    .eq(COLUMNA[clase as ClaseMateria], nombre);
  if (eMat) return { error: eMat.message };

  refrescar();
  return {};
}

export async function eliminarParametroMateria(
  idPais: number,
  clase: string,
  nombre: string
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  if (!CLASES.includes(clase as ClaseMateria)) return { error: "Lista no valida." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("materias_primas")
    .select("id", { count: "exact", head: true })
    .eq("id_pais", idPais)
    .eq(COLUMNA[clase as ClaseMateria], nombre);
  if (count && count > 0) {
    return {
      error: `Hay ${count} materia${count > 1 ? "s" : ""} prima${count > 1 ? "s" : ""} con ese valor. Cambielas antes de eliminarlo.`,
    };
  }

  const { error } = await supabase
    .from("parametros_materia")
    .delete()
    .eq("id_pais", idPais)
    .eq("clase", clase)
    .eq("nombre", nombre);
  if (error) return { error: error.message };
  refrescar();
  return {};
}

export interface DatosTipoMateria {
  nombre: string;
  es_nucleo: boolean;
  es_cara: boolean;
  orden: number;
  activo: boolean;
}

export async function crearTipoMateria(d: DatosTipoMateria): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  if (!d.nombre.trim()) return { error: "Indique el nombre del tipo." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tipos_materia")
    .insert({ ...d, nombre: d.nombre.trim() });
  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe un tipo con ese nombre." : error.message,
    };
  }
  refrescar();
  return {};
}

export async function actualizarTipoMateria(
  id: number,
  d: DatosTipoMateria
): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;
  if (!d.nombre.trim()) return { error: "Indique el nombre del tipo." };

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("tipos_materia")
    .select("nombre")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("tipos_materia")
    .update({ ...d, nombre: d.nombre.trim() })
    .eq("id", id);
  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe un tipo con ese nombre." : error.message,
    };
  }

  // El tipo se guarda por nombre en cada insumo, asi que al renombrarlo hay
  // que arrastrar a los que lo usaban.
  if (antes?.nombre && antes.nombre !== d.nombre.trim()) {
    const { error: eMat } = await supabase
      .from("materias_primas")
      .update({ tipo: d.nombre.trim() })
      .eq("tipo", antes.nombre);
    if (eMat) return { error: eMat.message };
  }

  refrescar();
  return {};
}

export async function eliminarTipoMateria(id: number): Promise<Resultado> {
  const g = await admin();
  if (g.error) return g;

  const supabase = await createClient();
  const { data: tipo } = await supabase
    .from("tipos_materia")
    .select("nombre")
    .eq("id", id)
    .single();
  if (!tipo) return { error: "El tipo no existe." };

  const { count } = await supabase
    .from("materias_primas")
    .select("id", { count: "exact", head: true })
    .eq("tipo", tipo.nombre);
  if (count && count > 0) {
    return {
      error: `Hay ${count} materia${count > 1 ? "s" : ""} prima${count > 1 ? "s" : ""} de ese tipo. Cambielas antes de eliminarlo.`,
    };
  }

  const { error } = await supabase.from("tipos_materia").delete().eq("id", id);
  if (error) return { error: error.message };
  refrescar();
  return {};
}
