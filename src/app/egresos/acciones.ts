"use server";

import { leerMontoLibre } from "@/lib/formato";

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
  return leerMontoLibre((v ?? "").toString());
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
    servicio_prestado: datos.get("servicio_prestado") === "on",
    fecha_pago_acordada: textoONulo(datos.get("fecha_pago_acordada")),
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


type ParteLeida = {
  monto: number;
  id_proyecto: number | null;
  id_categoria: number | null;
  comentario: string | null;
};

// Un giro abierto en varias partes viaja como JSON en el campo `partes`. Null
// si el formulario no es de un giro dividido.
function leerPartes(datos: FormData): ParteLeida[] | { error: string } | null {
  const crudo = textoONulo(datos.get("partes"));
  if (!crudo) return null;
  let lista: unknown;
  try {
    lista = JSON.parse(crudo);
  } catch {
    return { error: "No se pudieron leer las partes del giro." };
  }
  if (!Array.isArray(lista) || lista.length < 2)
    return { error: "Un giro dividido necesita al menos dos partes." };
  if (lista.length > 30) return { error: "Maximo 30 partes por giro." };
  const partes: ParteLeida[] = [];
  for (const [i, x] of lista.entries()) {
    const o = (x ?? {}) as Record<string, unknown>;
    const monto = leerMontoLibre(String(o.monto ?? ""));
    if (!Number.isFinite(monto) || monto <= 0)
      return { error: `El monto de la parte ${i + 1} no es valido.` };
    const num = (v: unknown) => {
      const n = Number(v);
      return v === "" || v == null || !Number.isFinite(n) ? null : n;
    };
    const comentario = String(o.comentario ?? "").trim();
    partes.push({
      monto,
      id_proyecto: num(o.id_proyecto),
      id_categoria: num(o.id_categoria),
      comentario: comentario === "" ? null : comentario,
    });
  }
  return partes;
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

// Cuatro megas es lo que admite una peticion. Pasarse hace fallar el envio
// antes de llegar aqui, asi que esto es la red por si algun dia el limite del
// servidor cambia: mas vale un aviso que un error de servidor sin explicacion.
const TOPE_ADJUNTOS = 4 * 1024 * 1024;

function pesanDemasiado(archivos: File[]): string | null {
  const total = archivos.reduce((t, f) => t + f.size, 0);
  if (total <= TOPE_ADJUNTOS) return null;
  return `Los archivos suman ${(total / 1024 / 1024).toFixed(1)} MB y el maximo es 4 MB. Suba menos archivos, o comprima el PDF antes.`;
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

  const leidas = leerPartes(datos);
  if (leidas && "error" in leidas) return { ok: false, mensaje: leidas.error };
  const partes = leidas as ParteLeida[] | null;

  const m = partes ? partes.reduce((t, p) => t + p.monto, 0) : leerMonto(datos.get("monto"));
  if (!Number.isFinite(m) || m <= 0)
    return { ok: false, mensaje: "El monto no es valido." };

  const archivos = archivosValidos(datos);
  if (archivos.length === 0)
    return {
      ok: false,
      mensaje: "Adjunte al menos un archivo de respaldo (cotizacion o factura).",
    };

  const pesado = pesanDemasiado(archivos);
  if (pesado) return { ok: false, mensaje: pesado };

  const inter = await resolverInterlocutor(
    supabase,
    numeroONulo(datos.get("id_interlocutor"))
  );
  if (!inter.ok) return { ok: false, mensaje: inter.mensaje };

  const comunes = camposComunes(datos, inter);
  const filasNuevas = partes
    ? partes.map((p) => ({ ...comunes, ...p }))
    : [{ ...comunes, monto: m }];
  for (const [i, f] of filasNuevas.entries()) {
    const faltan = faltantesParaPagar(f);
    if (faltan.length > 0)
      return {
        ok: false,
        mensaje: `Faltan datos obligatorios${partes ? ` en la parte ${i + 1}` : ""}: ${faltan.join(", ")}.`,
      };
  }

  // Todas las partes de un giro comparten el grupo: asi se pagan y se cuadran
  // con el banco como un solo movimiento.
  const idGrupo = partes ? crypto.randomUUID() : null;

  const { data: filasCreadas, error } = await supabase
    .from("movimientos")
    .insert(
      filasNuevas.map((f) => ({
        tipo: "Egreso",
        fecha: null,
        estado_pago: "Pendiente",
        id_pais: idPaisActivo ?? idPaisTrabajo,
        id_vendedor: v.id,
        id_grupo: idGrupo,
        ...f,
      }))
    )
    .select("id_mov")
    .order("id_mov");

  const fila = filasCreadas?.[0];
  if (error || !fila)
    return { ok: false, mensaje: error?.message ?? "No se pudo crear la solicitud." };

  const resultado = await subirRespaldos(supabase, fila.id_mov, archivos, v.id);
  if (!resultado.ok) {
    // Sin respaldo la solicitud no vale: se deshace.
    await supabase.from("movimientos").delete().in("id_mov", (filasCreadas ?? []).map((f) => f.id_mov));
    return resultado;
  }

  // La factura de otro gasto del pedido ya registrado: el egreso lo reemplaza en el margen.
  const idGastoPedido = numeroONulo(datos.get("id_gasto_pedido"));
  if (idGastoPedido) {
    const { error: errorGasto } = await supabase.rpc("gasto_pedido_vincular", { p_id: idGastoPedido, p_mov: fila.id_mov });
    if (errorGasto) {
      refrescarFinanzas();
      return { ok: true, mensaje: `Solicitud registrada, pero no se pudo enlazar al gasto del pedido: ${errorGasto.message}` };
    }
    revalidatePath("/pedidos");
  }

  // La factura de un costo de transporte ya registrado: el egreso pasa a ser su respaldo y reemplaza al costo provisorio.
  const idTransporte = numeroONulo(datos.get("id_transporte"));
  if (idTransporte) {
    const { error: errorEnlace } = await supabase.rpc("transporte_vincular", { p_id: idTransporte, p_mov: fila.id_mov });
    if (errorEnlace) {
      refrescarFinanzas();
      return { ok: true, mensaje: `Solicitud registrada, pero no se pudo enlazar al costo de transporte: ${errorEnlace.message}` };
    }
    revalidatePath("/pedidos");
  }

  refrescarFinanzas();
  return {
    ok: true,
    mensaje: partes
      ? `Giro registrado en ${partes.length} partes, queda pendiente de pago.`
      : "Solicitud registrada, queda pendiente de pago.",
  };
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
    const pesado = pesanDemasiado(archivos);
    if (pesado) return { ok: false, mensaje: pesado };

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
    .select("estado_pago, monto, id_cuenta, id_interlocutor, id_categoria, comentario, id_grupo")
    .eq("id_mov", idMov)
    .maybeSingle();

  const estabaPendiente = antes?.estado_pago === "Pendiente";

  // Un giro en partes se paga entero: lo que el banco ve es un solo cargo.
  const idGrupo = (antes?.id_grupo as string | null) ?? null;

  // Solo se exige al pagar de verdad. Corregir la fecha de un egreso antiguo,
  // cargado antes de esta regla, no se bloquea: eso solo dejaria el historial
  // sin poder arreglarse.
  if (estabaPendiente && antes) {
    const aRevisar = idGrupo
      ? ((
          await supabase
            .from("movimientos")
            .select("monto, id_cuenta, id_interlocutor, id_categoria, comentario")
            .eq("id_grupo", idGrupo)
        ).data ?? [])
      : [antes];
    for (const parte of aRevisar) {
      const faltan = faltantesParaPagar(parte);
      if (faltan.length > 0)
        return {
          ok: false,
          mensaje: `No se puede pagar: faltan ${faltan.join(", ")}. Edite la solicitud y completelos.`,
        };
    }
  }

  const base = supabase
    .from("movimientos")
    .update({ estado_pago: "Pagado", fecha, fecha_pago: fecha })
    .eq("tipo", "Egreso");
  const { error, data: filas } = await (idGrupo
    ? base.eq("id_grupo", idGrupo)
    : base.eq("id_mov", idMov)
  ).select("id_mov");

  if (error) return { ok: false, mensaje: error.message };
  if (!filas || filas.length === 0)
    return { ok: false, mensaje: "No puede pagar este egreso." };

  refrescarFinanzas();
  return {
    ok: true,
    mensaje: filas.length > 1 ? `Pago registrado en las ${filas.length} partes del giro.` : "Pago registrado.",
  };
}

// Reversar un egreso pagado: vuelve a Pendiente y sale de la cartola. Solo el
// Administrador, y con motivo. La base vuelve a comprobar el rol y rechaza lo que
// no corresponde (conciliado con el banco, anticipo con rendiciones).
export async function reversarEgreso(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador" || !puedeVerRuta(v, "/egresos"))
    return { ok: false, mensaje: "Solo un Administrador puede reversar un egreso." };

  const idMov = numeroONulo(datos.get("id_mov"));
  const motivo = (textoONulo(datos.get("motivo")) ?? "").trim();
  if (!idMov) return { ok: false, mensaje: "Falta identificar el egreso." };
  if (motivo.length < 5)
    return { ok: false, mensaje: "Escriba el motivo de la reversa (al menos 5 caracteres)." };

  const supabase = await createClient();

  // Un giro en partes se reversa entero. Primero la que lleva el cuadre con el
  // banco (la de menor numero): si esa se rechaza, no se toca ninguna.
  const { data: ref } = await supabase
    .from("movimientos")
    .select("id_grupo")
    .eq("id_mov", idMov)
    .maybeSingle();
  const idGrupo = (ref?.id_grupo as string | null) ?? null;
  const ids = idGrupo
    ? (
        (
          await supabase
            .from("movimientos")
            .select("id_mov")
            .eq("id_grupo", idGrupo)
            .order("id_mov")
        ).data ?? []
      ).map((f: { id_mov: number }) => f.id_mov)
    : [idMov];

  let data: unknown = null;
  for (const id of ids) {
    const r = await supabase.rpc("egreso_reversar", { p_id_mov: id, p_motivo: motivo });
    if (r.error) return { ok: false, mensaje: r.error.message };
    data = r.data;
  }

  refrescarFinanzas();
  revalidatePath("/compras");
  return {
    ok: true,
    mensaje: ids.length > 1 ? `Pago reversado en las ${ids.length} partes del giro.` : ((data as string) ?? "Pago reversado."),
  };
}

// Deshacer la aprobacion de un egreso que aun no se paga: vuelve a "Por aprobar".
// Mismo permiso que reversar un pago (Administrador); la base ademas exige que siga
// sin pagar y deja anotado quien la deshizo y por que.
export async function reversarAprobacionEgreso(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador" || !puedeVerRuta(v, "/egresos"))
    return { ok: false, mensaje: "Solo un Administrador puede reversar una aprobacion." };

  const idMov = numeroONulo(datos.get("id_mov"));
  const motivo = (textoONulo(datos.get("motivo")) ?? "").trim();
  if (!idMov) return { ok: false, mensaje: "Falta identificar el egreso." };
  if (motivo.length < 5)
    return { ok: false, mensaje: "Escriba el motivo (al menos 5 caracteres)." };

  const supabase = await createClient();

  // En un giro en partes se reversa la aprobacion de todas.
  const { data: ref } = await supabase
    .from("movimientos")
    .select("id_grupo")
    .eq("id_mov", idMov)
    .maybeSingle();
  const idGrupo = (ref?.id_grupo as string | null) ?? null;
  const ids = idGrupo
    ? (
        (
          await supabase
            .from("movimientos")
            .select("id_mov")
            .eq("id_grupo", idGrupo)
            .eq("aprobacion", "Aprobado")
            .order("id_mov")
        ).data ?? []
      ).map((f: { id_mov: number }) => f.id_mov)
    : [idMov];

  let data: unknown = null;
  for (const id of ids) {
    const r = await supabase.rpc("egreso_reversar_aprobacion", { p_mov: id, p_motivo: motivo });
    if (r.error) return { ok: false, mensaje: r.error.message };
    data = r.data;
  }

  refrescarFinanzas();
  revalidatePath("/aprobaciones");
  return {
    ok: true,
    mensaje: ids.length > 1 ? `Aprobacion reversada en las ${ids.length} partes del giro.` : ((data as string) ?? "Aprobacion reversada."),
  };
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
