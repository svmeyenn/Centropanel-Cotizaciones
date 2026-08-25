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

export interface ClienteChoque {
  id: number;
  razon_social: string;
  rut: string | null;
  activo: boolean;
  motivo: "rut" | "razon_social";
}

// Busca un cliente ya registrado que choque con estos datos. La comparacion se
// hace en Postgres (cliente_duplicado) ignorando acentos, puntuacion, espacios
// y mayusculas, y para el RUT ignorando puntos y guion: "10.111.998-K" y
// "10111998k" son el mismo. p_excluir deja fuera el propio registro al editar.
export async function buscarClienteDuplicado(
  razonSocial: string,
  rut: string,
  excluir?: number
): Promise<ClienteChoque | null> {
  await requerirVendedor();
  if (!razonSocial.trim() && !rut.trim()) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("cliente_duplicado", {
    p_razon_social: razonSocial.trim(),
    p_rut: rut.trim() || null,
    p_excluir: excluir ?? null,
  });
  return (data as ClienteChoque | null) ?? null;
}

function mensajeChoque(c: ClienteChoque): string {
  const como = c.motivo === "rut" ? `el RUT ${c.rut}` : "esa razon social";
  const estado = c.activo ? "" : " Ese registro esta desactivado: reactivelo en Clientes en vez de crear otro.";
  return `Ya existe un cliente con ${como}: "${c.razon_social}". No se creo un duplicado.${estado}`;
}

export async function crearCliente(d: DatosCliente) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite crear clientes." };
  }
  if (!d.razon_social.trim()) return { error: "Indique la razon social." };

  // Aviso con nombre y apellido antes de intentar el insert. El indice unico de
  // la base sigue detras como ultima linea de defensa (dos pantallas a la vez).
  const choque = await buscarClienteDuplicado(d.razon_social, d.rut);
  if (choque) return { error: mensajeChoque(choque), duplicado: choque };

  const supabase = await createClient();
  const { data: nuevo, error } = await supabase
    .from("clientes")
    .insert({ ...limpiar(d), activo: true })
    .select("id, razon_social, rut, contacto, email, telefono, direccion, activo")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Ese cliente acaba de quedar registrado (quiza desde otra pantalla). No se creo un duplicado.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/cotizaciones");
  return { ok: true, cliente: nuevo };
}

export async function actualizarCliente(id: number, d: DatosCliente) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar clientes." };
  }
  if (!d.razon_social.trim()) return { error: "Indique la razon social." };

  // Renombrar un cliente para dejarlo igual a otro tambien es duplicarlo.
  const choque = await buscarClienteDuplicado(d.razon_social, d.rut, id);
  if (choque) return { error: mensajeChoque(choque) };

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(limpiar(d)).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return { error: "Esos datos chocan con otro cliente ya registrado." };
    }
    return { error: error.message };
  }

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
