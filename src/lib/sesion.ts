import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Pais, Vendedor } from "@/types/database";

// Sesion + fila de vendedor asociada. El middleware ya garantiza que hay
// usuario logueado en cualquier ruta que no sea /login, pero cada pagina
// que necesite el rol la pide explicitamente (equivalente a UsuarioId() /
// UsuarioRol() en modApp.bas, pero resuelto en el servidor).
export async function requerirVendedor(): Promise<Vendedor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: vendedor } = await supabase
    .from("vendedores")
    .select("*")
    .eq("user_id", user.id)
    .eq("activo", true)
    .single();

  if (!vendedor) {
    // Usuario autenticado en Supabase pero sin fila en vendedores: no puede
    // operar el sistema. Se le saca la sesion para que no quede en un limbo.
    await supabase.auth.signOut();
    redirect("/login");
  }

  return vendedor as Vendedor;
}

// Contexto de mercado de quien esta operando: que paises alcanza, cual es el
// suyo y si puede elegir. Lo piden las pantallas de alta para saber si
// muestran el selector de pais o lo dejan fijo.
//
// El administrador general --Administrador con mercado Ambos-- no tiene un
// pais propio, y por eso es el unico que tiene que elegirlo a mano.
export async function contextoMercado(v: Vendedor) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("paises")
    .select("id, codigo, nombre, moneda_base, prefijo_telefono, etiqueta_id, activo")
    .eq("activo", true)
    .order("orden");

  const todos = (data ?? []) as Pais[];
  const esAdminGeneral = v.rol === "Administrador" && v.mercado === "Ambos";
  const codigo = v.mercado === "Peru" ? "PE" : "CL";

  const paises = esAdminGeneral ? todos : todos.filter((p) => p.codigo === codigo);
  return {
    paises,
    esAdminGeneral,
    paisPropio: esAdminGeneral ? null : (paises[0]?.id ?? null),
  };
}
