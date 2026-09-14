import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Pais, Vendedor } from "@/types/database";

// Sesion + fila de vendedor asociada. El middleware ya garantiza que hay
// usuario logueado en cualquier ruta que no sea /login, pero cada pagina
// que necesite el rol la pide explicitamente (equivalente a UsuarioId() /
// UsuarioRol() en modApp.bas, pero resuelto en el servidor).
export const requerirVendedor = cache(async function requerirVendedor(): Promise<Vendedor> {
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

  // Quien entro con una clave temporal --creada o blanqueada por el
  // administrador-- no sigue hasta elegir la suya.
  if ((vendedor as Vendedor).debe_cambiar_password) redirect("/cambiar-clave");

  return vendedor as Vendedor;
});

// Cookie con el mercado elegido por quien trabaja los dos paises.
export const COOKIE_MERCADO = "mercado";

// Contexto de mercado de quien esta operando: que paises alcanza, cual es el
// suyo y si puede elegir. Lo piden las pantallas de alta para saber si
// muestran el selector de pais o lo dejan fijo.
//
// El administrador general --Administrador con mercado Ambos-- no tiene un
// pais propio, y por eso es el unico que tiene que elegirlo a mano.
export const contextoMercado = cache(async function contextoMercado(v: Vendedor) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("paises")
    .select("id, codigo, nombre, moneda_base, prefijo_telefono, etiqueta_id, activo")
    .eq("activo", true)
    .order("orden");

  const todos = (data ?? []) as Pais[];
  const esAdminGeneral = v.rol === "Administrador" && v.mercado === "Ambos";
  const codigo = v.mercado === "Peru" ? "PE" : "CL";

  // Paises que la persona alcanza.
  const accesibles = esAdminGeneral ? todos : todos.filter((p) => p.codigo === codigo);

  // Mercado en que esta trabajando ahora. Quien tiene un solo pais siempre esta
  // en el suyo; quien tiene los dos lo elige en la cabecera, y sin eleccion ve
  // todo junto.
  let activo: Pais | null = null;
  if (!esAdminGeneral) {
    activo = accesibles[0] ?? null;
  } else {
    const elegido = (await cookies()).get(COOKIE_MERCADO)?.value;
    activo = accesibles.find((p) => p.codigo === elegido) ?? null;
  }

  return {
    // Lo que se ofrece en las altas: con un mercado activo, solo ese. Para dar
    // de alta en el otro pais se cambia el mercado en la cabecera, asi nadie
    // crea en Peru creyendo que esta en Chile.
    paises: activo ? [activo] : accesibles,
    accesibles,
    esAdminGeneral,
    paisPropio: esAdminGeneral ? null : (accesibles[0]?.id ?? null),
    activo,
    idPaisActivo: activo?.id ?? null,
  };
});

// Acota una consulta al mercado activo. Sin mercado activo --vista Todos-- la
// deja como esta; las reglas de acceso de la base siguen mandando igual.
//
// Sin restriccion de tipo a proposito: los constructores de consulta de
// Supabase tienen tipos tan anidados que el compilador no logra verificarlos.
export function conPais<T>(consulta: T, idPais: number | null): T {
  if (idPais == null) return consulta;
  return (consulta as unknown as { eq(c: string, v: number): T }).eq("id_pais", idPais);
}
