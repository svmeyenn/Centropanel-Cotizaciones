"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

// Convierte una cotizacion en pedido. Todo el trabajo lo hace generar_pedido()
// en la base, en una sola transaccion: copia cabecera y lineas y deja la
// cotizacion Aceptada. Si se hiciera por pasos desde aqui, un fallo a mitad
// dejaria una cotizacion aceptada sin pedido.
export async function generarPedido(idCotizacion: number) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite generar pedidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_pedido", {
    p_cotizacion: idCotizacion,
  });

  if (error) return { error: error.message };

  revalidatePath("/pedidos");
  revalidatePath(`/cotizaciones/${idCotizacion}`);
  revalidatePath("/cotizaciones");
  return { ok: true, id: Number(data) };
}

export interface DatosPedido {
  fecha: string;
  estado: string;
  direccion_despacho: string;
  tiempo_entrega: string;
  notas: string;
}

export async function actualizarPedido(id: number, d: DatosPedido) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar pedidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({
      fecha: d.fecha,
      estado: d.estado,
      direccion_despacho: d.direccion_despacho.trim() || null,
      tiempo_entrega: d.tiempo_entrega.trim() || null,
      notas: d.notas.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

export interface LineaPedido {
  id: number;
  unidades: number;
  valor_unitario: number;
}

// Las lineas del pedido si se editan: el pedido es el documento vivo, a
// diferencia de la cotizacion, que queda congelada al generarlo.
export async function actualizarLineasPedido(
  idPedido: number,
  lineas: LineaPedido[]
) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar pedidos." };
  }
  const supabase = await createClient();
  for (const l of lineas) {
    const { error } = await supabase
      .from("pedido_detalle")
      .update({ unidades: l.unidades, valor_unitario: l.valor_unitario })
      .eq("id", l.id);
    if (error) return { error: error.message };
  }
  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

export async function quitarLineaPedido(id: number, idPedido: number) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar pedidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("pedido_detalle").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

// Reparte las necesidades del pedido entre los proveedores que las tienen en
// su maestra y crea un documento por cada uno. Devuelve tambien lo que quedo
// sin proveedor, que es lo que hay que salir a buscar a mano.
export async function generarSolicitudes(idPedido: number) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite generar solicitudes." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_solicitudes", {
    p_pedido: idPedido,
  });
  if (error) return { error: error.message };

  const r = (data ?? {}) as { solicitudes?: number; sin_proveedor?: string[] };
  revalidatePath(`/pedidos/${idPedido}`);
  return {
    ok: true,
    solicitudes: Number(r.solicitudes ?? 0),
    sinProveedor: r.sin_proveedor ?? [],
  };
}

export async function cambiarEstadoSolicitud(
  id: number,
  idPedido: number,
  estado: string
) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar solicitudes." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  revalidatePath(`/solicitudes/${id}`);
  return { ok: true };
}
