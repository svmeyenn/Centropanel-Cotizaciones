"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import type { Rol } from "@/types/database";

export interface DatosVendedor {
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  rol: Rol;
  // A que mercado entra: Chile, Peru o Ambos. Administrador + Ambos es el
  // administrador general, el unico que cruza paises.
  mercado: "Chile" | "Peru" | "Ambos";
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_admin: boolean;
  activo: boolean;
}

export async function actualizarVendedor(id: number, d: DatosVendedor) {
  const yo = await requerirVendedor();
  if (yo.rol !== "Administrador") {
    return { error: "Solo el administrador puede cambiar los accesos." };
  }
  if (!d.nombre.trim()) return { error: "Indique el nombre." };

  // Un administrador no puede quitarse a si mismo el rol ni desactivarse: si lo
  // hiciera y fuera el unico, nadie podria volver a administrar el sistema.
  if (id === yo.id) {
    if (d.rol !== "Administrador") {
      return { error: "No puede quitarse a usted mismo el perfil de Administrador." };
    }
    if (!d.activo) {
      return { error: "No puede desactivar su propia cuenta." };
    }
  }

  const supabase = await createClient();

  // Tampoco se puede dejar el sistema sin ningun administrador activo.
  if (d.rol !== "Administrador" || !d.activo) {
    const { count } = await supabase
      .from("vendedores")
      .select("id", { count: "exact", head: true })
      .eq("rol", "Administrador")
      .eq("activo", true)
      .neq("id", id);
    if (!count) {
      return {
        error: "Debe quedar al menos un Administrador activo en el sistema.",
      };
    }
  }

  const { error } = await supabase
    .from("vendedores")
    .update({
      nombre: d.nombre.trim(),
      cargo: d.cargo.trim() || null,
      email: d.email.trim() || null,
      telefono: d.telefono.trim() || null,
      rol: d.rol,
      mercado: d.mercado,
      puede_ver: d.puede_ver,
      puede_crear: d.puede_crear,
      puede_editar: d.puede_editar,
      puede_admin: d.puede_admin,
      activo: d.activo,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/vendedores");
  return { ok: true };
}
