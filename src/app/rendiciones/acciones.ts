"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { BUCKET_BOLETAS, nombreSeguro } from "@/lib/finanzas/almacen";
import { PROYECTO_GENERICO, type RespaldoBoleta } from "@/lib/finanzas/tipos";
import type { Vendedor } from "@/types/database";

export type Resultado = { ok: boolean; mensaje?: string };
export type ResultadoRendicion = Resultado & { id_rendicion?: number };

const texto = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};

const numero = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// El monto se teclea a mano y con la puntuacion de aca.
function leerMonto(v: FormDataEntryValue | null): number {
  const s = (v ?? "").toString().trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const pesos = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

function refrescar(idRendicion?: number) {
  revalidatePath("/rendiciones");
  if (idRendicion) revalidatePath(`/rendiciones/${idRendicion}`);
  revalidatePath("/egresos");
  revalidatePath("/cartola");
  revalidatePath("/resumen-proyecto");
}

// Rendir y pagar son dos permisos distintos, y los dos abren esta pantalla:
// quien rinde ve las suyas, quien paga las ve todas. Quien recorta de verdad
// es la base.
async function exigirRendiciones(): Promise<
  { ok: true; v: Vendedor } | { ok: false; mensaje: string }
> {
  const v = await requerirVendedor();
  if (!v.fin_rendir_gastos && !v.fin_pagar_gastos)
    return { ok: false, mensaje: "Su perfil no permite rendir gastos." };
  return { ok: true, v };
}

// ---------------------------------------------------------------------------
// La rendicion
// ---------------------------------------------------------------------------

export async function crearRendicion(
  _p: ResultadoRendicion | null,
  d: FormData
): Promise<ResultadoRendicion> {
  const permiso = await exigirRendiciones();
  if (!permiso.ok) return permiso;
  const v = permiso.v;

  const desde = texto(d.get("periodo_desde"));
  const hasta = texto(d.get("periodo_hasta"));
  if (!desde || !hasta)
    return { ok: false, mensaje: "Falta el periodo que cubre la rendicion." };
  if (hasta < desde)
    return { ok: false, mensaje: "El periodo termina antes de empezar." };

  // Quien solo rinde, rinde para si mismo: no elige destinatario. Elegir a
  // otro es transcribir boletas ajenas, y eso lo hace quien paga.
  const pedido = numero(d.get("id_interlocutor"));
  const idInterlocutor = v.fin_pagar_gastos ? pedido : v.id_interlocutor;

  if (!idInterlocutor)
    return {
      ok: false,
      mensaje: v.fin_pagar_gastos
        ? "Elija para quien es la rendicion."
        : "Su usuario no esta enlazado con una ficha de origen/destino. Pidale al administrador que lo enlace.",
    };

  const { idPaisActivo, idPaisTrabajo } = await contextoMercado(v);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rendiciones")
    .insert({
      id_pais: idPaisActivo ?? idPaisTrabajo,
      id_interlocutor: idInterlocutor,
      periodo_desde: desde,
      periodo_hasta: hasta,
      estado: "Borrador",
      id_vendedor: v.id,
    })
    .select("id_rendicion")
    .single();

  if (error) return { ok: false, mensaje: error.message };

  refrescar();
  return {
    ok: true,
    mensaje: "Rendicion creada. Agreguele sus boletas.",
    id_rendicion: data.id_rendicion,
  };
}

export async function enviarRendicion(idRendicion: number): Promise<Resultado> {
  const permiso = await exigirRendiciones();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const { count } = await supabase
    .from("rendicion_gastos")
    .select("id_gasto", { count: "exact", head: true })
    .eq("id_rendicion", idRendicion);

  if (!count)
    return { ok: false, mensaje: "Agregue al menos una boleta antes de enviarla." };

  // La base decide si procede: solo el dueño, y solo mientras siga en Borrador.
  const { error, data } = await supabase
    .from("rendiciones")
    .update({ estado: "Enviada" })
    .eq("id_rendicion", idRendicion)
    .eq("estado", "Borrador")
    .select("id_rendicion");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length)
    return {
      ok: false,
      mensaje: "No se pudo enviar: revise que siga en Borrador y sea suya.",
    };

  refrescar(idRendicion);
  return { ok: true, mensaje: "Rendicion enviada a revision. Ya no se puede editar." };
}

