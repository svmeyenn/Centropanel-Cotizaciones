"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { puedeVerRuta } from "@/lib/menu";
import { BUCKET_ADJUNTOS, nombreSeguro } from "@/lib/finanzas/almacen";
import type { Adjunto } from "@/lib/finanzas/tipos";

export type Resultado = { ok: boolean; mensaje?: string };

function textoONulo(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

function numeroONulo(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// El monto se teclea a mano y con la puntuacion de aca: "1.234.567" son un
// millon doscientos, no una fraccion.
function leerMonto(v: FormDataEntryValue | null): number {
  const s = (v ?? "").toString().trim().replace(/\./g, "").replace(",", ".");
  return Number(s);
}

function refrescarFinanzas() {
  revalidatePath("/egresos");
  revalidatePath("/cartola");
  revalidatePath("/resumen-proyecto");
  revalidatePath("/");
}

function camposComunes(datos: FormData, inter: { id: number; nombre: string }) {
  return {
    id_interlocutor: inter.id,
    origen_destino: inter.nombre,
    id_cuenta: numeroONulo(datos.get("id_cuenta")),
    id_proyecto: numeroONulo(datos.get("id_proyecto")),
    id_categoria: numeroONulo(datos.get("id_categoria")),
    // Plata que se le adelanta a alguien para que gaste, no un pago a
    // proveedor. Sale del resumen por proyecto: el gasto se reconoce cuando se
    // rinde, boleta por boleta.
    es_anticipo: datos.get("es_anticipo") === "on",
    documento: textoONulo(datos.get("documento")),
    comentario: textoONulo(datos.get("comentario")),
  };
}

// Un gasto no se puede pagar incompleto. Se exigen al crear la solicitud y se
// vuelven a comprobar antes de marcarla pagada, por si la fila viene de antes
// de esta regla. El proyecto queda fuera a proposito: no todo gasto pertenece
// a uno.
type Exigibles = {
  monto: number | null;
  id_cuenta: number | null;
  id_interlocutor: number | null;
  id_categoria: number | null;
  comentario: string | null;
};

function faltantesParaPagar(m: Exigibles): string[] {
  const faltan: string[] = [];
  if (!m.monto || m.monto <= 0) faltan.push("monto");
  if (!m.id_cuenta) faltan.push("cuenta");
  if (!m.id_interlocutor) faltan.push("destino");
  if (!m.id_categoria) faltan.push("categoria");
  if (!m.comentario?.trim()) faltan.push("comentario");
  return faltan;
}

async function resolverInterlocutor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: number | null
): Promise<
  { ok: true; id: number; nombre: string } | { ok: false; mensaje: string }
> {
  if (!id) return { ok: false, mensaje: "Elija el destino de la lista." };

  const { data } = await supabase
    .from("interlocutores")
    .select("id_interlocutor, nombre_referencia")
    .eq("id_interlocutor", id)
    .maybeSingle();

  if (!data) return { ok: false, mensaje: "Ese destino ya no existe." };
  return { ok: true, id: data.id_interlocutor, nombre: data.nombre_referencia };
}

function archivosValidos(datos: FormData) {
  return datos
    .getAll("adjuntos")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

// Sube los archivos de respaldo y crea sus filas. Si alguno falla a mitad de
// camino, borra lo que alcanzo a subir para no dejar archivos huerfanos.
async function subirRespaldos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  idMov: number,
  archivos: File[],
  idVendedor: number
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const rutasSubidas: string[] = [];

  for (const archivo of archivos) {
    const ruta = `egresos/${idMov}/${crypto.randomUUID()}-${nombreSeguro(archivo.name)}`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_ADJUNTOS)
      .upload(ruta, archivo, { contentType: archivo.type || undefined });

    if (errorSubida) {
      await supabase.storage.from(BUCKET_ADJUNTOS).remove(rutasSubidas);
      return {
        ok: false,
        mensaje: `No se pudo subir "${archivo.name}": ${errorSubida.message}`,
      };
    }
    rutasSubidas.push(ruta);

    const { error: errorFila } = await supabase.from("adjuntos").insert({
      id_mov: idMov,
      nombre: archivo.name,
      ruta,
      tipo_mime: archivo.type || null,
      tamano: archivo.size,
      id_vendedor: idVendedor,
    });

    if (errorFila) {
      await supabase.storage.from(BUCKET_ADJUNTOS).remove(rutasSubidas);
      return {
        ok: false,
        mensaje: `No se pudo registrar "${archivo.name}": ${errorFila.message}`,
      };
    }
  }

  return { ok: true };
}

