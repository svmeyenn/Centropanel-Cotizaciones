import { createClient } from "@/lib/supabase/server";

// La jerarquia con que se ordena la gestion: Mercado > Unidad de negocio >
// Centro de costo > Proyecto. El mercado es el pais; el resto vive aqui.
export type UnidadNegocio = {
  id: number;
  id_pais: number;
  codigo: string;
  nombre: string;
  orden: number;
  activa: boolean;
};

export type CentroCosto = {
  id: number;
  id_unidad: number;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type PaisFicha = {
  id: number;
  codigo: string;
  nombre: string;
  moneda_base: string;
  prefijo_telefono: string;
  etiqueta_id: string;
  activo: boolean;
  opera: boolean;
};

// Las unidades y centros de los mercados que la persona alcanza, para que los
// formularios ofrezcan solo los del pais del registro.
export async function cargarEstructura(idPais: number | null) {
  const supabase = await createClient();
  let u = supabase.from("unidades_negocio").select("*").order("orden");
  if (idPais) u = u.eq("id_pais", idPais);
  const { data: unidades } = await u;
  const ids = (unidades ?? []).map((x) => x.id as number);
  const { data: centros } = ids.length
    ? await supabase.from("centros_costo").select("*").in("id_unidad", ids).order("orden")
    : { data: [] };
  return {
    unidades: (unidades ?? []) as UnidadNegocio[],
    centros: (centros ?? []) as CentroCosto[],
  };
}

// "Unidad / Centro" para los selectores.
export function etiquetaCentro(
  c: CentroCosto,
  unidades: UnidadNegocio[]
): string {
  const u = unidades.find((x) => x.id === c.id_unidad);
  return `${u ? u.nombre + " / " : ""}${c.codigo} ${c.nombre}`;
}
