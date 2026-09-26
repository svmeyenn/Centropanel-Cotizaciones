"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import {
  inspeccionarCartola,
  leerArchivoCartola,
  type InspeccionCartola,
} from "@/lib/finanzas/cartola-banco";

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

  // Si la cuenta tiene su formato configurado, se lee con ese y no se adivina.
  const clienteFormato = await createClient();
  const { data: formato } = await clienteFormato
    .from("cartola_formato")
    .select("*")
    .eq("id_cuenta", idCuenta)
    .maybeSingle();

  const leido = await leerArchivoCartola(archivo, formato ?? null);
  if (!leido.ok) return { ok: false, mensaje: leido.mensaje };

  const supabase = await createClient();

  // El archivo no dice a que cuenta pertenece: eso lo elige la persona. Pero
  // el banco casi siempre escribe el numero de cuenta encima de la tabla, y
  // con eso se puede avisar antes de mezclar la cartola de una cuenta con los
  // movimientos de otra --un error que despues hay que deshacer linea a
  // linea.
  const { data: cuentas } = await supabase
    .from("cuentas")
    .select("id_cuenta, alias, banco, numero_cuenta");

  const soloDigitos = (x: string | null) => (x ?? "").replace(/\D/g, "");
  const elegida = (cuentas ?? []).find(
    (c: { id_cuenta: number }) => c.id_cuenta === idCuenta
  );
  const numeroElegido = soloDigitos(elegida?.numero_cuenta ?? null);

  // Muchas cartolas no traen membrete --la tabla empieza en la primera fila--
  // pero el banco pone la cuenta en el nombre del archivo, aunque sea con los
  // ultimos digitos: "Movimientos_Cuenta_7419".
  const delNombre = archivo.name
    .split(/[^0-9]+/)
    .filter((t) => t.length >= 4 && t.length <= 20);

  const candidatos = [...leido.cuentasEnElArchivo, ...delNombre];

  // Sin ninguna pista no se bloquea nada: hay bancos que no dicen la cuenta en
  // ninguna parte del archivo, y eso no es motivo para no dejar trabajar.
  if (numeroElegido && candidatos.length > 0) {
    const calza = candidatos.some(
      (n) => n === numeroElegido || n.endsWith(numeroElegido) || numeroElegido.endsWith(n)
    );

    if (!calza) {
      // Si el numero del archivo es el de otra cuenta nuestra, se puede decir
      // cual: es el error tipico y asi se arregla de una.
      const otra = (cuentas ?? []).find((c: { numero_cuenta: string | null }) => {
        const n = soloDigitos(c.numero_cuenta);
        return (
          n.length >= 6 &&
          candidatos.some((x) => x === n || x.endsWith(n) || n.endsWith(x))
        );
      }) as { alias: string | null; banco: string } | undefined;

      return {
        ok: false,
        mensaje: otra
          ? `Este archivo es de la cuenta "${otra.alias ?? otra.banco}", y arriba esta elegida "${elegida?.alias ?? elegida?.banco}". Cambie la cuenta y vuelva a cargarlo.`
          : `El archivo no menciona la cuenta "${elegida?.alias ?? elegida?.banco}" (${elegida?.numero_cuenta}) en ninguna parte. Revise que sea la cartola de esa cuenta.`,
      };
    }
  }

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

// ---------------------------------------------------------------------------
// El formato de la cartola de cada cuenta
// ---------------------------------------------------------------------------
//
// Adivinar los nombres de columna funciona la mayoria de las veces. Cuando no,
// esto permite decirselo una vez y no volver a pensarlo: queda guardado en la
// cuenta hasta que se cambie.

export async function inspeccionarArchivo(
  d: FormData
): Promise<
  { ok: true; inspeccion: InspeccionCartola } | { ok: false; mensaje: string }
> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos) return { ok: false, mensaje: "Sin permiso." };

  const archivo = d.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0)
    return { ok: false, mensaje: "Falta el archivo de muestra." };

  return inspeccionarCartola(archivo);
}

export async function guardarFormatoCartola(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return { ok: false, mensaje: "Solo quien paga puede configurar el formato." };

  const idCuenta = Number(d.get("id_cuenta"));
  if (!Number.isInteger(idCuenta) || idCuenta <= 0)
    return { ok: false, mensaje: "Falta la cuenta." };

  const texto = (k: string) => {
    const s = (d.get(k) ?? "").toString().trim();
    return s === "" ? null : s;
  };

  const col_fecha = texto("col_fecha");
  const col_cargo = texto("col_cargo");
  const col_abono = texto("col_abono");
  const col_monto = texto("col_monto");

  if (!col_fecha) return { ok: false, mensaje: "Diga cual columna trae la fecha." };

  // O cargos y abonos separados, o una sola columna con signo. Las dos formas a
  // la vez no se pueden leer.
  const separadas = Boolean(col_cargo || col_abono);
  if (separadas && col_monto)
    return {
      ok: false,
      mensaje:
        "Elija una sola forma: o las columnas de cargo y abono, o una columna de monto con signo.",
    };
  if (!separadas && !col_monto)
    return {
      ok: false,
      mensaje: "Diga donde viene la plata: cargo y abono, o una columna de monto.",
    };

  const supabase = await createClient();
  const { error } = await supabase.from("cartola_formato").upsert(
    {
      id_cuenta: idCuenta,
      col_fecha,
      col_descripcion: texto("col_descripcion"),
      col_documento: texto("col_documento"),
      col_cargo,
      col_abono,
      col_monto,
      monto_invertido: d.get("monto_invertido") === "on",
      id_vendedor: v.id,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "id_cuenta" }
  );

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/conciliacion");
  return {
    ok: true,
    mensaje: "Formato guardado. Las proximas cartolas de esta cuenta se leen asi.",
  };
}

export async function olvidarFormatoCartola(idCuenta: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!v.fin_pagar_gastos)
    return { ok: false, mensaje: "Solo quien paga puede cambiar el formato." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cartola_formato")
    .delete()
    .eq("id_cuenta", idCuenta);

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/conciliacion");
  return {
    ok: true,
    mensaje: "Formato borrado. Se vuelve a reconocer las columnas por su nombre.",
  };
}
