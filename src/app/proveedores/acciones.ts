"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

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
}

export async function crearProveedor(d: DatosProveedor) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!d.razon_social.trim()) return { error: "Indique la razon social." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedores")
    .insert({
      razon_social: d.razon_social.trim(),
      rut: d.rut.trim() || null,
      contacto: d.contacto.trim() || null,
      email: d.email.trim() || null,
      telefono: d.telefono.trim() || null,
      direccion: d.direccion.trim() || null,
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
  if (!d.razon_social.trim()) return { error: "Indique la razon social." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
    .update({
      razon_social: d.razon_social.trim(),
      rut: d.rut.trim() || null,
      contacto: d.contacto.trim() || null,
      email: d.email.trim() || null,
      telefono: d.telefono.trim() || null,
      direccion: d.direccion.trim() || null,
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
