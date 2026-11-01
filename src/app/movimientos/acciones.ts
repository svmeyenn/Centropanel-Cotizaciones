"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { puedeVerRuta } from "@/lib/menu";
import { leerMontoLibre } from "@/lib/formato";

export type Resultado = { ok: boolean; mensaje?: string };

// Abre un giro o abono que ya existe en varias partes. La base hace el trabajo
// de una vez --o se dividen todas o ninguna-- y comprueba que sumen lo mismo.
export async function dividirMovimiento(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();

  const idMov = Number(datos.get("id_mov"));
  if (!Number.isInteger(idMov) || idMov <= 0)
    return { ok: false, mensaje: "Falta identificar el movimiento." };

  const supabase = await createClient();
  const { data: mov } = await supabase
    .from("movimientos")
    .select("tipo")
    .eq("id_mov", idMov)
    .maybeSingle();
  if (!mov) return { ok: false, mensaje: "No se encontro el movimiento." };

  const esEgreso = mov.tipo === "Egreso";
  if (esEgreso ? !puedeVerRuta(v, "/egresos") : !puedeVerRuta(v, "/ingresos") || !v.fin_editar)
    return { ok: false, mensaje: "Su perfil no permite dividir este movimiento." };

  let lista: unknown;
  try {
    lista = JSON.parse(String(datos.get("partes") ?? ""));
  } catch {
    return { ok: false, mensaje: "No se pudieron leer las partes." };
  }
  if (!Array.isArray(lista) || lista.length < 2)
    return { ok: false, mensaje: "Indique al menos dos partes." };

  const num = (x: unknown) => {
    const n = Number(x);
    return x === "" || x == null || !Number.isFinite(n) ? null : n;
  };
  const partes = [];
  for (const [i, x] of lista.entries()) {
    const o = (x ?? {}) as Record<string, unknown>;
    const monto = leerMontoLibre(String(o.monto ?? ""));
    if (!Number.isFinite(monto) || monto <= 0)
      return { ok: false, mensaje: `El monto de la parte ${i + 1} no es valido.` };
    const comentario = String(o.comentario ?? "").trim();
    const id_categoria = num(o.id_categoria);
    // Un egreso no se paga incompleto: cada parte lleva categoria y concepto.
    if (esEgreso && (!id_categoria || !comentario))
      return { ok: false, mensaje: `Falta la categoria o el concepto de la parte ${i + 1}.` };
    partes.push({
      id_mov: num(o.id_mov),
      monto,
      id_proyecto: num(o.id_proyecto),
      id_categoria,
      comentario,
    });
  }

  // Si el movimiento ya es un giro en partes, se reparte el giro completo.
  const idGrupo = String(datos.get("id_grupo") ?? "");
  const { data, error } = idGrupo
    ? await supabase.rpc("movimiento_repartir", { p_grupo: idGrupo, p_partes: partes })
    : await supabase.rpc("movimiento_dividir", { p_mov: idMov, p_partes: partes });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/egresos");
  revalidatePath("/ingresos");
  revalidatePath("/conciliacion");
  revalidatePath("/cartola");
  revalidatePath("/resumen-proyecto");
  revalidatePath("/aprobaciones");
  return { ok: true, mensaje: (data as string) ?? "Movimiento dividido." };
}
