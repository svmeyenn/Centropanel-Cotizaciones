import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoEstado } from "@/lib/catalogoEstados";

// El motivo (de una lista que se administra en "Motivos de estado") y el comentario
// libre que acompanan un cambio de estado.
export interface ExtraEstado {
  motivo: number | null;
  comentario: string;
}

export interface MotivoOpcion {
  id: number;
  etiqueta: string;
}

export const COMENTARIO_MAX = 1000;

// Antes de cambiar el estado: si el estado exige motivo --y hay motivos para
// elegir--, tiene que venir uno. Devuelve el mensaje, o null si todo esta bien.
export async function exigirMotivo(
  supabase: SupabaseClient,
  tipo: TipoEstado,
  estado: string,
  extra?: ExtraEstado
): Promise<string | null> {
  if ((extra?.comentario ?? "").trim().length > COMENTARIO_MAX)
    return `El comentario es demasiado largo (maximo ${COMENTARIO_MAX} letras).`;
  if (extra?.motivo) return null;
  const [{ data: motivos }, { data: oblig }] = await Promise.all([
    supabase.from("motivos_estado").select("id").eq("tipo", tipo).eq("estado", estado).eq("activo", true).limit(1),
    supabase.from("motivos_obligatorios").select("estado").eq("tipo", tipo).eq("estado", estado).limit(1),
  ]);
  return (motivos?.length ?? 0) > 0 && (oblig?.length ?? 0) > 0 ? "Este estado exige elegir un motivo." : null;
}

// Despues de cambiar el estado: deja el motivo y el comentario en el registro.
export async function anotarEstado(
  supabase: SupabaseClient,
  tipo: TipoEstado,
  ref: number,
  estado: string,
  extra?: ExtraEstado
): Promise<string | null> {
  if (!extra || (!extra.motivo && !extra.comentario.trim())) return null;
  const { error } = await supabase.rpc("estado_anotar", {
    p_tipo: tipo,
    p_ref: ref,
    p_estado: estado,
    p_motivo: extra.motivo,
    p_comentario: extra.comentario,
  });
  return error ? error.message : null;
}
