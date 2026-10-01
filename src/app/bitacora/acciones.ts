"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import type { Anotacion } from "@/lib/bitacora";

// El historial de una fila. Lo puede mirar cualquiera que entre al sistema: la
// gracia es poder revisar que paso con un documento sin tener que pedirselo a
// nadie.
export async function cambiosDe(tabla: string, idFila: string | number) {
  await requerirVendedor();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bitacora")
    .select("id, accion, hecho_en, quien, cambios")
    .eq("tabla", tabla)
    .eq("id_fila", String(idFila))
    .order("hecho_en", { ascending: false })
    .limit(200);
  if (error) return { error: error.message };
  return { anotaciones: (data ?? []) as Anotacion[] };
}