export async function devolverABorrador(idRendicion: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return {
      ok: false,
      mensaje: "Solo quien paga puede devolver una rendicion a Borrador.",
    };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("rendiciones")
    .update({ estado: "Borrador", motivo_rechazo: null })
    .eq("id_rendicion", idRendicion)
    .in("estado", ["Enviada", "Rechazada", "Incompleta"])
    .select("id_rendicion");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length)
    return { ok: false, mensaje: "Esta rendicion no se puede devolver." };

  refrescar(idRendicion);
  return { ok: true, mensaje: "Devuelta a Borrador para que la corrijan." };
}

// Solo se elimina una rendicion vacia: sin boletas, sin anticipos aplicados y
// sin reintegro. La base lo exige igual; sin eso, el borrado en cascada se
// llevaria las boletas en silencio.
export async function borrarRendicion(idRendicion: number): Promise<Resultado> {
  const permiso = await exigirRendiciones();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const [{ count: boletas }, { count: anticipos }, { data: rend }] =
    await Promise.all([
      supabase
        .from("rendicion_gastos")
        .select("id_gasto", { count: "exact", head: true })
        .eq("id_rendicion", idRendicion),
      supabase
        .from("rendicion_anticipos")
        .select("id_mov", { count: "exact", head: true })
        .eq("id_rendicion", idRendicion),
      supabase
        .from("rendiciones")
        .select("id_mov_reintegro")
        .eq("id_rendicion", idRendicion)
        .maybeSingle(),
    ]);

  if (boletas)
    return { ok: false, mensaje: "No se puede eliminar: tiene boletas. Borrelas primero." };
  if (anticipos)
    return {
      ok: false,
      mensaje: "No se puede eliminar: tiene anticipos aplicados. Quitelos primero.",
    };
  if (rend?.id_mov_reintegro)
    return {
      ok: false,
      mensaje: "No se puede eliminar: ya genero un reintegro en Egresos.",
    };

  const { error, data } = await supabase
    .from("rendiciones")
    .delete()
    .eq("id_rendicion", idRendicion)
    .select("id_rendicion");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length)
    return { ok: false, mensaje: "No puede eliminar esta rendicion." };

  refrescar();
  return { ok: true, mensaje: "Rendicion eliminada." };
}

// Aprobar y rechazar pasan por funciones de la base: el monto del reintegro se
// calcula alli, de las boletas y los anticipos, y nunca llega del navegador.
//
// Aprobar deja el reintegro como un egreso pendiente en la bandeja de Egresos;
// el pago ocurre alla, por el flujo de siempre, y la rendicion pasa a Pagada
// sola cuando ese egreso se marca pagado.
export async function aprobarRendicion(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return { ok: false, mensaje: "Solo quien paga puede aprobar rendiciones." };

  const idRendicion = numero(d.get("id_rendicion"));
  if (!idRendicion) return { ok: false, mensaje: "Falta identificar la rendicion." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fin_aprobar_rendicion", {
    p_id: idRendicion,
    p_id_cuenta: numero(d.get("id_cuenta")),
  });

  if (error) return { ok: false, mensaje: error.message };

  refrescar(idRendicion);

  if (data === "Incompleta")
    return {
      ok: true,
      mensaje:
        "Aprobada, pero queda Incompleta: rindio menos de lo que se le adelanto, y esa diferencia sigue pendiente.",
    };
  if (data === "Cerrada")
    return {
      ok: true,
      mensaje: "Rendicion cerrada. Calzo justo con el anticipo: no hubo nada que transferir.",
    };
  return { ok: true, mensaje: "Aprobada. El reintegro quedo en Egresos, pendiente de pago." };
}

export async function rechazarRendicion(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return { ok: false, mensaje: "Solo quien paga puede rechazar rendiciones." };

  const idRendicion = numero(d.get("id_rendicion"));
  const motivo = texto(d.get("motivo"));
  if (!idRendicion) return { ok: false, mensaje: "Falta identificar la rendicion." };
  if (!motivo) return { ok: false, mensaje: "Explique por que se rechaza." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fin_rechazar_rendicion", {
    p_id: idRendicion,
    p_motivo: motivo,
  });
  if (error) return { ok: false, mensaje: error.message };

  refrescar(idRendicion);
  return { ok: true, mensaje: "Rendicion rechazada." };
}

