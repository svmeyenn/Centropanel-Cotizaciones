"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

function refrescar() {
  for (const r of ["/libro-diario", "/estado-resultados", "/balance", "/activos-fijos", "/avance-obras"]) {
    revalidatePath(r);
  }
}

// Rehace los asientos automaticos de un mercado con lo que hay hoy en los documentos.
export async function contabilizar(idPais: number, hasta: string) {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) return { error: "No tiene permiso para contabilizar." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return { error: "Fecha no valida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fin_contabilizar", { p_pais: idPais, p_hasta: hasta });
  if (error) return { error: error.message };
  refrescar();
  return { ok: true, asientos: Number(data ?? 0) };
}

export interface LineaManual {
  cuenta: string;
  debe: number;
  haber: number;
  centro: string;
}

export async function registrarAsiento(idPais: number, fecha: string, glosa: string, lineas: LineaManual[]) {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) return { error: "No tiene permiso para registrar asientos." };
  const utiles = lineas.filter((l) => l.cuenta && (l.debe > 0 || l.haber > 0));
  const supabase = await createClient();
  const { error } = await supabase.rpc("asiento_manual", {
    p_pais: idPais,
    p_fecha: fecha,
    p_glosa: glosa,
    p_lineas: utiles.map((l) => ({
      cuenta: l.cuenta,
      debe: l.debe,
      haber: l.haber,
      centro: l.centro,
    })),
  });
  if (error) return { error: error.message };
  refrescar();
  return { ok: true };
}

export async function guardarActivo(d: {
  id: number | null;
  idPais: number;
  nombre: string;
  fechaCompra: string;
  costo: number;
  residual: number;
  vidaMeses: number;
  centro: number | null;
  idMov: number | null;
  activo: boolean;
}) {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) return { error: "No tiene permiso para cambiar activos fijos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("activo_fijo_guardar", {
    p_id: d.id,
    p_pais: d.idPais,
    p_nombre: d.nombre,
    p_fecha: d.fechaCompra,
    p_costo: d.costo,
    p_residual: d.residual,
    p_vida: d.vidaMeses,
    p_centro: d.centro,
    p_mov: d.idMov,
    p_activo: d.activo,
  });
  if (error) return { error: error.message };
  refrescar();
  return { ok: true };
}

export async function guardarAvance(idProyecto: number, fecha: string, porcentaje: number) {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) return { error: "No tiene permiso para registrar avances." };
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    return { error: "El avance va de 0 a 100." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("avance_obra_guardar", {
    p_proyecto: idProyecto,
    p_fecha: fecha,
    p_pct: porcentaje,
  });
  if (error) return { error: error.message };
  refrescar();
  return { ok: true };
}
