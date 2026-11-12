import type { SupabaseClient } from "@supabase/supabase-js";

export type MedidaMax = { largo: number; ancho: number };

// Largo y ancho maximo de cada panel (la mayor de sus placas y su EPS). Sin ids, todos los paneles visibles.
export async function leerMedidas(supabase: SupabaseClient, ids?: (number | null | undefined)[]): Promise<Record<number, MedidaMax>> {
  const lista = ids ? [...new Set(ids.filter((x): x is number => x != null))] : null;
  if (lista && !lista.length) return {};
  const { data } = await supabase.rpc("medidas_productos", { p_ids: lista });
  const r: Record<number, MedidaMax> = {};
  for (const m of (data ?? []) as { id: number; largo_mm: number; ancho_mm: number }[]) {
    r[Number(m.id)] = { largo: Number(m.largo_mm), ancho: Number(m.ancho_mm) };
  }
  return r;
}