// ---------------------------------------------------------------------------
// Las boletas
// ---------------------------------------------------------------------------

type Cliente = Awaited<ReturnType<typeof createClient>>;

async function subirFotos(
  supabase: Cliente,
  idGasto: number,
  archivos: File[],
  idVendedor: number
): Promise<Resultado> {
  const subidas: string[] = [];

  for (const archivo of archivos) {
    const ruta = `${idGasto}/${crypto.randomUUID()}-${nombreSeguro(archivo.name)}`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_BOLETAS)
      .upload(ruta, archivo, { contentType: archivo.type || undefined });

    if (errorSubida) {
      await supabase.storage.from(BUCKET_BOLETAS).remove(subidas);
      return {
        ok: false,
        mensaje: `No se pudo subir "${archivo.name}": ${errorSubida.message}`,
      };
    }
    subidas.push(ruta);

    const { error: errorFila } = await supabase.from("rendicion_adjuntos").insert({
      id_gasto: idGasto,
      nombre: archivo.name,
      ruta,
      tipo_mime: archivo.type || null,
      tamano: archivo.size,
      id_vendedor: idVendedor,
    });

    if (errorFila) {
      await supabase.storage.from(BUCKET_BOLETAS).remove(subidas);
      return {
        ok: false,
        mensaje: `No se pudo registrar "${archivo.name}": ${errorFila.message}`,
      };
    }
  }

  return { ok: true };
}

// El indice que impide rendir dos veces la misma boleta devuelve el error
// crudo de Postgres: aqui se traduce a algo que se entienda en terreno.
const mensajeDeBoleta = (error: { code?: string; message: string }) =>
  error.code === "23505"
    ? "Esa boleta ya esta rendida: mismo comercio, mismo numero, misma fecha y mismo monto."
    : error.message;

// Pasarse del tope no impide cargar la boleta --salvo que el tope sea de los
// que bloquean, y ahi ni siquiera se guarda--: se avisa para que nadie se
// entere recien cuando le rechazan la rendicion.
const avisoPolitica = (motivo: string | null) =>
  motivo ? ` Queda marcada fuera de politica: ${motivo.toLowerCase()}.` : "";

const archivosValidos = (d: FormData) =>
  d.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);

