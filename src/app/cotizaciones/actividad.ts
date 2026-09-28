"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

export type Resultado = { ok: boolean; mensaje?: string };

// La bitacora de la cotizacion: lo que se hablo con el cliente y lo que quedo
// comprometido. Un registro no se corrige despues --para eso se escribe uno
// nuevo--; lo unico que cambia es que el compromiso quedo hecho.

const texto = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};

export async function registrarActividad(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar)
    return { ok: false, mensaje: "Su perfil no permite escribir en la bitacora." };

  const idCotizacion = Number(d.get("id_cotizacion"));
  if (!Number.isFinite(idCotizacion))
    return { ok: false, mensaje: "Falta la cotizacion." };

  const comentario = texto(d.get("comentario"));
  if (!comentario) return { ok: false, mensaje: "Escriba que paso." };

  const proximaAccion = texto(d.get("proxima_accion"));
  const proximaFecha = texto(d.get("proxima_fecha"));

  // O van las dos o ninguna: una accion sin fecha no se puede vencer, y una
  // fecha sin accion no dice que hacer.
  if (Boolean(proximaAccion) !== Boolean(proximaFecha))
    return {
      ok: false,
      mensaje: proximaAccion
        ? "Dele fecha a la proxima accion."
        : "Escriba cual es la proxima accion, o quite la fecha.",
    };

  const supabase = await createClient();
  const { error } = await supabase.from("cotizacion_actividad").insert({
    id_cotizacion: idCotizacion,
    id_vendedor: v.id,
    comentario,
    proxima_accion: proximaAccion,
    proxima_fecha: proximaFecha,
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/cotizaciones/${idCotizacion}`);
  return {
    ok: true,
    mensaje: proximaAccion
      ? "Anotado, con su proxima accion."
      : "Anotado en la bitacora.",
  };
}

export async function marcarAccionHecha(
  id: number,
  idCotizacion: number
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar)
    return { ok: false, mensaje: "Su perfil no permite cerrar acciones." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("cotizacion_actividad")
    .update({ ejecutada_en: new Date().toISOString(), id_ejecutor: v.id })
    .eq("id", id)
    .is("ejecutada_en", null)
    .select("id");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length)
    return { ok: false, mensaje: "Esa accion ya estaba hecha, o no puede cerrarla." };

  revalidatePath(`/cotizaciones/${idCotizacion}`);
  return { ok: true, mensaje: "Accion marcada como hecha." };
}

// Volver atras cuando se marco por error. La bitacora no se reescribe, pero
// equivocarse al pulsar un boton no puede ser irreversible.
export async function reabrirAccion(
  id: number,
  idCotizacion: number
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar)
    return { ok: false, mensaje: "Su perfil no permite reabrir acciones." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("cotizacion_actividad")
    .update({ ejecutada_en: null, id_ejecutor: null })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede reabrir esa accion." };

  revalidatePath(`/cotizaciones/${idCotizacion}`);
  return { ok: true, mensaje: "Accion reabierta." };
}
