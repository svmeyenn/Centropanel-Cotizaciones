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

// Alta de una persona nueva: hay que crearle la ficha y tambien el acceso, que
// son dos cosas distintas --la ficha vive en vendedores y el acceso en el
// servicio de autenticacion--.
//
// Se usa el registro normal, el mismo que usaria la persona, y no una llave de
// administrador: esa llave abre la base entera saltandose las reglas de
// acceso, y guardarla en el servidor por esto no se justifica.
//
// Registrarse por su cuenta no da acceso a nada: quien no tenga ficha en
// vendedores queda fuera al primer intento.
export async function crearVendedor(d: DatosVendedor, password: string) {
  const yo = await requerirVendedor();
  if (yo.rol !== "Administrador") {
    return { error: "Solo el administrador puede crear usuarios." };
  }
  const nombre = d.nombre.trim();
  const email = d.email.trim().toLowerCase();
  if (!nombre) return { error: "Indique el nombre." };
  if (!email) return { error: "Indique el correo: es con lo que entra al sistema." };
  if (password.length < 8) {
    return { error: "La clave temporal debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();

  const { data: repetido } = await supabase
    .from("vendedores")
    .select("id, nombre")
    .ilike("email", email)
    .maybeSingle();
  if (repetido) {
    return { error: `Ese correo ya lo usa ${repetido.nombre}.` };
  }

  // Cliente aparte y sin cookies: si compartiera el del pedido, la sesion del
  // administrador quedaria reemplazada por la del usuario recien creado.
  const { createClient: createSupabase } = await import("@supabase/supabase-js");
  const suelto = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: alta, error: eAuth } = await suelto.auth.signUp({ email, password });
  if (eAuth) {
    return {
      error:
        eAuth.message.toLowerCase().includes("already")
          ? "Ese correo ya tiene acceso al sistema."
          : eAuth.message,
    };
  }
  const userId = alta.user?.id;
  if (!userId) return { error: "No se pudo crear el acceso." };

  const { error } = await supabase.from("vendedores").insert({
    user_id: userId,
    nombre,
    cargo: d.cargo.trim() || null,
    email,
    telefono: d.telefono.trim() || null,
    rol: d.rol,
    mercado: d.mercado,
    puede_ver: d.puede_ver,
    puede_crear: d.puede_crear,
    puede_editar: d.puede_editar,
    puede_admin: d.puede_admin,
    activo: d.activo,
    debe_cambiar_password: true,
  });

  // El acceso quedo creado; sin ficha no sirve de nada, asi que se avisa en vez
  // de dejar la mitad hecha en silencio.
  if (error) {
    return {
      error: `Se creo el acceso pero no la ficha: ${error.message}. Avise para completarla.`,
    };
  }

  revalidatePath("/vendedores");
  // La confirmacion del correo depende de la configuracion del proyecto; la
  // pantalla avisa segun corresponda.
  return { ok: true, confirmacionPendiente: alta.session == null };
}
