"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

// Claves que el sistema necesita para funcionar: se pueden editar pero no
// borrar, y el aviso de la pantalla lo deja claro.
export async function guardarParametro(
  clave: string,
  valorNum: number | null,
  valorTexto: string | null
) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede cambiar los parametros." };
  }

  // El margen y el IVA se guardan como fraccion (0,30 y 0,19), no como 30 y 19:
  // si alguien escribe 30 el precio se dispararia. Se valida el rango.
  if ((clave === "MargenObjetivo" || clave === "IVA") && valorNum != null) {
    if (valorNum < 0 || valorNum >= 1) {
      return {
        error: `${clave} se expresa como fraccion entre 0 y 1 (por ejemplo 0,30 para un 30%).`,
      };
    }
  }
  if (clave === "ValidezDias" && valorNum != null && valorNum <= 0) {
    return { error: "La validez debe ser de al menos un dia." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("parametros")
    .update({ valor_num: valorNum, valor_texto: valorTexto })
    .eq("clave", clave);
  if (error) return { error: error.message };

  revalidatePath("/parametros");
  // Los datos de empresa salen en el PDF y el margen afecta al configurador.
  revalidatePath("/configurador");
  return { ok: true };
}
