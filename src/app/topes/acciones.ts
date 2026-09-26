"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export type Resultado = { ok: boolean; mensaje?: string };

// El monto se teclea con la puntuacion de aca: 50.000 son cincuenta mil.
function leerMonto(v: FormDataEntryValue | null): number {
  const s = (v ?? "").toString().trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Un tope nuevo no corrige las boletas ya cargadas: cada una guarda si estaba
// dentro o fuera de politica cuando se rindio. Por eso el anterior no se
// modifica, se desactiva, y el historial queda entero.
export async function guardarTope(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores)
    return { ok: false, mensaje: "Su perfil no permite fijar topes." };

  const supabase = await createClient();
  const idCategoria = (d.get("id_categoria") ?? "").toString().trim();
  const tope = leerMonto(d.get("tope"));

  if (tope <= 0)
    return { ok: false, mensaje: "El tope tiene que ser mayor que cero." };

  const { idPaisActivo, idPaisTrabajo } = await contextoMercado(v);
  const idPais = idPaisActivo ?? idPaisTrabajo;

  // Un tope por categoria, y uno general para lo que no tenga el suyo.
  const previos = supabase
    .from("politicas_gasto")
    .update({ activa: false })
    .eq("activa", true)
    .eq("id_pais", idPais);

  const { error: errorPrevio } = idCategoria
    ? await previos.eq("id_categoria", Number(idCategoria))
    : await previos.is("id_categoria", null);

  if (errorPrevio) return { ok: false, mensaje: errorPrevio.message };

  const { error } = await supabase.from("politicas_gasto").insert({
    id_pais: idPais,
    id_categoria: idCategoria ? Number(idCategoria) : null,
    tope,
    bloquea: d.get("bloquea") === "on",
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/topes");
  revalidatePath("/rendiciones");
  return {
    ok: true,
    mensaje: "Tope guardado. Rige para las boletas que se carguen desde ahora.",
  };
}

export async function quitarTope(id: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores)
    return { ok: false, mensaje: "Su perfil no permite fijar topes." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("politicas_gasto")
    .update({ activa: false })
    .eq("id_politica", id)
    .select("id_politica");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede quitar este tope." };

  revalidatePath("/topes");
  revalidatePath("/rendiciones");
  return {
    ok: true,
    mensaje: "Tope quitado. Las boletas ya marcadas conservan su marca.",
  };
}
