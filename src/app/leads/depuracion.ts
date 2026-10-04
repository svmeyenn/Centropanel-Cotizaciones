"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { DIAS_POR_DEFECTO, type ClaveCaducidad } from "@/lib/caducidad";
import type { Resultado } from "@/app/leads/actividad-lead";

// El plazo de cada regla de caducidad es un parametro del mercado, no un numero
// escrito en el codigo: Chile y Peru pueden tener ritmos distintos y la regla se
// ajusta sin tocar el sistema.
export async function guardarDiasCaducidad(
  clave: ClaveCaducidad,
  dias: number
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v))
    return { ok: false, mensaje: "Solo quien administra puede cambiar los plazos." };
  if (!(clave in DIAS_POR_DEFECTO)) return { ok: false, mensaje: "Ese plazo no existe." };
  if (!Number.isInteger(dias) || dias < 0 || dias > 3650)
    return { ok: false, mensaje: "El plazo tiene que ser un numero de dias entre 0 y 3.650." };

  // Sin mercado activo no se sabe cual se esta configurando: se elige arriba.
  const { activo } = await contextoMercado(v);
  if (!activo)
    return {
      ok: false,
      mensaje: "Elija un mercado en la cabecera: el plazo se guarda para ese mercado.",
    };

  const supabase = await createClient();
  const { error } = await supabase
    .from("parametros")
    .update({ valor_num: dias })
    .eq("clave", clave)
    .eq("id_pais", activo.id);
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/leads/depurar");
  revalidatePath("/parametros");
  return { ok: true, mensaje: `Plazo guardado para ${activo.nombre}: ${dias} dias.` };
}
