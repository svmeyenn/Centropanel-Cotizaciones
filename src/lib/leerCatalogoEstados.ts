import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { CATALOGO_POR_DEFECTO, type Catalogo, type Estado } from "@/lib/catalogoEstados";

const COLUMNAS = "codigo, etiqueta, orden, activo, es_sistema, rol, marcas";

const limpiar = (filas: unknown): Estado[] =>
  ((filas ?? []) as Record<string, unknown>[]).map((f) => ({
    codigo: String(f.codigo),
    etiqueta: String(f.etiqueta ?? f.codigo),
    orden: Number(f.orden ?? 100),
    activo: Boolean(f.activo),
    es_sistema: Boolean(f.es_sistema),
    rol: (f.rol as string | null) ?? null,
    marcas: Array.isArray(f.marcas) ? (f.marcas as string[]) : [],
  }));

// Los estados vigentes, leidos una vez por solicitud. Si no se pueden leer --la
// tabla todavia no existe, o no hay sesion-- vale lo de origen: una pantalla
// nunca se queda sin los nombres de los estados.
export const catalogoEstados = cache(async function catalogoEstados(): Promise<Catalogo> {
  try {
    const supabase = await createClient();
    const [lead, cotizacion] = await Promise.all([
      supabase.from("estados_lead").select(COLUMNAS).order("orden"),
      supabase.from("estados_cotizacion").select(COLUMNAS).order("orden"),
    ]);
    if (lead.error || cotizacion.error) return CATALOGO_POR_DEFECTO;
    const l = limpiar(lead.data);
    const c = limpiar(cotizacion.data);
    // Una tabla vacia no es una configuracion: es que algo falta.
    if (l.length === 0 || c.length === 0) return CATALOGO_POR_DEFECTO;
    return { lead: l, cotizacion: c };
  } catch {
    return CATALOGO_POR_DEFECTO;
  }
});
