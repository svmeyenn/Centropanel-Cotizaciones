"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";

export interface DatosCarga {
  ancho_mm: number | null;
  largo_mm: number | null;
  alto_mm: number | null; // en materias primas es el espesor
  peso_kg: number | null;
  densidad_kg_m3?: number | null;
}

const positivo = (n: number | null | undefined) => n == null || (Number.isFinite(n) && n > 0);

// Peso y medidas viven en las maestras: cualquier cotizacion de flete las lee de aqui.
export async function guardarDatosCarga(clase: "producto" | "materia", id: number, d: DatosCarga) {
  const v = await requerirVendedor();
  if (!(v.puede_editar || tienePerfilAdmin(v))) return { error: "Su perfil no permite editar el catalogo." };
  const valores = [d.ancho_mm, d.largo_mm, d.alto_mm, d.peso_kg, d.densidad_kg_m3];
  if (!valores.every(positivo)) return { error: "Las medidas y el peso deben ser mayores que cero." };

  const supabase = await createClient();
  const { error } =
    clase === "producto"
      ? await supabase.from("productos").update({ ancho_mm: d.ancho_mm, largo_mm: d.largo_mm, alto_mm: d.alto_mm, peso_kg: d.peso_kg }).eq("id", id)
      : await supabase
          .from("materias_primas")
          .update({ ancho_mm: d.ancho_mm, largo_mm: d.largo_mm, espesor_mm: d.alto_mm, peso_kg: d.peso_kg, densidad_kg_m3: d.densidad_kg_m3 ?? null })
          .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/datos-carga");
  return {};
}
