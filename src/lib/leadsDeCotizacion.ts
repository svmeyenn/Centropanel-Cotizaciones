import type { createClient } from "@/lib/supabase/server";

// De que lead viene una cotizacion. Es la inversa de clientify_cotizaciones_de,
// que arma la lista de cotizaciones de la ficha de un lead, y usa las mismas dos
// vias para que la ida y la vuelta nunca digan cosas distintas:
//   - "oportunidad": la oportunidad del CRM nombra el folio de la cotizacion
//     (es lo mas seguro: alguien la anoto a mano);
//   - "ficha": el lead y la cotizacion son del mismo cliente;
//   - "manual": alguien la vinculo a mano, y eso manda sobre las otras dos.
//
// Todo se lee con los permisos de quien mira, sin funciones definer: cada
// persona ve solo los leads que ya podia ver, y un lead de otro mercado no
// aparece aunque exista la relacion.

type Supa = Awaited<ReturnType<typeof createClient>>;

export type LeadDeCotizacion = {
  id_clientify: number;
  nombre: string;
  estado: string;
  propietario: string | null;
  id_pais: number;
  via: "manual" | "oportunidad" | "ficha";
  // El nombre de la oportunidad que menciona la cotizacion, si fue por esa via.
  oportunidad: string | null;
};

// Un cliente grande puede tener muchos contactos: se muestran los primeros y se
// dice cuantos mas hay.
const MAX_POR_FICHA = 5;

export async function leadsDeCotizacion(
  supabase: Supa,
  cot: { id?: number; num_cotizacion: string | null; id_cliente: number | null }
): Promise<{ leads: LeadDeCotizacion[]; omitidos: number }> {
  const [porOportunidad, porFicha, porManual] = await Promise.all([
    cot.num_cotizacion
      ? supabase
          .from("clientify_oportunidades")
          .select("id_contacto, nombre")
          .contains("cotizaciones", [cot.num_cotizacion])
      : Promise.resolve({ data: [] as { id_contacto: number | null; nombre: string | null }[] }),
    cot.id_cliente != null
      ? supabase.from("clientify_contactos").select("id_clientify").eq("id_entidad", cot.id_cliente).limit(200)
      : Promise.resolve({ data: [] as { id_clientify: number }[] }),
    cot.id != null
      ? supabase.from("cotizacion_lead_manual").select("id_clientify").eq("id_cotizacion", cot.id).maybeSingle()
      : Promise.resolve({ data: null as { id_clientify: number } | null }),
  ]);

  const oportunidad = new Map<number, string | null>();
  for (const o of porOportunidad.data ?? []) {
    if (o.id_contacto != null && !oportunidad.has(Number(o.id_contacto))) {
      oportunidad.set(Number(o.id_contacto), o.nombre ?? null);
    }
  }
  const fichas = new Set<number>((porFicha.data ?? []).map((k) => Number(k.id_clientify)));
  const manual = porManual.data?.id_clientify != null ? Number(porManual.data.id_clientify) : null;
  const ids = [...new Set([...(manual != null ? [manual] : []), ...oportunidad.keys(), ...fichas])];
  if (ids.length === 0) return { leads: [], omitidos: 0 };

  // v_leads aplica el acceso por pais de quien consulta: lo que no puede ver no vuelve.
  const { data } = await supabase
    .from("v_leads")
    .select("id_clientify, nombre_completo, estado_efectivo, propietario, id_pais")
    .in("id_clientify", ids);

  const todos: LeadDeCotizacion[] = (data ?? []).map((l) => {
    const id = Number(l.id_clientify);
    const porOp = oportunidad.has(id);
    const aMano = id === manual;
    return {
      id_clientify: id,
      nombre: (l.nombre_completo as string | null)?.trim() || "(sin nombre)",
      estado: (l.estado_efectivo as string | null) ?? "",
      propietario: (l.propietario as string | null) ?? null,
      id_pais: Number(l.id_pais),
      via: aMano ? "manual" : porOp ? "oportunidad" : "ficha",
      oportunidad: porOp && !aMano ? (oportunidad.get(id) ?? null) : null,
    };
  });

  const aMano = todos.filter((l) => l.via === "manual");
  const deOportunidad = todos.filter((l) => l.via === "oportunidad").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const deFicha = todos.filter((l) => l.via === "ficha").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return {
    leads: [...aMano, ...deOportunidad, ...deFicha.slice(0, MAX_POR_FICHA)],
    omitidos: Math.max(0, deFicha.length - MAX_POR_FICHA),
  };
}
