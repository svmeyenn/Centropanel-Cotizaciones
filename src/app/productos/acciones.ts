"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

export interface DatosProducto {
  descripcion: string;
  // El costo solo se acepta en lo que no es panel: el de un panel sale de su
  // composicion y escribirlo a mano duraria hasta el proximo recosteo.
  costo_unitario: number;
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
    .select("costo_unitario, tipo")
    .eq("id", id)
    .single();
  const esPanel = actual?.tipo === "Panel SIP";
  const costo = esPanel ? Number(actual?.costo_unitario ?? 0) : d.costo_unitario;

  const { error } = await supabase
    .from("productos")
    .update({
      descripcion: d.descripcion.trim(),
      costo_unitario: costo,
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
  familia: string;
  subfamilia: string;
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
      // La familia es lo que agrupa el catalogo: sin ella el producto queda
      // suelto al final de la lista.
      familia: d.familia.trim() || "Servicios",
      subfamilia: d.subfamilia.trim() || null,
      precio_venta: d.precio_venta,
      costo_unitario: costo,
      margen_aplicado:
        d.precio_venta > 0 ? (d.precio_venta - costo) / d.precio_venta : 0,
      // No se marca como manual: el recosteo del catalogo solo toca paneles
      // (necesita composicion), asi que estos productos no corren riesgo de que
      // les pisen el precio y no hay por que ensuciarlos con la etiqueta.
      precio_manual: false,
      activo: true,
    })
    .select("id, descripcion, familia, subfamilia")
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

// Cambiar la composicion de un panel ya creado. Todo lo hace actualizar_panel()
// en la base: valida, comprueba duplicidad --caras invertidas incluidas-- y
// recalcula descripcion, espesor, costo y precio de una sola vez.
export async function editarComposicionPanel(
  id: number,
  idEps: number,
  idPlacaA: number,
  idPlacaB: number | null
) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite editar paneles." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_panel", {
    p_id: id,
    p_eps: idEps,
    p_placa_a: idPlacaA,
    p_placa_b: idPlacaB,
  });
  if (error) return { error: error.message };

  const r = data as {
    ok?: boolean;
    existe?: boolean;
    duplicado?: boolean;
    id?: number;
    descripcion?: string;
  };

  if (r?.existe) {
    return {
      error: `Esa composicion ya existe en el catalogo: ${r.descripcion}. Use ese panel en vez de duplicarlo.`,
    };
  }
  if (r?.duplicado) {
    return { error: "Otro usuario acaba de crear ese mismo panel." };
  }

  revalidatePath("/productos");
  revalidatePath("/configurador");
  return { ok: true, descripcion: r?.descripcion };
}

// Eliminar un producto del catalogo. La base se niega si ya figura en una
// cotizacion, un pedido o una solicitud: un documento emitido no puede quedar
// citando algo inexistente.
export async function eliminarProducto(id: number) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede eliminar productos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("eliminar_producto", { p_id: id });
  if (error) return { error: error.message };

  const r = data as {
    ok?: boolean;
    en_uso?: boolean;
    cotizaciones?: number;
    pedidos?: number;
    solicitudes?: number;
  };

  if (r?.en_uso) {
    const partes: string[] = [];
    if (r.cotizaciones) partes.push(`${r.cotizaciones} cotizacion(es)`);
    if (r.pedidos) partes.push(`${r.pedidos} pedido(s)`);
    if (r.solicitudes) partes.push(`${r.solicitudes} solicitud(es)`);
    return {
      error: `No se puede eliminar: aparece en ${partes.join(", ")}. Desactivelo en vez de borrarlo.`,
    };
  }

  revalidatePath("/productos");
  return { ok: true };
}
