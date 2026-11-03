"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { GRUPOS_DESCUENTO } from "@/lib/descuentos";

export interface DatosProducto {
  descripcion: string;
  // Mercado al que pertenece. Solo el administrador general puede moverlo.
  id_pais: number | null;
  // El costo solo se acepta en lo que no es panel: el de un panel sale de su
  // composicion y escribirlo a mano duraria hasta el proximo recosteo.
  costo_unitario: number;
  precio_venta: number;
  precio_manual: boolean;
  activo: boolean;
  // Datos de carga para cotizar el flete. Vacio = no se sabe; en un panel, vacio = se calcula de sus placas y EPS.
  ancho_mm: number | null;
  largo_mm: number | null;
  alto_mm: number | null;
  peso_kg: number | null;
}

// Edita un producto del catalogo. Deliberadamente NO deja cambiar la
// composicion (EPS y placas): eso equivaldria a convertirlo en otro panel y
// dejaria las cotizaciones viejas apuntando a algo que ya no es. Para un panel
// distinto se usa el configurador.
export async function actualizarProducto(id: number, d: DatosProducto) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede editar el catalogo." };
  }
  if (!d.descripcion.trim()) return { error: "Indique la descripcion." };
  if (d.precio_venta < 0) return { error: "El precio no puede ser negativo." };
  for (const n of [d.ancho_mm, d.largo_mm, d.alto_mm, d.peso_kg]) {
    if (n != null && (!Number.isFinite(n) || n <= 0)) return { error: "Las medidas y el peso deben ser mayores que cero." };
  }

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("productos")
    .select("costo_unitario, tipo, id_pais")
    .eq("id", id)
    .single();
  // El costo de un panel sale de su composicion y el de una reventa, de su materia prima.
  const esPanel = actual?.tipo === "Panel SIP" || actual?.tipo === "Reventa";
  let costo = esPanel ? Number(actual?.costo_unitario ?? 0) : d.costo_unitario;

  // Con proveedor preferente el costo es el del item de ese proveedor: cambiarlo aqui
  // cambia el de ese item. Sin preferente es un costo manual (costos_fijar).
  if (!esPanel && costo !== Number(actual?.costo_unitario ?? 0)) {
    const { error: eCosto } = await supabase.rpc("costos_fijar", {
      p_filas: [{ prod: id, costo }],
      p_recostear: false,
    });
    if (eCosto) return { error: eCosto.message };
    const { data: ahora } = await supabase
      .from("productos")
      .select("costo_unitario")
      .eq("id", id)
      .single();
    costo = Number(ahora?.costo_unitario ?? costo);
  }

  const cambiaMercado =
    d.id_pais != null && d.id_pais !== Number(actual?.id_pais);

  const { error } = await supabase
    .from("productos")
    .update({
      ...(cambiaMercado ? { id_pais: d.id_pais } : {}),
      descripcion: d.descripcion.trim(),
      costo_unitario: costo,
      precio_venta: d.precio_venta,
      // Marcar el precio como manual evita que el recalculo del catalogo lo
      // pise con el que sale del margen objetivo.
      precio_manual: d.precio_manual,
      margen_aplicado: d.precio_venta > 0 ? (d.precio_venta - costo) / d.precio_venta : 0,
      activo: d.activo,
      ancho_mm: d.ancho_mm,
      largo_mm: d.largo_mm,
      alto_mm: d.alto_mm,
      peso_kg: d.peso_kg,
    })
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe otro producto con esa descripcion."
          : error.code === "42501"
            ? "Solo el administrador general puede cambiar un producto de mercado."
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
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede editar el catalogo." };
  }

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("productos")
    .select("id_eps, id_placa_a, id_placa_b, tipo, id_pais")
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
    p_pais: p.id_pais,
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
  if (!tienePerfilAdmin(v)) {
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
  // Mercado al que pertenece. Viene puesto para quien trabaja un solo pais; el
  // administrador general tiene que elegirlo.
  id_pais: number | null;
}