export async function crearSolicitudEgreso(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/egresos") || !v.fin_solicitar_gastos)
    return { ok: false, mensaje: "Su perfil no permite solicitar gastos." };

  const supabase = await createClient();
  const { idPaisActivo, idPaisTrabajo } = await contextoMercado(v);

  const m = leerMonto(datos.get("monto"));
  if (!Number.isFinite(m) || m <= 0)
    return { ok: false, mensaje: "El monto no es valido." };

  const archivos = archivosValidos(datos);
  if (archivos.length === 0)
    return {
      ok: false,
      mensaje: "Adjunte al menos un archivo de respaldo (cotizacion o factura).",
    };

  const inter = await resolverInterlocutor(
    supabase,
    numeroONulo(datos.get("id_interlocutor"))
  );
  if (!inter.ok) return { ok: false, mensaje: inter.mensaje };

  const comunes = camposComunes(datos, inter);
  const faltan = faltantesParaPagar({ ...comunes, monto: m });
  if (faltan.length > 0)
    return { ok: false, mensaje: `Faltan datos obligatorios: ${faltan.join(", ")}.` };

  const { data: fila, error } = await supabase
    .from("movimientos")
    .insert({
      tipo: "Egreso",
      fecha: null,
      estado_pago: "Pendiente",
      id_pais: idPaisActivo ?? idPaisTrabajo,
      id_vendedor: v.id,
      monto: m,
      ...comunes,
    })
    .select("id_mov")
    .single();

  if (error || !fila)
    return { ok: false, mensaje: error?.message ?? "No se pudo crear la solicitud." };

  const resultado = await subirRespaldos(supabase, fila.id_mov, archivos, v.id);
  if (!resultado.ok) {
    // Sin respaldo la solicitud no vale: se deshace.
    await supabase.from("movimientos").delete().eq("id_mov", fila.id_mov);
    return resultado;
  }

  refrescarFinanzas();
  return { ok: true, mensaje: "Solicitud registrada, queda pendiente de pago." };
}

export async function editarSolicitudEgreso(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/egresos"))
    return { ok: false, mensaje: "Su perfil no permite editar gastos." };

  const supabase = await createClient();

  const idMov = numeroONulo(datos.get("id_mov"));
  if (!idMov) return { ok: false, mensaje: "Falta identificar el movimiento." };

  const m = leerMonto(datos.get("monto"));
  if (!Number.isFinite(m) || m <= 0)
    return { ok: false, mensaje: "El monto no es valido." };

  const inter = await resolverInterlocutor(
    supabase,
    numeroONulo(datos.get("id_interlocutor"))
  );
  if (!inter.ok) return { ok: false, mensaje: inter.mensaje };

  const comunes = camposComunes(datos, inter);
  const faltan = faltantesParaPagar({ ...comunes, monto: m });
  if (faltan.length > 0)
    return { ok: false, mensaje: `Faltan datos obligatorios: ${faltan.join(", ")}.` };

  // La fecha solo se acepta sobre un egreso ya pagado, para corregirla. Si
  // llegara en uno pendiente se ignora: pagar es un acto aparte, con sus
  // comprobaciones, y no puede colarse por aqui.
  const { data: actual } = await supabase
    .from("movimientos")
    .select("estado_pago")
    .eq("id_mov", idMov)
    .maybeSingle();

  const fecha = textoONulo(datos.get("fecha"));
  const correccionFecha =
    actual?.estado_pago === "Pagado" && fecha ? { fecha } : {};

  // Las reglas de la base deciden si procede: el dueno mientras siga
  // pendiente, o quien tenga permiso de pagar.
  const { error, data: filas } = await supabase
    .from("movimientos")
    .update({ monto: m, ...comunes, ...correccionFecha })
    .eq("id_mov", idMov)
    .eq("tipo", "Egreso")
    .select("id_mov");

  if (error) return { ok: false, mensaje: error.message };
  if (!filas || filas.length === 0)
    return { ok: false, mensaje: "No puede editar esta solicitud." };

  const archivos = archivosValidos(datos);
  if (archivos.length > 0) {
    const resultado = await subirRespaldos(supabase, idMov, archivos, v.id);
    if (!resultado.ok) return resultado;
  }

  refrescarFinanzas();
  return { ok: true, mensaje: "Solicitud actualizada." };
}

