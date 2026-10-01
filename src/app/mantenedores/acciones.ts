"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { buscarParecidos, type Parecido } from "@/lib/finanzas/parecidos";
import type { Vendedor } from "@/types/database";

export type Resultado = { ok: boolean; mensaje?: string };

export type ResultadoInterlocutor = Resultado & {
  id_interlocutor?: number;
  nombre_referencia?: string;
  // Fichas que podrian ser la misma persona. Llegan cuando el alta se frena
  // para preguntar; la pantalla decide si insiste.
  parecidos?: Parecido[];
};

const texto = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};

// El monto se teclea a mano y con la puntuacion de aca.
function leerMonto(v: FormDataEntryValue | null): number {
  const s = (v ?? "").toString().trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function refrescar() {
  // Las cuatro listas viven en su propia direccion: se refrescan todas, que
  // es mas barato que acertar cual se toco.
  revalidatePath("/mantenedores", "layout");
  revalidatePath("/ingresos");
  revalidatePath("/egresos");
  revalidatePath("/cartola");
  revalidatePath("/resumen-proyecto");
}

// Las listas con que se clasifica la plata las lleva quien tiene el permiso de
// mantenedores. Los interlocutores son la excepcion --ver mas abajo--.
async function exigirMantenedores(): Promise<
  { ok: true; v: Vendedor } | { ok: false; mensaje: string }
> {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores)
    return { ok: false, mensaje: "Su perfil no permite administrar estas listas." };
  return { ok: true, v };
}

// El mercado en que se crea lo que se da de alta.
async function paisDeAlta(v: Vendedor) {
  const { idPaisActivo, idPaisTrabajo } = await contextoMercado(v);
  return idPaisActivo ?? idPaisTrabajo;
}

// El mercado solo se pregunta a quien alcanza mas de uno; el resto no ve el
// campo y no puede mandarlo. Devuelve null cuando no vino --o vino uno que la
// persona no alcanza--: al crear manda entonces el mercado de trabajo, y al
// editar se deja intacto el que la fila ya tenia.
async function paisElegido(v: Vendedor, d: FormData): Promise<number | null> {
  const pedido = Number(d.get("id_pais")) || null;
  if (!pedido) return null;
  const { accesibles } = await contextoMercado(v);
  return accesibles.some((p) => p.id === pedido) ? pedido : null;
}

// Cambiar de mercado una fila que ya se uso dejaria movimientos de un pais
// clasificados con listas del otro: la base lo impide al cargar un movimiento,
// pero no puede verlo cuando el cambio ocurre en la lista.
async function movimientosDeOtroMercado(
  columna: "id_cuenta" | "id_proyecto" | "id_categoria" | "id_interlocutor",
  id: number,
  idPais: number
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("movimientos")
    .select("id_mov", { count: "exact", head: true })
    .eq(columna, id)
    .neq("id_pais", idPais);
  return count ?? 0;
}

const avisoDeMercado = (n: number) =>
  `No se puede cambiar el mercado: ${n} movimiento(s) del otro pais lo estan usando.`;

export async function guardarCuenta(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const permiso = await exigirMantenedores();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const banco = texto(d.get("banco"));
  if (!banco) return { ok: false, mensaje: "El banco es obligatorio." };

  const fila = {
    banco,
    numero_cuenta: texto(d.get("numero_cuenta")),
    alias: texto(d.get("alias")),
    titular: texto(d.get("titular")),
    moneda: texto(d.get("moneda")),
    saldo_inicial: leerMonto(d.get("saldo_inicial")),
    activa: d.get("activa") === "on",
  };

  const idPais = await paisElegido(permiso.v, d);
  const id = d.get("id_cuenta");
  if (id && idPais) {
    const n = await movimientosDeOtroMercado("id_cuenta", Number(id), idPais);
    if (n > 0) return { ok: false, mensaje: avisoDeMercado(n) };
  }

  const { error } = id
    ? await supabase
        .from("cuentas")
        .update(idPais ? { ...fila, id_pais: idPais } : fila)
        .eq("id_cuenta", Number(id))
    : await supabase
        .from("cuentas")
        .insert({ ...fila, id_pais: idPais ?? (await paisDeAlta(permiso.v)) });

  if (error) return { ok: false, mensaje: error.message };
  refrescar();
  return { ok: true, mensaje: "Cuenta guardada." };
}

