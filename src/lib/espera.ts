import type { createClient } from "@/lib/supabase/server";

// La espera vigente de un lead o de una cotizacion --o de su hilo--, tal como la
// entrega la base.
export type EsperaVigente = {
  id: number;
  tipo: "lead" | "cotizacion";
  desde: string;
  motivo: string | null;
  quien: string | null;
  id_clientify: number | null;
  id_cotizacion: number | null;
};

// null = no esta en espera; undefined = la base aun no tiene la funcion, y la
// pantalla no ofrece el control en vez de fallar.
export async function leerEspera(
  supabase: Awaited<ReturnType<typeof createClient>>,
  idLead: number | null,
  idCot: number | null
): Promise<EsperaVigente | null | undefined> {
  const { data, error } = await supabase.rpc("espera_vigente", { p_lead: idLead, p_cot: idCot });
  if (error) return undefined;
  return (data as EsperaVigente | null) ?? null;
}