export async function borrarEgreso(id: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/egresos"))
    return { ok: false, mensaje: "Su perfil no permite borrar gastos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("movimientos")
    .delete()
    .eq("id_mov", id)
    .eq("tipo", "Egreso");

  if (error) return { ok: false, mensaje: error.message };

  refrescarFinanzas();
  return { ok: true, mensaje: "Solicitud eliminada." };
}

// Marca --o corrige-- el pago: siempre deja el egreso pagado con la fecha
// indicada. Sirve tanto para pagar una solicitud pendiente como para arreglar
// despues la fecha de uno ya pagado.
export async function guardarPago(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/egresos") || !v.fin_pagar_gastos)
    return { ok: false, mensaje: "Su perfil no permite pagar gastos." };

  const supabase = await createClient();

  const idMov = numeroONulo(datos.get("id_mov"));
  const fecha = textoONulo(datos.get("fecha"));
  if (!idMov || !fecha) return { ok: false, mensaje: "Falta la fecha de pago." };

  const { data: antes } = await supabase
    .from("movimientos")
    .select("estado_pago, monto, id_cuenta, id_interlocutor, id_categoria, comentario")
    .eq("id_mov", idMov)
    .maybeSingle();

  const estabaPendiente = antes?.estado_pago === "Pendiente";

  // Solo se exige al pagar de verdad. Corregir la fecha de un egreso antiguo,
  // cargado antes de esta regla, no se bloquea: eso solo dejaria el historial
  // sin poder arreglarse.
  if (estabaPendiente && antes) {
    const faltan = faltantesParaPagar(antes);
    if (faltan.length > 0)
      return {
        ok: false,
        mensaje: `No se puede pagar: faltan ${faltan.join(", ")}. Edite la solicitud y completelos.`,
      };
  }

  const { error, data: filas } = await supabase
    .from("movimientos")
    .update({ estado_pago: "Pagado", fecha, fecha_pago: fecha })
    .eq("id_mov", idMov)
    .eq("tipo", "Egreso")
    .select("id_mov");

  if (error) return { ok: false, mensaje: error.message };
  if (!filas || filas.length === 0)
    return { ok: false, mensaje: "No puede pagar este egreso." };

  refrescarFinanzas();
  return { ok: true, mensaje: "Pago registrado." };
}

export async function listarAdjuntos(
  idMov: number
): Promise<
  | { ok: true; adjuntos: (Adjunto & { url: string | null })[] }
  | { ok: false; mensaje: string }
> {
  await requerirVendedor();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("adjuntos")
    .select("*")
    .eq("id_mov", idMov)
    .order("subido_en");

  if (error) return { ok: false, mensaje: error.message };

  // El deposito es privado: cada archivo se entrega con un enlace firmado que
  // dura diez minutos.
  const conUrl = await Promise.all(
    (data as Adjunto[]).map(async (a) => {
      const { data: firmada } = await supabase.storage
        .from(BUCKET_ADJUNTOS)
        .createSignedUrl(a.ruta, 60 * 10);
      return { ...a, url: firmada?.signedUrl ?? null };
    })
  );

  return { ok: true, adjuntos: conUrl };
}

export async function quitarAdjunto(
  idAdjunto: number,
  ruta: string
): Promise<Resultado> {
  await requerirVendedor();
  const supabase = await createClient();

  const { error, data: filas } = await supabase
    .from("adjuntos")
    .delete()
    .eq("id_adjunto", idAdjunto)
    .select("id_adjunto");

  if (error) return { ok: false, mensaje: error.message };
  if (!filas || filas.length === 0)
    return { ok: false, mensaje: "No puede quitar este respaldo." };

  await supabase.storage.from(BUCKET_ADJUNTOS).remove([ruta]);

  revalidatePath("/egresos");
  return { ok: true, mensaje: "Respaldo eliminado." };
}
