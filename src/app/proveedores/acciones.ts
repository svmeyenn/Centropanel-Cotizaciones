"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { faltantesProveedor, nuevasFaltas } from "@/lib/validacion";
import { etiquetaIdDe } from "@/lib/paises";

async function soloAdmin() {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return "Solo el administrador puede hacer esto.";
  return null;
}

export interface DatosProveedor {
  razon_social: string;
  rut: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  activo?: boolean;
  // Mercado del proveedor. Solo lo elige el administrador general.
  id_pais?: number | null;
}

export async function crearProveedor(d: DatosProveedor) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const faltan = faltantesProveedor(d, await etiquetaIdDe(d.id_pais));
  if (faltan.length > 0) {
    return { error: `Faltan datos del proveedor: ${faltan.join(", ")}.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .insert({
      razon_social: d.razon_social.trim(),
      nombre_referencia: d.razon_social.trim(),
      rut: d.rut.trim(),
      contacto: d.contacto.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      direccion: d.direccion.trim(),
      ...(d.id_pais ? { id_pais: d.id_pais } : {}),
    })
    .select("id_entidad, razon_social")
    .single();

  if (!error) {
    const { error: errMarca } = await supabase
      .from("entidad_tipos")
      .insert({ id_entidad: data.id_entidad, tipo: "proveedor" });
    if (errMarca) return { error: errMarca.message };
  }

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un proveedor con esa razon social."
          : error.message,
    };
  }

  revalidatePath("/proveedores");
  return { ok: true, proveedor: { id: data.id_entidad, razon_social: data.razon_social } };
}

export async function actualizarProveedor(id: number, d: DatosProveedor) {
  const err = await soloAdmin();
  if (err) return { error: err };
  // Un proveedor cargado antes de exigir un dato se puede seguir modificando: solo
  // frena lo que la modificacion deja en blanco.
  const etiqueta = await etiquetaIdDe(d.id_pais);
  const { data: actual } = await (await createClient())
    .from("entidades")
    .select("razon_social, rut, contacto, email, telefono, direccion")
    .eq("id_entidad", id)
    .single();
  const s = (x: string | null | undefined) => x ?? "";
  const faltan = nuevasFaltas(
    faltantesProveedor(d, etiqueta),
    actual
      ? faltantesProveedor(
          {
            razon_social: s(actual.razon_social),
            rut: s(actual.rut),
            contacto: s(actual.contacto),
            email: s(actual.email),
            telefono: s(actual.telefono),
            direccion: s(actual.direccion),
          },
          etiqueta
        )
      : []
  );
  if (faltan.length > 0) {
    return { error: `Faltan datos del proveedor: ${faltan.join(", ")}.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("entidades")
    .update({
      razon_social: d.razon_social.trim(),
      rut: d.rut.trim(),
      contacto: d.contacto.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      direccion: d.direccion.trim(),
      ...(d.id_pais ? { id_pais: d.id_pais } : {}),
      activo: d.activo ?? true,
    })
    .eq("id_entidad", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe otro proveedor con esa razon social."
          : error.message,
    };
  }

  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${id}`);
  return { ok: true };
}

export async function cambiarActivoProveedor(id: number, activo: boolean) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase
    .from("entidades")
    .update({ activo })
    .eq("id_entidad", id);
  if (error) return { error: error.message };
  revalidatePath("/proveedores");
  return { ok: true };
}

// --- maestra del proveedor: que vende y a que costo -------------------------

export interface DatosItemProveedor {
  id_materia_prima: number | null;
  id_producto: number | null;
  codigo: string;
  costo: number;
  // null = la moneda del mercado del proveedor; "USD" si cotiza en dolares.
  moneda: string | null;
}

// El proveedor cotiza en la moneda de su mercado o en dolares; ninguna otra.
function monedaValida(m: string | null) {
  return m == null || m === "" || m === "USD";
}

export async function agregarItemProveedor(
  idProveedor: number,
  d: DatosItemProveedor
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!d.id_materia_prima && !d.id_producto) {
    return { error: "Elija la materia prima o el producto." };
  }
  if (!monedaValida(d.moneda)) return { error: "La moneda del costo es la del mercado o USD." };

  const supabase = await createClient();
  const { error } = await supabase.from("proveedor_items").insert({
    id_proveedor: idProveedor,
    id_materia_prima: d.id_materia_prima,
    id_producto: d.id_producto,
    codigo: d.codigo.trim() || null,
    costo: d.costo,
    moneda: d.moneda || null,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ese item ya esta en la maestra de este proveedor."
          : error.message,
    };
  }

  revalidatePath(`/proveedores/${idProveedor}`);
  return { ok: true };
}

export async function actualizarItemProveedor(
  id: number,
  idProveedor: number,
  costo: number,
  codigo: string,
  activo: boolean,
  moneda: string | null
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!monedaValida(moneda)) return { error: "La moneda del costo es la del mercado o USD." };
  const supabase = await createClient();

  // Un item sin costo no se activa hasta que se le asigne uno.
  if (activo && !(costo > 0)) {
    return { error: "Asigne el costo antes de activar el item: sin costo queda inactivo." };
  }

  // Un preferente no se desactiva: el insumo se quedaria sin quien le defina el costo.
  if (!activo) {
    const { data: actual } = await supabase
      .from("proveedor_items")
      .select("es_preferente")
      .eq("id", id)
      .single();
    if (actual?.es_preferente) {
      return { error: "Este proveedor es el preferente de ese insumo. Quitele la marca antes de desactivarlo." };
    }
  }
  if (!(costo > 0)) {
    const { data: pref } = await supabase.from("proveedor_items").select("es_preferente").eq("id", id).single();
    if (pref?.es_preferente) {
      return { error: "Este proveedor es el preferente de ese insumo: no puede quedar sin costo. Quitele la marca primero." };
    }
  }

  const { error } = await supabase
    .from("proveedor_items")
    .update({ costo, codigo: codigo.trim() || null, activo, moneda: moneda || null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidarCostos(idProveedor);
  return { ok: true };
}

function revalidarCostos(idProveedor: number) {
  revalidatePath(`/proveedores/${idProveedor}`);
  revalidatePath("/materias-primas");
  revalidatePath("/productos");
  revalidatePath("/configurador");
}

// Este proveedor pasa a ser el preferente DE ESE insumo o producto --no de toda su
// maestra--: el costo de los demas proveedores de lo mismo queda como referencia. El
// costo cambia al instante, y se recostean los paneles y las cotizaciones sin pedido;
// los pedidos no se tocan.
export async function marcarPreferente(idItem: number, idProveedor: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("item_marcar_preferente", { p_item: idItem });
  if (error) return { error: error.message };
  revalidarCostos(idProveedor);
  const r = (data ?? {}) as { costo?: number; paneles?: number; cotizaciones?: number };
  return {
    ok: true,
    costo: Number(r.costo ?? 0),
    paneles: Number(r.paneles ?? 0),
    cotizaciones: Number(r.cotizaciones ?? 0),
  };
}

export async function quitarPreferente(idItem: number, idProveedor: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.rpc("item_quitar_preferente", { p_item: idItem });
  if (error) return { error: error.message };
  revalidarCostos(idProveedor);
  return { ok: true };
}

export async function quitarItemProveedor(id: number, idProveedor: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("proveedor_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/proveedores/${idProveedor}`);
  return { ok: true };
}

// Asignacion en lote: se marcan varios productos y se agregan de una vez, con
// costo en cero para completarlo despues en la propia tabla. Cargar una
// maestra de decenas de items de a uno, escribiendo el costo cada vez, es lo
// que hace que la maestra no se cargue nunca.
export async function agregarItemsProveedor(
  idProveedor: number,
  claves: string[]
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!claves.length) return { error: "No hay nada marcado." };

  const filas = claves.map((c) => {
    const [tipo, id] = c.split(":");
    return {
      id_proveedor: idProveedor,
      id_materia_prima: tipo === "mp" ? Number(id) : null,
      id_producto: tipo === "prod" ? Number(id) : null,
      costo: 0,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.from("proveedor_items").insert(filas);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Alguno de los marcados ya estaba en la maestra. Recargue la pagina."
          : error.message,
    };
  }

  revalidatePath(`/proveedores/${idProveedor}`);
  return { ok: true, agregados: filas.length };
}