export async function guardarBoleta(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const permiso = await exigirRendiciones();
  if (!permiso.ok) return permiso;
  const v = permiso.v;

  const idRendicion = numero(d.get("id_rendicion"));
  const idGasto = numero(d.get("id_gasto"));
  if (!idRendicion) return { ok: false, mensaje: "Falta identificar la rendicion." };

  const monto = leerMonto(d.get("monto"));
  if (monto <= 0) return { ok: false, mensaje: "El monto no es valido." };

  const fecha = texto(d.get("fecha"));
  const comercio = texto(d.get("comercio"));
  const idCategoria = numero(d.get("id_categoria"));
  const idProyecto = numero(d.get("id_proyecto"));
  const comentario = texto(d.get("comentario"));
  const documento = texto(d.get("documento"));

  const faltan: string[] = [];
  if (!fecha) faltan.push("fecha");
  if (!comercio) faltan.push("comercio");
  if (!idCategoria) faltan.push("categoria");
  if (!idProyecto) faltan.push("proyecto");
  // El numero del documento es la unica forma de detectar la misma boleta
  // rendida dos veces. Cuando el comprobante no trae folio se escribe S/N, y
  // esa boleta queda fuera del control de repetidas.
  if (!documento) faltan.push("N de boleta (o S/N si no tiene)");
  if (faltan.length)
    return { ok: false, mensaje: `Faltan datos: ${faltan.join(", ")}.` };

  const supabase = await createClient();

  // Con el proyecto generico el comentario es obligatorio: si no se dice de
  // que se trata, "Otros" deja de ser una bandeja de entrada y pasa a ser un
  // basurero. Se comprueba aqui y no en la base porque depende del nombre del
  // proyecto, que vive en otra tabla.
  const { data: proyecto } = await supabase
    .from("proyectos")
    .select("nombre")
    .eq("id_proyecto", idProyecto)
    .maybeSingle();

  if (proyecto?.nombre === PROYECTO_GENERICO && !comentario)
    return {
      ok: false,
      mensaje: `Con el proyecto "${PROYECTO_GENERICO}" hay que explicar en el comentario de que se trata el gasto.`,
    };

  const fila = {
    id_rendicion: idRendicion,
    fecha,
    monto,
    comercio,
    id_categoria: idCategoria,
    id_proyecto: idProyecto,
    comentario,
    documento,
  };

  const archivos = archivosValidos(d);

  if (idGasto) {
    const { error, data } = await supabase
      .from("rendicion_gastos")
      .update(fila)
      .eq("id_gasto", idGasto)
      .select("id_gasto, politica_motivo");

    if (error) return { ok: false, mensaje: mensajeDeBoleta(error) };
    if (!data?.length)
      return { ok: false, mensaje: "No puede editar esta boleta." };

    if (archivos.length) {
      const r = await subirFotos(supabase, idGasto, archivos, v.id);
      if (!r.ok) return r;
    }

    refrescar(idRendicion);
    return {
      ok: true,
      mensaje: "Boleta actualizada." + avisoPolitica(data[0].politica_motivo),
    };
  }

  // Una boleta sin su comprobante no respalda nada.
  if (archivos.length === 0)
    return { ok: false, mensaje: "Adjunte la foto o el archivo de la boleta." };

  // La firma de quien carga la pone el servidor: la base comprueba ademas que
  // coincida con quien esta conectado, y un disparador impide reescribirla
  // despues. Sin eso no serviria de constancia.
  const { data, error } = await supabase
    .from("rendicion_gastos")
    .insert({ ...fila, id_vendedor: v.id })
    .select("id_gasto, politica_motivo")
    .single();

  if (error) return { ok: false, mensaje: mensajeDeBoleta(error) };

  const r = await subirFotos(supabase, data.id_gasto, archivos, v.id);
  if (!r.ok) {
    // Sin comprobante la boleta no vale: se deshace.
    await supabase.from("rendicion_gastos").delete().eq("id_gasto", data.id_gasto);
    return r;
  }

  refrescar(idRendicion);
  return {
    ok: true,
    mensaje: "Boleta agregada." + avisoPolitica(data.politica_motivo),
  };
}

export async function borrarBoleta(idGasto: number): Promise<Resultado> {
  const permiso = await exigirRendiciones();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const { data: rutas } = await supabase
    .from("rendicion_adjuntos")
    .select("ruta")
    .eq("id_gasto", idGasto);

  const { error, data } = await supabase
    .from("rendicion_gastos")
    .delete()
    .eq("id_gasto", idGasto)
    .select("id_rendicion");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede borrar esta boleta." };

  if (rutas?.length)
    await supabase.storage
      .from(BUCKET_BOLETAS)
      .remove(rutas.map((r: { ruta: string }) => r.ruta));

  refrescar(data[0].id_rendicion);
  return { ok: true, mensaje: "Boleta eliminada." };
}

