"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { telefonoValido } from "@/lib/formato";
import { puedeEscribirLeads } from "@/lib/leads";

// Crear un lead a mano. Queda con la fuente "manual": la sincronizacion con
// Clientify no lo quita, y cada dato se puede corregir despues desde su ficha.

export interface DatosNuevoLead {
  nombre: string;
  apellido: string;
  empresa: string;
  cargo: string;
  emails: string;
  telefonos: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  region: string;
  origen: string;
  campana: string;
  linea: "" | "paneles" | "casas";
  observaciones: string;
  // Email del propietario; vacio, sin propietario.
  propietario: string;
  id_pais: number | null;
}

export interface ResultadoAlta {
  ok: boolean;
  mensaje?: string;
  id?: number;
  // Leads que ya tienen el mismo email o telefono.
  duplicados?: { id: number; nombre: string; propietario: string | null }[];
}

const lista = (s: string, separador: RegExp) =>
  [...new Set((s ?? "").split(separador).map((x) => x.trim()).filter(Boolean))];

export async function crearLead(d: DatosNuevoLead, forzar = false): Promise<ResultadoAlta> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite crear leads." };

  const emails = lista(d.emails, /[\n,;]+/).map((e) => e.toLowerCase());
  const telefonos = lista(d.telefonos, /[\n;]+/).map((t) => t.replace(/[^\d+]/g, ""));
  const malo = telefonos.find((t) => !telefonoValido(t));
  if (malo)
    return {
      ok: false,
      mensaje: `El telefono "${malo}" necesita el codigo de pais, por ejemplo +56 9 1234 5678 (Chile) o +51 987 654 321 (Peru).`,
    };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_crear", {
    p_datos: {
      nombre: d.nombre,
      apellido: d.apellido,
      empresa: d.empresa,
      cargo: d.cargo,
      emails,
      telefonos,
      direccion: d.direccion,
      comuna: d.comuna,
      ciudad: d.ciudad,
      region: d.region,
      origen: d.origen,
      campana: d.campana,
      linea: d.linea,
      observaciones: d.observaciones,
      propietario: d.propietario,
      id_pais: d.id_pais,
    },
    p_forzar: forzar,
  });
  if (error) return { ok: false, mensaje: error.message };

  const r = (data ?? {}) as { id?: number; duplicados?: ResultadoAlta["duplicados"] };
  if (r.duplicados?.length) return { ok: false, duplicados: r.duplicados };

  revalidatePath("/leads");
  revalidatePath("/");
  return { ok: true, id: Number(r.id), mensaje: "Lead creado." };
}