export async function guardarProyecto(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const permiso = await exigirMantenedores();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const nombre = texto(d.get("nombre"));
  if (!nombre) return { ok: false, mensaje: "El nombre es obligatorio." };

  const fila = {
    nombre,
    cliente: texto(d.get("cliente")),
    // El folio del pedido que abrio la obra. Normalmente lo pone el sistema;
    // aqui se completa a mano para las obras anteriores a eso.
    num_pedido: texto(d.get("num_pedido")),
    activo: d.get("activo") === "on",
  };

  const idPais = await paisElegido(permiso.v, d);
  const id = d.get("id_proyecto");
  if (id && idPais) {
    const n = await movimientosDeOtroMercado("id_proyecto", Number(id), idPais);
    if (n > 0) return { ok: false, mensaje: avisoDeMercado(n) };
  }

  const { error } = id
    ? await supabase
        .from("proyectos")
        .update(idPais ? { ...fila, id_pais: idPais } : fila)
        .eq("id_proyecto", Number(id))
    : await supabase
        .from("proyectos")
        .insert({ ...fila, id_pais: idPais ?? (await paisDeAlta(permiso.v)) });

  if (error)
    return {
      ok: false,
      mensaje:
        error.code === "23505"
          ? "Ya existe ese proyecto para el mismo cliente y pedido."
          : error.message,
    };

  refrescar();
  return { ok: true, mensaje: "Proyecto guardado." };
}

export async function guardarCategoria(
  _p: Resultado | null,
  d: FormData
): Promise<Resultado> {
  const permiso = await exigirMantenedores();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const nombre = texto(d.get("nombre"));
  if (!nombre) return { ok: false, mensaje: "El nombre es obligatorio." };

  const fila = {
    nombre,
    tipo: d.get("tipo") === "Ingreso" ? "Ingreso" : "Egreso",
  };

  const idPais = await paisElegido(permiso.v, d);
  const id = d.get("id_categoria");
  if (id && idPais) {
    const n = await movimientosDeOtroMercado("id_categoria", Number(id), idPais);
    if (n > 0) return { ok: false, mensaje: avisoDeMercado(n) };
  }

  const { error } = id
    ? await supabase
        .from("categorias")
        .update(idPais ? { ...fila, id_pais: idPais } : fila)
        .eq("id_categoria", Number(id))
    : await supabase
        .from("categorias")
        .insert({ ...fila, id_pais: idPais ?? (await paisDeAlta(permiso.v)) });

  if (error) return { ok: false, mensaje: error.message };
  refrescar();
  return { ok: true, mensaje: "Categoria guardada." };
}

// --- borrado logico --------------------------------------------------------
//
// Nunca se borra la fila: se marca `borrado`, con lo que desaparece de las
// listas y de todos los selectores, pero los movimientos que ya la tenian
// asignada siguen mostrando su nombre y siguen sumando en el resumen por
// proyecto. Un borrado de verdad dejaria esos movimientos en blanco.

export async function borrarProyecto(id: number): Promise<Resultado> {
  const permiso = await exigirMantenedores();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("proyectos")
    .update({ borrado: true, activo: false })
    .eq("id_proyecto", id)
    .select("id_proyecto");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede eliminar este proyecto." };

  refrescar();
  return {
    ok: true,
    mensaje: "Proyecto eliminado. Los movimientos que lo usaban lo conservan.",
  };
}

export async function borrarCategoria(id: number): Promise<Resultado> {
  const permiso = await exigirMantenedores();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("categorias")
    .update({ borrado: true })
    .eq("id_categoria", id)
    .select("id_categoria");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede eliminar esta categoria." };

  refrescar();
  return {
    ok: true,
    mensaje: "Categoria eliminada. Los movimientos que la usaban la conservan.",
  };
}

export async function borrarInterlocutor(id: number): Promise<Resultado> {
  const permiso = await exigirMantenedores();
  if (!permiso.ok) return permiso;

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("interlocutores")
    .update({ borrado: true })
    .eq("id_interlocutor", id)
    .select("id_interlocutor");

  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "No puede eliminar este interlocutor." };

  refrescar();
  return {
    ok: true,
    mensaje: "Interlocutor eliminado. Los movimientos que lo usaban lo conservan.",
  };
}

// --- interlocutores --------------------------------------------------------
//
// A diferencia del resto, estos los puede crear tambien quien carga ingresos o
// solicita gastos: si no, cada pago a alguien nuevo habria que pedirselo a
// otra persona. Es la misma regla que aplica la base.

// Las cuentas viajan como cuatro listas paralelas del mismo largo, una
// posicion por fila del formulario.
function cuentasDelFormulario(d: FormData) {
  const bancos = d.getAll("cta_banco");
  return bancos.map((_, i) => ({
    banco: (bancos[i] ?? "").toString().trim(),
    tipo_cuenta: (d.getAll("cta_tipo")[i] ?? "").toString().trim(),
    numero_cuenta: (d.getAll("cta_numero")[i] ?? "").toString().trim(),
    email: (d.getAll("cta_email")[i] ?? "").toString().trim(),
  }));
}

