"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import {
  faltantesFicha,
  type CuentaBancaria,
  type DatosFicha,
  type TipoFicha,
} from "@/lib/fichas";
import { buscarParecidos, type Parecido } from "@/lib/finanzas/parecidos";

export interface ResultadoFicha {
  ok?: boolean;
  id_entidad?: number;
  error?: string;
  // Fichas que podrian ser la misma. Llegan cuando el alta se frena para
  // preguntar; la pantalla decide si insiste.
  parecidas?: Parecido[];
}

// Quien puede tocar la ficha. El cotizador la edita porque ahi se crean los
// clientes; finanzas la edita porque ahi viven el RUT y la cuenta bancaria. Las
// marcas que no son "cliente" y los datos de pago solo los ve y los toca quien
// trabaja con la plata.
async function permisos() {
  const v = await requerirVendedor();
  const admin = tienePerfilAdmin(v);
  return {
    v,
    puedeCrear: v.puede_crear || admin || v.fin_mantenedores || v.fin_editar,
    puedeEditar: v.puede_editar || admin || v.fin_mantenedores || v.fin_editar,
    veFinanzas:
      v.fin_mantenedores ||
      v.fin_editar ||
      v.fin_ver_todo ||
      v.fin_ver_egresos ||
      v.fin_ver_ingresos ||
      v.fin_ver_cartola ||
      v.fin_ver_informes ||
      v.fin_solicitar_gastos ||
      v.fin_rendir_gastos ||
      v.fin_pagar_gastos,
    puedeJuntar: v.fin_mantenedores || v.puede_editar || admin,
  };
}

function limpiar(d: DatosFicha) {
  return {
    razon_social: d.razon_social.trim(),
    nombre_referencia: d.nombre_referencia.trim(),
    rut: d.rut.trim() || null,
    contacto: d.contacto.trim() || null,
    email: d.email.trim() || null,
    telefono: d.telefono.trim() || null,
    direccion: d.direccion.trim() || null,
    comuna: d.comuna.trim() || null,
    ciudad: d.ciudad.trim() || null,
    con_transferencia: d.con_transferencia,
  };
}

// El mercado de la ficha. Quien alcanza uno solo no elige: se le pone el suyo.
async function paisElegido(d: DatosFicha): Promise<number | null> {
  const v = await requerirVendedor();
  const { accesibles, idPaisActivo } = await contextoMercado(v);
  if (accesibles.length <= 1) return accesibles[0]?.id ?? idPaisActivo ?? null;
  if (d.id_pais && accesibles.some((p) => p.id === d.id_pais)) return d.id_pais;
  return idPaisActivo ?? accesibles[0]?.id ?? null;
}