// Alta de productos que no son paneles (fletes, mano de obra, servicios). Los
// paneles no pasan por aqui: su descripcion y su costo los arma la base desde
// la composicion, y para eso esta el configurador.
export async function crearProductoServicio(d: DatosProductoNuevo) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede editar el catalogo." };
  }
  const descripcion = d.descripcion.trim();
  if (!descripcion) return { error: "Indique la descripcion." };
  if (d.precio_venta < 0) return { error: "El precio no puede ser negativo." };
  if (d.id_pais == null) return { error: "Indique el mercado del producto." };

  const supabase = await createClient();
  const costo = d.costo_unitario ?? 0;
  const { data, error } = await supabase
    .from("productos")
    .insert({
      id_pais: d.id_pais,
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

// Alta de un producto de reventa: una materia prima que tambien se vende tal cual. Su costo sigue siempre al de
// la materia prima (y con el, el precio, salvo que se fije a mano). Precio vacio = el del margen objetivo.
export async function crearProductoReventa(d: { id_materia_prima: number; familia: string; subfamilia: string; precio_venta: number | null }) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede editar el catalogo." };
  }
  if (!d.id_materia_prima) return { error: "Elija la materia prima." };
  if (d.precio_venta != null && d.precio_venta < 0) return { error: "El precio no puede ser negativo." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reventa_crear", {
    p_materia: d.id_materia_prima,
    p_familia: d.familia,
    p_subfamilia: d.subfamilia,
    p_precio: d.precio_venta,
  });
  if (error)
    return { error: error.code === "23505" ? "Ya existe otro producto con esa descripcion." : error.message };
  revalidatePath("/productos");
  revalidatePath("/cotizaciones");
  return { ok: true, id: Number(data) };
}

export interface MateriaReventa {
  id: number;
  nombre: string;
  sku: string | null;
  costo: number;
  unidad: string | null;
  yaEsProducto: boolean;
}

// Busca materias primas del mercado para revenderlas, con su costo y si ya tienen producto.
export async function buscarMateriasReventa(q: string, idPais: number | null): Promise<MateriaReventa[]> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v) || idPais == null || q.trim().length < 2) return [];
  const supabase = await createClient();
  const t = q.trim().replace(/[%,()]/g, " ");
  const { data } = await supabase
    .from("materias_primas")
    .select("id, nombre, sku, costo, unidad")
    .eq("id_pais", idPais)
    .eq("activo", true)
    .or(`nombre.ilike.%${t}%,sku.ilike.%${t}%`)
    .order("nombre")
    .limit(20);
  const ids = (data ?? []).map((m) => Number(m.id));
  const { data: usados } = ids.length
    ? await supabase.from("productos").select("id_materia_prima").in("id_materia_prima", ids)
    : { data: [] as { id_materia_prima: number | null }[] };
  const enUso = new Set((usados ?? []).map((u) => Number(u.id_materia_prima)));
  return (data ?? []).map((m) => ({
    id: Number(m.id),
    nombre: m.nombre as string,
    sku: m.sku as string | null,
    costo: Number(m.costo ?? 0),
    unidad: m.unidad as string | null,
    yaEsProducto: enUso.has(Number(m.id)),
  }));
}

// Cambiar la composicion de un panel ya creado. Todo lo hace actualizar_panel()
// en la base: valida, comprueba duplicidad --caras invertidas incluidas-- y
// recalcula descripcion, espesor, costo y precio de una sola vez.
export async function editarComposicionPanel(
  id: number,
  idEps: number,
  idPlacaA: number,
  idPlacaB: number | null,
  idPais: number | null = null
) {
  const v = await requerirVendedor();
  if (!v.puede_crear && !tienePerfilAdmin(v)) {
    return { error: "Su perfil no permite editar paneles." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_panel", {
    p_id: id,
    p_eps: idEps,
    p_placa_a: idPlacaA,
    p_placa_b: idPlacaB,
    p_pais: idPais,
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
  if (!tienePerfilAdmin(v)) {
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

// A que descuento pertenece una familia del catalogo: productos, flete o
// instalaciones. Se guarda por mercado, porque cada pais tiene su catalogo.
export async function asignarGrupoFamilia(familia: string, grupo: string) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede configurar el catalogo." };
  }
  if (!(GRUPOS_DESCUENTO as readonly string[]).includes(grupo)) {
    return { error: "Grupo de descuento no valido." };
  }

  const supabase = await createClient();
  const { data: filas, error: eLee } = await supabase
    .from("familias")
    .select("id_pais")
    .eq("nombre", familia);
  if (eLee) return { error: eLee.message };
  if (!filas?.length) return { error: "La familia no existe." };

  const { error } = await supabase
    .from("familias")
    .upsert(
      filas.map((x) => ({ id_pais: Number(x.id_pais), nombre: familia, grupo })),
      { onConflict: "id_pais,nombre" }
    );
  if (error) return { error: error.message };

  revalidatePath("/productos");
  revalidatePath("/familias");
  revalidatePath("/cotizaciones");
  return {};
}

// Excepcion de un producto: lo saca del grupo de su familia. Vacio vuelve a
// heredarlo.
export async function asignarGrupoProducto(id: number, grupo: string | null) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede configurar el catalogo." };
  }
  if (grupo !== null && !(GRUPOS_DESCUENTO as readonly string[]).includes(grupo)) {
    return { error: "Grupo de descuento no valido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("productos")
    .update({ grupo_descuento: grupo })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/productos");
  revalidatePath("/cotizaciones");
  return {};
}
