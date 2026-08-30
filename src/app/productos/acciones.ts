"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

export interface DatosProducto {
  descripcion: string;
  precio_venta: number;
  precio_manual: boolean;
  activo: boolean;
}

// Edita un producto del catalogo. Deliberadamente NO deja cambiar la
// composicion (EPS y placas): eso equivaldria a convertirlo en otro panel y
// dejaria las cotizaciones viejas apuntando a algo que ya no es. Para un panel
// distinto se usa el configurador.
export async function actualizarProducto(id: number, d: DatosProducto) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede editar el catalogo." };
  }
  if (!d.descripcion.trim()) return { error: "Indique la descripcion." };
  if (d.precio_venta < 0) return { error: "El precio no puede ser negativo." };

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("productos")
    .select("costo_unitario")
    .eq("id", id)
    .single();
  const costo = Number(actual?.costo_unitario ?? 0);

  const { error } = await supabase
    .from("productos")
    .update({
      descripcion: d.descripcion.trim(),
      precio_venta: d.precio_venta,
      // Marcar el precio como manual evita que el recalculo del catalogo lo
      // pise con el que sale del margen objetivo.
      precio_manual: d.precio_manual,
      margen_aplicado: d.precio_venta > 0 ? (d.precio_venta - costo) / d.precio_venta : 0,
      activo: d.activo,
    })
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe otro producto con esa descripcion."
          : error.message,
    };
  }

  revalidatePath("/productos");
  revalidatePath("/configurador");
  return { ok: true };
}

// Recalcula el precio de un panel desde su costo y el margen objetivo, y lo
// devuelve a "precio automatico".
export async function volverAPrecioAutomatico(id: number) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede editar el catalogo." };
  }

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("productos")
    .select("id_eps, id_placa_a, id_placa_b, tipo")
    .eq("id", id)
    .single();

  if (!p || p.tipo !== "Panel SIP" || !p.id_eps || !p.id_placa_a) {
    return { error: "Solo los paneles con composicion tienen precio automatico." };
  }

  const { data: costoRaw } = await supabase.rpc("costo_panel", {
    p_eps: p.id_eps,
    p_placa_a: p.id_placa_a,
    p_placa_b: p.id_placa_b,
  });
  const costo = Number(costoRaw ?? 0);

  const { data: precioRaw } = await supabase.rpc("precio_desde_costo", {
    p_costo: costo,
    p_margen: null,
  });
  const precio = Number(precioRaw ?? 0);

  const { error } = await supabase
    .from("productos")
    .update({
      costo_unitario: costo,
      precio_venta: precio,
      margen_aplicado: precio > 0 ? (precio - costo) / precio : 0,
      precio_manual: false,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/productos");
  return { ok: true, precio };
}

export async function cambiarActivoProducto(id: number, activo: boolean) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede editar el catalogo." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("productos").update({ activo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/productos");
  return { ok: true };
}

export interface DatosProductoNuevo {
  descripcion: string;
  precio_venta: number;
  costo_unitario: number | null;
}

// Alta de productos que no son paneles (fletes, mano de obra, servicios). Los
// paneles no pasan por aqui: su descripcion y su costo los arma la base desde
// la composicion, y para eso esta el configurador.
export async function crearProductoServicio(d: DatosProductoNuevo) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede editar el catalogo." };
  }
  const descripcion = d.descripcion.trim();
  if (!descripcion) return { error: "Indique la descripcion." };
  if (d.precio_venta < 0) return { error: "El precio no puede ser negativo." };

  const supabase = await createClient();
  const costo = d.costo_unitario ?? 0;
  const { data, error } = await supabase
    .from("productos")
    .insert({
      descripcion,
      tipo: "Servicio",
      precio_venta: d.precio_venta,
      costo_unitario: costo,
      margen_aplicado:
        d.precio_venta > 0 ? (d.precio_venta - costo) / d.precio_venta : 0,
      // Un servicio no se recalcula desde el margen objetivo: su precio es el
      // que se escribe aqui.
      precio_manual: true,
      activo: true,
    })
    .select("id, descripcion")
    .single();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe otro producto con esa descripcion."
          : error.message,
    };
  }

  revalidatePath("/productos");
  revalidatePath("/cotizaciones");
  return { ok: true, producto: data };
}
