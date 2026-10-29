import { createClient } from "@/lib/supabase/server";

// Cada solicitud que sale a un proveedor lleva su propio numero --SC-00001-1, SC-00001-2...--, fijo para siempre. Los
// numeros salen de la base: quien compra los asigna la primera vez que hace falta (al ver o enviar el documento) y
// los demas solo los leen. Clave del mapa: "idSolicitud:idParticipante".
export async function numerosSolicitud(pares: { idSc: number; idPart: number }[], asignar: boolean): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  const reales = pares.filter((p) => p.idPart > 0);
  if (reales.length === 0) return salida;
  const supabase = await createClient();
  const { data } = await supabase.from("sc_proveedor").select("id_sc, id_participante, numero").in("id_sc", [...new Set(reales.map((p) => p.idSc))]);
  for (const r of data ?? []) salida.set(`${r.id_sc}:${r.id_participante}`, r.numero as string);
  if (asignar) {
    for (const p of reales) {
      const k = `${p.idSc}:${p.idPart}`;
      if (salida.has(k)) continue;
      const { data: n } = await supabase.rpc("sc_numero_proveedor", { p_sc: p.idSc, p_part: p.idPart });
      if (typeof n === "string" && n) salida.set(k, n);
    }
  }
  return salida;
}
