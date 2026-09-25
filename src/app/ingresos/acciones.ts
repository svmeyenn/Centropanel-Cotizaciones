"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { puedeVerRuta } from "@/lib/menu";

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

// Las pantallas que muestran plata se rehacen juntas: un ingreso confirmado
// cambia la cartola, el resumen por proyecto y el tablero de la portada.
function refrescarFinanzas() {
  revalidatePath("/ingresos");
  revalidatePath("/cartola");
  revalidatePath("/resumen-proyecto");
  revalidatePath("/");
}

// El origen de un movimiento tiene que ser un interlocutor de la base. El
// nombre nunca llega desde el navegador: se resuelve aqui, y de ahi sale la
// copia que se guarda en `origen_destino`.
async function resolverInterlocutor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: number | null
): Promise<
  { ok: true; id: number; nombre: string } | { ok: false; mensaje: string }
> {
  if (!id)
    return { ok: false, mensaje: "Elija el origen de la lista." };

  const { data } = await supabase
    .from("interlocutores")
    .select("id_interlocutor, nombre_referencia")
    .eq("id_interlocutor", id)
    .maybeSingle();

  if (!data) return { ok: false, mensaje: "Ese origen ya no existe." };
  return { ok: true, id: data.id_interlocutor, nombre: data.nombre_referencia };
}

// Solo ingresos: los egresos pasan por su propia pantalla, con la solicitud,
// el pago y el respaldo obligatorio.
export async function guardarIngreso(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/ingresos") || !v.fin_editar)
    return { ok: false, mensaje: "Su perfil no permite editar ingresos." };

  const supabase = await createClient();
  const { idPaisActivo, idPaisTrabajo } = await contextoMercado(v);

  const m = leerMonto(datos.get("monto"));
  if (!Number.isFinite(m) || m <= 0)
    return { ok: false, mensaje: "El monto no es valido." };

  const inter = await resolverInterlocutor(
    supabase,
    numeroONulo(datos.get("id_interlocutor"))
  );
  if (!inter.ok) return { ok: false, mensaje: inter.mensaje };

  const fecha = textoONulo(datos.get("fecha"));
  // Sin fecha el ingreso queda proyectado: no se puede dar por recibido algo
  // que no tiene dia.
  const estado =
    fecha && datos.get("estado_pago") === "Pagado" ? "Pagado" : "Pendiente";
  const fechaPagoEnviada = textoONulo(datos.get("fecha_pago"));

  const fila = {
    tipo: "Ingreso" as const,
    fecha,
    id_interlocutor: inter.id,
    origen_destino: inter.nombre,
    monto: m,
    comentario: textoONulo(datos.get("comentario")),
    id_cuenta: numeroONulo(datos.get("id_cuenta")),
    id_proyecto: numeroONulo(datos.get("id_proyecto")),
    id_categoria: numeroONulo(datos.get("id_categoria")),
    documento: textoONulo(datos.get("documento")),
    estado_pago: estado,
    // Igual que en Access: al marcarlo recibido se registra la fecha si no la
    // pusieron.
    fecha_pago: estado === "Pagado" ? (fechaPagoEnviada ?? fecha) : null,
  };

  const id = numeroONulo(datos.get("id_mov"));

  const { error } = id
    ? await supabase.from("movimientos").update(fila).eq("id_mov", id)
    : await supabase.from("movimientos").insert({
        ...fila,
        id_pais: idPaisActivo ?? idPaisTrabajo,
        id_vendedor: v.id,
      });

  if (error) return { ok: false, mensaje: error.message };

  refrescarFinanzas();
  return {
    ok: true,
    mensaje: id ? "Ingreso actualizado." : "Ingreso registrado.",
  };
}

export async function borrarIngreso(id: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/ingresos") || !v.fin_editar)
    return { ok: false, mensaje: "Su perfil no permite borrar ingresos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("movimientos")
    .delete()
    .eq("id_mov", id)
    .eq("tipo", "Ingreso");

  if (error) return { ok: false, mensaje: error.message };

  refrescarFinanzas();
  return { ok: true, mensaje: "Ingreso eliminado." };
}

// Confirma que un ingreso proyectado efectivamente se recibio: le fija la
// fecha y lo deja pagado, que es cuando entra en la cartola y mueve saldo.
export async function confirmarIngreso(
  _previo: Resultado | null,
  datos: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/ingresos") || !v.fin_editar)
    return { ok: false, mensaje: "Su perfil no permite confirmar ingresos." };

  const supabase = await createClient();

  const idMov = numeroONulo(datos.get("id_mov"));
  const fecha = textoONulo(datos.get("fecha"));
  if (!idMov || !fecha) return { ok: false, mensaje: "Falta la fecha." };

  // Las reglas de la base deciden si procede; aqui solo se acota a que sea un
  // ingreso, para que esta accion no sirva de atajo para pagar un egreso sin
  // sus comprobaciones.
  const { error, data: filas } = await supabase
    .from("movimientos")
    .update({ estado_pago: "Pagado", fecha, fecha_pago: fecha })
    .eq("id_mov", idMov)
    .eq("tipo", "Ingreso")
    .select("id_mov");

  if (error) return { ok: false, mensaje: error.message };
  if (!filas || filas.length === 0)
    return { ok: false, mensaje: "No puede confirmar este ingreso." };

  refrescarFinanzas();
  return { ok: true, mensaje: "Ingreso confirmado como recibido." };
}
