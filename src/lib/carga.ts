import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpcionVehiculo } from "@/lib/transportes";

// La carga de un viaje: lo que hay que mover, con peso y medidas que salen de los catalogos
// (productos y materias primas). Lo que el catalogo no trae queda marcado como faltante.
export interface LineaCarga {
  descripcion: string;
  unidades: number;
  ancho_mm: number | null;
  largo_mm: number | null;
  alto_mm: number | null;
  peso_unit: number | null;
  peso_total: number | null;
  volumen_m3: number | null;
  origen: "catalogo" | "calculado" | "falta";
}

export interface ResumenCarga {
  pesoKg: number;
  volumenM3: number;
  // El lado mas largo de cualquier item, en metros: decide si cabe en la tolva.
  largoMaxM: number;
  lineas: number;
  sinPeso: number;
  sinMedidas: number;
}

export async function cargarCarga(
  supabase: SupabaseClient,
  de: { pedido?: number; oc?: number }
): Promise<LineaCarga[]> {
  const { data } = de.pedido != null
    ? await supabase.rpc("carga_pedido", { p_pedido: de.pedido })
    : await supabase.rpc("carga_oc", { p_oc: de.oc });
  const n = (x: unknown) => (x == null ? null : Number(x));
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    descripcion: (f.descripcion as string) ?? "",
    unidades: Number(f.unidades ?? 0),
    ancho_mm: n(f.ancho_mm),
    largo_mm: n(f.largo_mm),
    alto_mm: n(f.alto_mm),
    peso_unit: n(f.peso_unit),
    peso_total: n(f.peso_total),
    volumen_m3: n(f.volumen_m3),
    origen: f.origen as LineaCarga["origen"],
  }));
}

export function resumirCarga(lineas: LineaCarga[]): ResumenCarga {
  let largo = 0;
  for (const l of lineas) {
    for (const d of [l.ancho_mm, l.largo_mm, l.alto_mm]) if (d != null && d > largo) largo = d;
  }
  return {
    pesoKg: lineas.reduce((a, l) => a + (l.peso_total ?? 0), 0),
    volumenM3: lineas.reduce((a, l) => a + (l.volumen_m3 ?? 0), 0),
    largoMaxM: largo / 1000,
    lineas: lineas.length,
    sinPeso: lineas.filter((l) => l.peso_total == null).length,
    sinMedidas: lineas.filter((l) => l.volumen_m3 == null).length,
  };
}

export interface Ajuste {
  ok: boolean;
  avisos: string[];
}

// Si la carga entra en el vehiculo, segun lo que el vehiculo declara. Un limite sin cargar no se evalua.
export function ajusteVehiculo(c: ResumenCarga, v: OpcionVehiculo): Ajuste {
  const avisos: string[] = [];
  if (v.capacidad_kg != null && c.pesoKg > v.capacidad_kg) avisos.push(`pesa ${Math.round(c.pesoKg).toLocaleString("es-CL")} kg y el vehiculo aguanta ${Math.round(v.capacidad_kg).toLocaleString("es-CL")} kg`);
  if (v.capacidad_m3 != null && c.volumenM3 > v.capacidad_m3) avisos.push(`ocupa ${c.volumenM3.toFixed(1)} m³ y el vehiculo lleva ${v.capacidad_m3} m³`);
  if (v.largo_carga_m != null && c.largoMaxM > v.largo_carga_m) avisos.push(`tiene piezas de ${c.largoMaxM.toFixed(2)} m y la tolva mide ${v.largo_carga_m} m`);
  return { ok: avisos.length === 0, avisos };
}

export const folioFlete = (id: number) => `FLT-${String(id).padStart(4, "0")}`;

export function textoCarga(c: ResumenCarga): string {
  const partes = [`${Math.round(c.pesoKg).toLocaleString("es-CL")} kg`, `${c.volumenM3.toFixed(1).replace(".", ",")} m³`, `pieza mas larga ${c.largoMaxM.toFixed(2).replace(".", ",")} m`];
  return partes.join(" · ") + (c.sinPeso > 0 ? ` (faltan datos de ${c.sinPeso} item${c.sinPeso > 1 ? "s" : ""})` : "");
}
