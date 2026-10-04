"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { administraUsuarios, requerirVendedor } from "@/lib/sesion";
import { hoyISO } from "@/lib/formato";

export type Resultado = { ok: boolean; mensaje?: string };

// Las conversaciones con el lead: que paso, cuando, y si quedo algo
// comprometido --que, para cuando y quien--. Lo escrito no se corrige: para eso
// se escribe otra. El compromiso lo edita solo el Administrador, y la base lo
// comprueba igual.

const texto = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};

const esFecha = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function registrarConversacionLead(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar)
    return { ok: false, mensaje: "Su perfil no permite escribir conversaciones." };

  const idLead = Number(d.get("id_clientify"));
  if (!Number.isFinite(idLead)) return { ok: false, mensaje: "Falta el lead." };

  const comentario = texto(d.get("comentario"));
  if (!comentario) return { ok: false, mensaje: "Cuente que paso." };

  const fechaHecho = texto(d.get("fecha_hecho"));
  if (!esFecha(fechaHecho)) return { ok: false, mensaje: "Indique la fecha en que paso." };
  if (fechaHecho > hoyISO())
    return { ok: false, mensaje: "La fecha en que paso no puede ser futura." };

  const proximaAccion = texto(d.get("proxima_accion"));
  const proximaFecha = texto(d.get("proxima_fecha"));
  if (Boolean(proximaAccion) !== Boolean(proximaFecha))
    return {
      ok: false,
      mensaje: proximaAccion
        ? "Dele fecha al compromiso."
        : "Escriba cual es el compromiso, o quite la fecha.",
    };
  if (proximaFecha && !esFecha(proximaFecha))
    return { ok: false, mensaje: "La fecha del compromiso no es valida." };

  // El compromiso queda a nombre de alguien. Solo el Administrador se lo puede
  // dejar a otro; el resto se lo queda.
  const pedido = Number(d.get("id_responsable")) || null;
  const idResponsable = proximaAccion
    ? administraUsuarios(v)
      ? (pedido ?? v.id)
      : v.id
    : null;

  const supabase = await createClient();
  const { error } = await supabase.from("lead_actividad").insert({
    id_clientify: idLead,
    id_vendedor: v.id,
    fecha_hecho: fechaHecho,
    comentario,
    proxima_accion: proximaAccion,
    proxima_fecha: proximaFecha,
    id_responsable: idResponsable,
  });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/clientify/${idLead}`);
  return {
    ok: true,
    mensaje: proximaAccion ? "Anotado, con su compromiso." : "Conversacion anotada.",
  };
}

export async function marcarCompromisoHecho(id: number, idLead: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar) return { ok: false, mensaje: "Su perfil no permite cerrar compromisos." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("lead_actividad")
    .update({ ejecutada_en: new Date().toISOString(), id_ejecutor: v.id })
    .eq("id", id)
    .is("ejecutada_en", null)
    .select("id");
  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length)
    return { ok: false, mensaje: "Ese compromiso ya estaba hecho, o no puede cerrarlo." };

  revalidatePath(`/clientify/${idLead}`);
  return { ok: true, mensaje: "Compromiso marcado como hecho." };
}

// Volver atras cuando se marco por error: equivocarse al pulsar un boton no
// puede ser irreversible.
export async function reabrirCompromiso(id: number, idLead: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.puede_editar) return { ok: false, mensaje: "Su perfil no permite reabrir compromisos." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("lead_actividad")
    .update({ ejecutada_en: null, id_ejecutor: null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede reabrir ese compromiso." };

  revalidatePath(`/clientify/${idLead}`);
  return { ok: true, mensaje: "Compromiso reabierto." };
}

// Cambiar lo comprometido: la accion, su fecha o quien la hace. Solo el
// Administrador.
export async function editarCompromiso(
  id: number,
  idLead: number,
  accion: string,
  fecha: string,
  idResponsable: number
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!administraUsuarios(v))
    return { ok: false, mensaje: "Solo el Administrador puede editar un compromiso." };
  if (!accion.trim()) return { ok: false, mensaje: "Escriba cual es el compromiso." };
  if (!esFecha(fecha)) return { ok: false, mensaje: "Indique para cuando es." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("lead_actividad")
    .update({
      proxima_accion: accion.trim(),
      proxima_fecha: fecha,
      id_responsable: idResponsable,
    })
    .eq("id", id)
    .not("proxima_accion", "is", null)
    .select("id");
  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "Esa conversacion no tiene un compromiso." };

  revalidatePath(`/clientify/${idLead}`);
  return { ok: true, mensaje: "Compromiso actualizado." };
}
