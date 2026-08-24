"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

export interface DatosCliente {
  razon_social: string;
  rut: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
}

function limpiar(d: DatosCliente) {
  return {
    razon_social: d.razon_social.trim(),
    rut: d.rut.trim() || null,
    contacto: d.contacto.trim() || null,
    email: d.email.trim() || null,
    telefono: d.telefono.trim() || null,
    direccion: d.direccion.trim() || null,
  };
}

export async function crearCliente(d: DatosCliente) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite crear clientes." };
  }
  if (!d.razon_social.trim()) return { error: "Indique la razon social." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .insert({ ...limpiar(d), activo: true });
  if (error) return { error: error.message };

  revalidatePath("/clientes");
  return { ok: true };
}

export async function actualizarCliente(id: number, d: DatosCliente) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar clientes." };
  }
  if (!d.razon_social.trim()) return { error: "Indique la razon social." };

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(limpiar(d)).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/clientes");
  return { ok: true };
}

// No se borra: se desactiva. Un cliente puede tener cotizaciones asociadas y
// borrarlo dejaria historial huerfano (la FK ademas lo impediria).
export async function cambiarActivoCliente(id: number, activo: boolean) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar clientes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ activo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}