export async function guardarInterlocutor(
  _p: ResultadoInterlocutor | null,
  d: FormData
): Promise<ResultadoInterlocutor> {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores && !v.fin_editar && !v.fin_solicitar_gastos)
    return { ok: false, mensaje: "Su perfil no permite crear interlocutores." };

  const supabase = await createClient();

  const razon_social = texto(d.get("razon_social"));
  const nombre_referencia = texto(d.get("nombre_referencia"));
  if (!razon_social) return { ok: false, mensaje: "La razon social es obligatoria." };
  if (!nombre_referencia)
    return { ok: false, mensaje: "El nombre de referencia es obligatorio." };

  const con_transferencia = d.get("con_transferencia") === "on";
  const rut = texto(d.get("rut"));

  // Los datos de transferencia son opcionales en bloque, pero si se habilitan
  // dejan de serlo: no sirve media ficha bancaria.
  const cuentas = cuentasDelFormulario(d).filter(
    (c) => c.banco || c.tipo_cuenta || c.numero_cuenta || c.email
  );

  if (con_transferencia) {
    if (!rut)
      return { ok: false, mensaje: "Con datos de transferencia, el RUT es obligatorio." };
    if (cuentas.length === 0)
      return { ok: false, mensaje: "Agregue al menos una cuenta bancaria." };
    const incompleta = cuentas.findIndex(
      (c) => !c.banco || !c.tipo_cuenta || !c.numero_cuenta || !c.email
    );
    if (incompleta >= 0)
      return {
        ok: false,
        mensaje: `A la cuenta ${incompleta + 1} le faltan datos: banco, tipo, numero y correo son obligatorios.`,
      };
  }

  const fila = { razon_social, nombre_referencia, rut, con_transferencia };
  const idPais = await paisElegido(v, d);
  const id = d.get("id_interlocutor");

  // Antes de crear uno nuevo se mira si ya esta: la misma ficha cargada dos
  // veces con el nombre escrito distinto deja los datos bancarios repartidos
  // entre las dos, y al pagar nadie sabe cual es la buena. No se bloquea --dos
  // personas pueden llamarse igual--; se avisa y la pantalla insiste si
  // corresponde.
  if (!id && d.get("crear_igual") !== "on") {
    const { data: fichas } = await supabase
      .from("interlocutores")
      .select("id_interlocutor, razon_social, nombre_referencia, rut, borrado");
    const parecidos = buscarParecidos(
      { razon_social, nombre_referencia, rut },
      (fichas ?? []) as Parameters<typeof buscarParecidos>[1]
    );
    if (parecidos.length > 0) {
      return {
        ok: false,
        mensaje:
          parecidos.length === 1
            ? "Ya hay una ficha que podria ser la misma."
            : `Hay ${parecidos.length} fichas que podrian ser la misma.`,
        parecidos,
      };
    }
  }
  if (id && idPais) {
    const n = await movimientosDeOtroMercado(
      "id_interlocutor",
      Number(id),
      idPais
    );
    if (n > 0) return { ok: false, mensaje: avisoDeMercado(n) };
  }

  const { data, error } = id
    ? await supabase
        .from("interlocutores")
        .update(idPais ? { ...fila, id_pais: idPais } : fila)
        .eq("id_interlocutor", Number(id))
        .select("id_interlocutor")
        .maybeSingle()
    : await supabase
        .from("interlocutores")
        .insert({ ...fila, id_pais: idPais ?? (await paisDeAlta(v)) })
        .select("id_interlocutor")
        .maybeSingle();

  if (error)
    return {
      ok: false,
      mensaje:
        error.code === "23505"
          ? `Ya existe un interlocutor con el nombre de referencia "${nombre_referencia}".`
          : error.message,
    };
  if (!data) return { ok: false, mensaje: "No puede guardar interlocutores." };

  const idInter = data.id_interlocutor;

  // Las cuentas se reescriben completas: no tienen nada colgando de su id, asi
  // que reemplazarlas es mas simple y seguro que diferenciarlas.
  const { error: errorBorrado } = await supabase
    .from("interlocutor_cuentas")
    .delete()
    .eq("id_interlocutor", idInter);
  if (errorBorrado) return { ok: false, mensaje: errorBorrado.message };

  if (cuentas.length > 0) {
    const { error: errorCuentas } = await supabase
      .from("interlocutor_cuentas")
      .insert(cuentas.map((c) => ({ ...c, id_interlocutor: idInter })));
    if (errorCuentas) return { ok: false, mensaje: errorCuentas.message };
  }

  refrescar();

  return {
    ok: true,
    mensaje: id ? "Interlocutor actualizado." : "Interlocutor creado.",
    id_interlocutor: idInter,
    nombre_referencia,
  };
}
