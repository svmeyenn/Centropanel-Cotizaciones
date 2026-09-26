"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { leerArchivoCartola } from "@/lib/finanzas/cartola-banco";

export type Resultado = { ok: boolean; mensaje?: string };

// Conciliar es enlazar cada linea de la cartola del banco con el movimiento
// que la explica. Nada de esto toca los movimientos: la cartola es del banco y
// se guarda como viene.

export async function importarCartola(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return {
      ok: false,
      mensaje: "Solo quien paga gastos puede cargar la cartola del banco.",
    };

  const idCuenta = Number(d.get("id_cuenta"));
  if (!Number.isInteger(idCuenta) || idCuenta <= 0)
    return { ok: false, mensaje: "Elija la cuenta de esta cartola." };

  const archivo = d.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0)
    return { ok: false, mensaje: "Falta el archivo de la cartola." };

  const leido = await leerArchivoCartola(archivo);
  if (!leido.ok) return { ok: false, mensaje: leido.mensaje };

  const supabase = await createClient();

  // `ignoreDuplicates` es lo que permite volver a cargar la misma cartola sin
  // duplicarla: las lineas que ya estaban se saltan por su huella.
  const { data, error } = await supabase
    .from("cartola_banco")
    .upsert(
      leido.filas.map((f) => ({ ...f, id_cuenta: idCuenta, id_vendedor: v.id })),
      { onConflict: "id_cuenta,huella", ignoreDuplicates: true }
    )
    .select("id_linea");

  if (error) return { ok: false, mensaje: error.message };

  const nuevas = data?.length ?? 0;
  const fechas = leido.filas.map((f) => f.fecha).sort();

  const { data: cuadradas, error: errorCuadre } = await supabase.rpc(
    "fin_conciliar_automatico",
    {
      p_id_cuenta: idCuenta,
      p_desde: fechas[0],
      p_hasta: fechas[fechas.length - 1],
    }
  );

  revalidatePath("/conciliacion");

  if (errorCuadre)
    return {
      ok: true,
      mensaje: `Cargue ${nuevas} linea(s) de ${leido.filas.length}. El cuadre automatico fallo: ${errorCuadre.message}`,
    };

  const repetidas = leido.filas.length - nuevas;
  return {
    ok: true,
    mensaje:
      `Cargue ${nuevas} linea(s) nueva(s)` +
      (repetidas > 0 ? ` (${repetidas} ya estaban)` : "") +
      `. Cuadre ${cuadradas ?? 0} con movimientos del sistema.`,
  };
}

export async function cuadrarAutomatico(
  idCuenta: number,
  desde: string,
  hasta: string
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos) return { ok: false, mensaje: "Sin permiso para conciliar." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fin_conciliar_automatico", {
    p_id_cuenta: idCuenta,
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/conciliacion");
  return {
    ok: true,
    mensaje: data
      ? `Cuadre ${data} linea(s).`
      : "No habia ninguna linea con un unico movimiento que le calce.",
  };
}

export async function enlazarLinea(
  idLinea: number,
  idMov: number
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos) return { ok: false, mensaje: "Sin permiso para conciliar." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("cartola_banco")
    .update({
      id_mov: idMov,
      conciliado_en: new Date().toISOString(),
      id_conciliador: v.id,
    })
    .eq("id_linea", idLinea)
    .select("id_linea");

  if (error)
    return {
      ok: false,
      mensaje:
        error.code === "23505"
          ? "Ese movimiento ya esta enlazado con otra linea del banco."
          : error.message,
    };
  if (!data?.length)
    return { ok: false, mensaje: "No puede conciliar esta linea." };

  revalidatePath("/conciliacion");
  return { ok: true, mensaje: "Linea cuadrada con el movimiento." };
}

export async function desenlazarLinea(idLinea: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos) return { ok: false, mensaje: "Sin permiso para conciliar." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("cartola_banco")
    .update({ id_mov: null, conciliado_en: null, id_conciliador: null })
    .eq("id_linea", idLinea)
    .select("id_linea");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length)
    return { ok: false, mensaje: "No puede deshacer este cuadre." };

  revalidatePath("/conciliacion");
  return { ok: true, mensaje: "Cuadre deshecho." };
}

// Una linea cargada por error --cartola equivocada, cuenta equivocada-- se
// borra; una ya cuadrada no: primero hay que deshacer el cuadre.
export async function borrarLinea(idLinea: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos) return { ok: false, mensaje: "Sin permiso para conciliar." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("cartola_banco")
    .delete()
    .eq("id_linea", idLinea)
    .is("id_mov", null)
    .select("id_linea");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length)
    return { ok: false, mensaje: "No se borro: puede estar cuadrada, o no tiene permiso." };

  revalidatePath("/conciliacion");
  return { ok: true, mensaje: "Linea eliminada." };
}
