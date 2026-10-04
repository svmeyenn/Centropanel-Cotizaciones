"use server";

import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";

export interface ResultadoCotizar {
  ok?: boolean;
  id_entidad?: number;
  mensaje?: string;
  error?: string;
}

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
// Los telefonos llegan con y sin +56: se comparan por los ultimos nueve digitos.
const cola = (s: string | null | undefined) => digitos(s).slice(-9);

// Deja listo al cliente para cotizarle. Si el lead ya esta enlazado con una
// ficha, se usa esa. Si no, se busca una que ya sea la misma persona --por
// correo o telefono-- para no repetirla, y solo si no hay se crea. El lead queda
// enlazado, y asi sus cotizaciones aparecen en su historial.
export async function prepararCotizacionDesdeLead(idLead: number): Promise<ResultadoCotizar> {
  const v = await requerirVendedor();
  if (!v.puede_crear && !tienePerfilAdmin(v))
    return { error: "Su perfil no permite crear cotizaciones." };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("clientify_contactos")
    .select(
      "id_clientify, nombre_completo, email, telefono, empresa, direccion, comuna, ciudad, region, id_entidad"
    )
    .eq("id_clientify", idLead)
    .maybeSingle();
  if (!lead) return { error: "No se encontro el lead." };

  // Ya enlazado y la ficha sigue vigente.
  if (lead.id_entidad) {
    const { data: ficha } = await supabase
      .from("entidades")
      .select("id_entidad, activo")
      .eq("id_entidad", lead.id_entidad)
      .maybeSingle();
    if (ficha?.activo) return { ok: true, id_entidad: ficha.id_entidad };
  }

  // Una ficha que ya sea esta persona.
  const { data: fichas } = await supabase
    .from("entidades")
    .select("id_entidad, email, telefono")
    .eq("activo", true);
  const correo = (lead.email ?? "").trim().toLowerCase();
  const tel = cola(lead.telefono);
  const igual = (fichas ?? []).find(
    (f) =>
      (correo && (f.email ?? "").trim().toLowerCase() === correo) ||
      (tel.length >= 8 && cola(f.telefono) === tel)
  );
  if (igual) {
    await supabase.rpc("vincular_lead_ficha", { p_lead: idLead, p_entidad: igual.id_entidad });
    return {
      ok: true,
      id_entidad: igual.id_entidad,
      mensaje: "Se uso la ficha de cliente que ya existia.",
    };
  }

  // Si no hay, se crea con lo que se sabe del lead.
  const { accesibles, idPaisActivo } = await contextoMercado(v);
  const idPais = idPaisActivo ?? accesibles[0]?.id ?? null;
  if (!idPais) return { error: "No se pudo determinar el pais del cliente." };

  const nombre = (lead.nombre_completo ?? "").trim();
  if (!nombre && !lead.empresa) return { error: "El lead no tiene nombre ni empresa." };

  const base = {
    razon_social: (lead.empresa ?? nombre).trim(),
    contacto: nombre || null,
    email: lead.email ?? null,
    telefono: lead.telefono ?? null,
    direccion: lead.direccion ?? null,
    comuna: lead.comuna ?? null,
    ciudad: lead.ciudad ?? lead.comuna ?? lead.region ?? null,
    id_pais: idPais,
    activo: true,
    con_transferencia: false,
  };
  const referencia = (lead.empresa ?? nombre).trim();

  // El nombre corto no se puede repetir entre fichas vigentes; si ya lo usa
  // otra persona, se distingue con el numero del lead.
  let creada = await supabase
    .from("entidades")
    .insert({ ...base, nombre_referencia: referencia })
    .select("id_entidad")
    .single();
  if (creada.error?.code === "23505") {
    creada = await supabase
      .from("entidades")
      .insert({ ...base, nombre_referencia: `${referencia} (${idLead})` })
      .select("id_entidad")
      .single();
  }
  if (creada.error || !creada.data)
    return { error: creada.error?.message ?? "No se pudo crear la ficha del cliente." };

  const idEntidad = creada.data.id_entidad as number;
  const { error: errTipo } = await supabase
    .from("entidad_tipos")
    .insert({ id_entidad: idEntidad, tipo: "cliente" });
  if (errTipo) return { error: errTipo.message };

  await supabase.rpc("vincular_lead_ficha", { p_lead: idLead, p_entidad: idEntidad });
  return { ok: true, id_entidad: idEntidad, mensaje: "Se creo la ficha del cliente con los datos del lead." };
}
