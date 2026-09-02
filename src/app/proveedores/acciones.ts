"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { faltantesProveedor } from "@/lib/validacion";

async function soloAdmin() {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") return "Solo el administrador puede hacer esto.";
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
  const faltan = faltantesProveedor(d);
  if (faltan.length > 0) {
    return { error: `Faltan datos del proveedor: ${faltan.join(", ")}.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedores")
    .insert({
      razon_social: d.razon_social.trim(),
      rut: d.rut.trim(),
      contacto: d.contacto.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      direccion: d.direccion.trim(),
      ...(d.id_pais ? { id_pais: d.id_pais } : {}),
    })
    .select("id, razon_social")
    .single();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un proveedor con esa razon social."
          : error.message,
    };
  }

  revalidatePath("/proveedores");
  return { ok: true, proveedor: data };
}

export async function actualizarProveedor(id: number, d: DatosProveedor) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const faltan = faltantesProveedor(d);
  if (faltan.length > 0) {
    return { error: `Faltan datos del proveedor: ${faltan.join(", ")}.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
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
    .eq("id", id);

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
    .from("proveedores")
    .update({ activo })
    .eq("id", id);
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

  const supabase = await createClient();
  const { error } = await supabase.from("proveedor_items").insert({
    id_proveedor: idProveedor,
    id_materia_prima: d.id_materia_prima,
    id_producto: d.id_producto,
    codigo: d.codigo.trim() || null,
    costo: d.costo,
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
  activo: boolean
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedor_items")
    .update({ costo, codigo: codigo.trim() || null, activo })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/proveedores/${idProveedor}`);
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
