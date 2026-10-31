"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

export async function guardarCuenta(codigo: string, nombre: string, uso: string, activa: boolean) {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) return { error: "No tiene permiso para cambiar el plan de cuentas." };
  if (!nombre.trim()) return { error: "Indique el nombre de la cuenta." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("plan_cuenta_guardar", {
    p_codigo: codigo,
    p_nombre: nombre,
    p_uso: uso,
    p_activa: activa,
  });
  if (error) return { error: error.message };
  revalidatePath("/plan-cuentas");
  return { ok: true };
}

// Cada categoria de ingreso o egreso apunta a una cuenta del plan y a un concepto del flujo.
export async function mapearCategoria(idCategoria: number, cuenta: string, flujo: string) {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) return { error: "No tiene permiso para mapear categorias." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("categoria_mapear", {
    p_cat: idCategoria,
    p_cuenta: cuenta,
    p_flujo: flujo,
  });
  if (error) return { error: error.message };
  revalidatePath("/plan-cuentas");
  revalidatePath("/flujo-efectivo");
  return { ok: true };
}
