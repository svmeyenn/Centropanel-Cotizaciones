import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Vendedor } from "@/types/database";

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