export async function guardarFicha(
  id: number | null,
  d: DatosFicha,
  cuentas: CuentaBancaria[],
  crearIgual = false
): Promise<ResultadoFicha> {
  const p = await permisos();
  if (id === null && !p.puedeCrear) return { error: "Su perfil no permite crear fichas." };
  if (id !== null && !p.puedeEditar) return { error: "Su perfil no permite modificar fichas." };

  // Las marcas distintas de cliente y los datos de pago son de finanzas: quien
  // no los ve tampoco los cambia desde aqui.
  const tipos: TipoFicha[] = p.veFinanzas ? d.tipos : ["cliente"];
  const datos: DatosFicha = {
    ...d,
    tipos,
    con_transferencia: p.veFinanzas ? d.con_transferencia : false,
  };
  const banco = p.veFinanzas ? cuentas : [];

  const faltan = faltantesFicha(datos, banco);
  if (faltan.length > 0) return { error: `Faltan datos: ${faltan.join(", ")}.` };

  const supabase = await createClient();

  // Antes de crear una nueva se mira si ya esta: la misma ficha cargada dos
  // veces con el nombre escrito distinto deja los datos repartidos entre las
  // dos, y al pagar nadie sabe cual es la buena. No se bloquea --dos personas
  // pueden llamarse igual--; se avisa y la pantalla insiste si corresponde.
  if (id === null && !crearIgual) {
    const { data: existentes } = await supabase
      .from("entidades")
      .select("id_entidad, razon_social, nombre_referencia, rut, activo");
    const parecidas = buscarParecidos(
      {
        razon_social: datos.razon_social,
        nombre_referencia: datos.nombre_referencia,
        rut: datos.rut || null,
      },
      (existentes ?? []).map((e) => ({
        id_interlocutor: e.id_entidad,
        razon_social: e.razon_social,
        nombre_referencia: e.nombre_referencia,
        rut: e.rut,
        borrado: !e.activo,
      }))
    );
    if (parecidas.length > 0) {
      return {
        error:
          parecidas.length === 1
            ? "Ya hay una ficha que podria ser la misma."
            : `Hay ${parecidas.length} fichas que podrian ser la misma.`,
        parecidas,
      };
    }
  }

  let idFicha = id;
  if (id === null) {
    const idPais = await paisElegido(datos);
    const { data, error } = await supabase
      .from("entidades")
      .insert({ ...limpiar(datos), id_pais: idPais, activo: true })
      .select("id_entidad")
      .single();
    if (error) return { error: error.message };
    idFicha = data.id_entidad;
  } else {
    const idPais = await paisElegido(datos);
    const { error } = await supabase
      .from("entidades")
      .update({ ...limpiar(datos), ...(idPais ? { id_pais: idPais } : {}) })
      .eq("id_entidad", id);
    if (error) return { error: error.message };
  }

  // Las marcas quedan como las dejo la pantalla: se agregan las nuevas y se
  // quitan las que se destildaron. Se comparan contra las que ya estaban en vez
  // de borrarlas todas y volver a escribirlas, para no tocar lo que no cambio.
  const { data: tipoActual } = await supabase
    .from("entidad_tipos")
    .select("tipo")
    .eq("id_entidad", idFicha!);
  const antes = (tipoActual ?? []).map((t) => t.tipo as TipoFicha);

  const sobran = antes.filter((t) => !tipos.includes(t));
  for (const tipo of sobran) {
    const { error } = await supabase
      .from("entidad_tipos")
      .delete()
      .eq("id_entidad", idFicha!)
      .eq("tipo", tipo);
    if (error) return { error: error.message };
  }

  const nuevas = tipos.filter((t) => !antes.includes(t));
  if (nuevas.length > 0) {
    const { error } = await supabase
      .from("entidad_tipos")
      .insert(nuevas.map((tipo) => ({ id_entidad: idFicha!, tipo })));
    if (error) return { error: error.message };
  }

  if (p.veFinanzas) {
    // Las cuentas se reemplazan enteras: son pocas y editarlas una por una
    // obligaria a seguirles el id desde la pantalla.
    await supabase.from("interlocutor_cuentas").delete().eq("id_interlocutor", idFicha!);
    const llenas = banco.filter((c) => c.banco.trim() && c.numero_cuenta.trim());
    if (datos.con_transferencia && llenas.length > 0) {
      const { error } = await supabase.from("interlocutor_cuentas").insert(
        llenas.map((c) => ({
          id_interlocutor: idFicha!,
          banco: c.banco.trim(),
          tipo_cuenta: c.tipo_cuenta.trim(),
          numero_cuenta: c.numero_cuenta.trim(),
          email: c.email.trim(),
        }))
      );
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/clientes");
  revalidatePath("/cotizaciones");
  revalidatePath("/egresos");
  revalidatePath("/ingresos");
  return { ok: true, id_entidad: idFicha! };
}

// No se borra: se desactiva. Una ficha puede tener cotizaciones y movimientos
// detras, y borrarla dejaria el historial sin nombre.
export async function cambiarActivoFicha(id: number, activo: boolean) {
  const p = await permisos();
  if (!p.puedeEditar) return { error: "Su perfil no permite modificar fichas." };
  const supabase = await createClient();
  const { error } = await supabase.from("entidades").update({ activo }).eq("id_entidad", id);
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

// Juntar dos fichas que son la misma. Lo hace la base: hay que mover
// cotizaciones, pedidos, movimientos, rendiciones y cuentas bancarias de una a
// la otra, y eso no se puede dejar a medias.
export async function juntarFichas(mantener: number, absorber: number) {
  const p = await permisos();
  if (!p.puedeJuntar) return { error: "Su perfil no permite juntar fichas." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fusionar_entidades", {
    p_mantener: mantener,
    p_absorber: absorber,
  });
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/cotizaciones");
  revalidatePath("/egresos");
  revalidatePath("/ingresos");
  return { ok: true, mensaje: data as string };
}