// Aceptar o rechazar una boleta suelta. Rechazar la rendicion entera por una
// boleta mala obligaria a rehacerla completa.
export async function resolverBoleta(
  idGasto: number,
  estado: "Aceptado" | "Rechazado",
  motivo: string | null
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return { ok: false, mensaje: "Solo quien paga puede aceptar o rechazar boletas." };

  if (estado === "Rechazado" && !motivo?.trim())
    return { ok: false, mensaje: "Explique por que se rechaza la boleta." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("rendicion_gastos")
    .update({ estado, motivo_rechazo: estado === "Rechazado" ? motivo : null })
    .eq("id_gasto", idGasto)
    .select("id_rendicion");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No se pudo actualizar la boleta." };

  refrescar(data[0].id_rendicion);
  return {
    ok: true,
    mensaje: estado === "Aceptado" ? "Boleta aceptada." : "Boleta rechazada.",
  };
}

// ---------------------------------------------------------------------------
// Los anticipos
// ---------------------------------------------------------------------------

export async function asociarAnticipo(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return { ok: false, mensaje: "Solo quien paga puede asociar anticipos." };

  const idRendicion = numero(d.get("id_rendicion"));
  const idMov = numero(d.get("id_mov"));
  const aplicado = leerMonto(d.get("monto_aplicado"));

  if (!idRendicion || !idMov) return { ok: false, mensaje: "Falta elegir el anticipo." };
  if (aplicado <= 0) return { ok: false, mensaje: "El monto a aplicar no es valido." };

  const supabase = await createClient();

  // Un anticipo grande puede rendirse en dos veces, pero la suma de lo
  // aplicado no puede pasarse de lo que se entrego. Se comprueba aqui porque
  // depende de sumar otra tabla, y eso una restriccion no lo puede hacer.
  const [{ data: mov }, { data: previos }] = await Promise.all([
    supabase.from("movimientos").select("monto").eq("id_mov", idMov).maybeSingle(),
    supabase.from("rendicion_anticipos").select("monto_aplicado").eq("id_mov", idMov),
  ]);

  if (!mov) return { ok: false, mensaje: "Ese anticipo no existe." };

  const yaAplicado = (previos ?? []).reduce(
    (t: number, p: { monto_aplicado: number }) => t + Number(p.monto_aplicado),
    0
  );
  const disponible = Number(mov.monto) - yaAplicado;

  if (aplicado > disponible)
    return {
      ok: false,
      mensaje: `De ese anticipo quedan ${pesos(disponible)} por aplicar.`,
    };

  const { error } = await supabase
    .from("rendicion_anticipos")
    .insert({ id_rendicion: idRendicion, id_mov: idMov, monto_aplicado: aplicado });

  if (error)
    return {
      ok: false,
      mensaje:
        error.code === "23505"
          ? "Ese anticipo ya esta asociado a esta rendicion."
          : error.message,
    };

  refrescar(idRendicion);
  return { ok: true, mensaje: "Anticipo asociado." };
}

export async function quitarAnticipo(
  idRendicion: number,
  idMov: number
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return { ok: false, mensaje: "Solo quien paga puede quitar anticipos." };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("rendicion_anticipos")
    .delete()
    .eq("id_rendicion", idRendicion)
    .eq("id_mov", idMov)
    .select("id_mov");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede quitar este anticipo." };

  refrescar(idRendicion);
  return { ok: true, mensaje: "Anticipo desasociado." };
}

// ---------------------------------------------------------------------------
// Los respaldos de una boleta
// ---------------------------------------------------------------------------

export async function listarRespaldosBoleta(
  idGasto: number
): Promise<
  | { ok: true; respaldos: (RespaldoBoleta & { url: string | null })[] }
  | { ok: false; mensaje: string }
> {
  const permiso = await exigirRendiciones();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rendicion_adjuntos")
    .select("*")
    .eq("id_gasto", idGasto)
    .order("subido_en");

  if (error) return { ok: false, mensaje: error.message };

  const conUrl = await Promise.all(
    (data as RespaldoBoleta[]).map(async (a) => {
      const { data: firmada } = await supabase.storage
        .from(BUCKET_BOLETAS)
        .createSignedUrl(a.ruta, 60 * 10);
      return { ...a, url: firmada?.signedUrl ?? null };
    })
  );

  return { ok: true, respaldos: conUrl };
}

export async function quitarRespaldoBoleta(
  idRendAdjunto: number,
  ruta: string
): Promise<Resultado> {
  const permiso = await exigirRendiciones();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();

  // Quitar el ultimo respaldo dejaria la boleta sin comprobante, que es
  // justamente lo que no se permite al crearla.
  const { data: suyo } = await supabase
    .from("rendicion_adjuntos")
    .select("id_gasto")
    .eq("id_rend_adjunto", idRendAdjunto)
    .maybeSingle();

  if (suyo) {
    const { count } = await supabase
      .from("rendicion_adjuntos")
      .select("id_rend_adjunto", { count: "exact", head: true })
      .eq("id_gasto", suyo.id_gasto);

    if ((count ?? 0) <= 1)
      return {
        ok: false,
        mensaje: "Es el unico respaldo de la boleta. Suba el nuevo antes de quitar este.",
      };
  }

  const { error, data } = await supabase
    .from("rendicion_adjuntos")
    .delete()
    .eq("id_rend_adjunto", idRendAdjunto)
    .select("id_gasto");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede quitar este respaldo." };

  await supabase.storage.from(BUCKET_BOLETAS).remove([ruta]);

  revalidatePath("/rendiciones");
  return { ok: true, mensaje: "Respaldo eliminado." };
}
