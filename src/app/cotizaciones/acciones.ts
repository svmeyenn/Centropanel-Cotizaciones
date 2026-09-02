"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TipoDescuento } from "@/types/database";

export interface ItemBorrador {
  id_producto: number | null;
  descripcion: string;
  unidades: number;
  valor_unitario: number;
  costo_unitario: number;
}

export interface DatosCotizacion {
  id_cliente: number | null;
  id_vendedor: number | null;
  id_forma_pago: number | null;
  id_medio_pago: number | null;
  fecha: string;
  validez_dias: number;
  tiempo_entrega: string;
  direccion_despacho: string;
  notas: string;
  descuento_tipo: TipoDescuento;
  descuento_pct: number;
  descuento_monto: number;
  items: ItemBorrador[];
}

// Mismas exigencias que Validar() en modBorrador.bas: sin cliente, sin vendedor,
// sin items o sin direccion de despacho no se graba.
function validar(d: DatosCotizacion): string | null {
  if (!d.id_cliente) return "Elija el cliente.";
  if (!d.id_vendedor) return "Elija el ejecutivo.";
  if (!d.items.length) return "Agregue al menos un item.";
  if (!d.direccion_despacho.trim()) return "Indique la direccion de despacho.";
  if (!d.fecha) return "Indique la fecha.";
  return null;
}

// Una linea en cero solo se admite si el producto es de precio manual: mano de
// obra, flete o descuento se pactan en cada cotizacion. Un producto al que
// simplemente no se le ha cargado el precio no puede irse cotizado en cero.
// Se comprueba aqui ademas de en pantalla: la pantalla se puede saltar.
async function precioFaltante(
  supabase: Awaited<ReturnType<typeof createClient>>,
  d: DatosCotizacion
): Promise<string | null> {
  const enCero = d.items.filter((it) => !Number(it.valor_unitario));
  if (!enCero.length) return null;

  const ids = [
    ...new Set(enCero.map((it) => it.id_producto).filter((x): x is number => !!x)),
  ];
  const manual = new Set<number>();
  if (ids.length) {
    const { data } = await supabase
      .from("v_catalogo_venta")
      .select("id, precio_manual")
      .in("id", ids);
    for (const p of data ?? []) {
      if (p.precio_manual) manual.add(Number(p.id));
    }
  }

  const malo = enCero.find(
    (it) => it.id_producto == null || !manual.has(it.id_producto)
  );
  if (!malo) return null;
  return `"${malo.descripcion}" no tiene precio de venta. Cargueselo en el catalogo o escriba el valor unitario antes de grabar.`;
}

export async function crearCotizacion(d: DatosCotizacion) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite crear cotizaciones." };
  }
  const falta = validar(d);
  if (falta) return { error: falta };

  const supabase = await createClient();

  const sinPrecio = await precioFaltante(supabase, d);
  if (sinPrecio) return { error: sinPrecio };

  // El folio lo asigna el trigger trg_asignar_folio con una secuencia: nunca se
  // calcula en el cliente, asi dos personas grabando a la vez no lo repiten.
  // Nace 'Emitida' porque en web no hay borrador en la base -- el borrador vive
  // en el navegador hasta que se pulsa Grabar, igual que la regla de Access.
  const { data: cot, error: e1 } = await supabase
    .from("cotizaciones")
    .insert({
      id_cliente: d.id_cliente,
      id_vendedor: d.id_vendedor,
      id_forma_pago: d.id_forma_pago,
      id_medio_pago: d.id_medio_pago,
      fecha: d.fecha,
      validez_dias: d.validez_dias,
      tiempo_entrega: d.tiempo_entrega,
      direccion_despacho: d.direccion_despacho,
      notas: d.notas,
      estado: "Emitida",
      descuento_tipo: d.descuento_tipo,
      descuento_pct: d.descuento_pct,
      descuento_monto: d.descuento_monto,
    })
    .select("id, num_cotizacion")
    .single();

  if (e1 || !cot) return { error: e1?.message ?? "No se pudo grabar." };

  const detalle = d.items.map((it, i) => ({
    id_cotizacion: cot.id,
    orden: i + 1,
    id_producto: it.id_producto,
    descripcion: it.descripcion,
    unidades: it.unidades,
    valor_unitario: it.valor_unitario,
    costo_unitario: it.costo_unitario,
  }));

  const { error: e2 } = await supabase.from("cotizacion_detalle").insert(detalle);
  if (e2) {
    // Sin items la cotizacion no sirve y ya consumio un folio: se revierte a
    // mano porque PostgREST no da transacciones entre dos llamadas.
    await supabase.from("cotizaciones").delete().eq("id", cot.id);
    return { error: e2.message };
  }

  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${cot.id}`);
}

export async function actualizarCotizacion(id: number, d: DatosCotizacion) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar cotizaciones." };
  }
  const falta = validar(d);
  if (falta) return { error: falta };

  const supabase = await createClient();

  const sinPrecio = await precioFaltante(supabase, d);
  if (sinPrecio) return { error: sinPrecio };

  const { error: e1 } = await supabase
    .from("cotizaciones")
    .update({
      id_cliente: d.id_cliente,
      id_vendedor: d.id_vendedor,
      id_forma_pago: d.id_forma_pago,
      id_medio_pago: d.id_medio_pago,
      fecha: d.fecha,
      validez_dias: d.validez_dias,
      tiempo_entrega: d.tiempo_entrega,
      direccion_despacho: d.direccion_despacho,
      notas: d.notas,
      descuento_tipo: d.descuento_tipo,
      descuento_pct: d.descuento_pct,
      descuento_monto: d.descuento_monto,
    })
    .eq("id", id);

  if (e1) return { error: e1.message };

  // El detalle se reemplaza completo, como hacia BorradorGrabar en Access.
  const { error: eDel } = await supabase
    .from("cotizacion_detalle")
    .delete()
    .eq("id_cotizacion", id);
  if (eDel) return { error: eDel.message };

  const detalle = d.items.map((it, i) => ({
    id_cotizacion: id,
    orden: i + 1,
    id_producto: it.id_producto,
    descripcion: it.descripcion,
    unidades: it.unidades,
    valor_unitario: it.valor_unitario,
    costo_unitario: it.costo_unitario,
  }));
  const { error: e2 } = await supabase.from("cotizacion_detalle").insert(detalle);
  if (e2) return { error: e2.message };

  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath("/cotizaciones");
  return { ok: true };
}

// Estados: Emitida -> Enviada al mandar por correo/WhatsApp. Aceptada y
// Rechazada son manuales y no se pisan solas (misma regla que en Access).
export async function cambiarEstado(id: number, estado: string) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar cotizaciones." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("cotizaciones")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath("/cotizaciones");
  return { ok: true };
}

// Repetir una venta era volver a armarla linea por linea. Duplicar copia
// cliente, condiciones e items con sus cantidades, pero refresca el precio
// desde el catalogo: lo que se repite es lo que se vende, no lo que valia.
export async function duplicarCotizacion(id: number) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite crear cotizaciones." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicar_cotizacion", {
    p_cotizacion: id,
  });
  if (error) return { error: error.message };

  revalidatePath("/cotizaciones");
  return { ok: true, id: Number(data) };
}
