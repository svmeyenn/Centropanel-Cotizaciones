"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { telefonoValido } from "@/lib/formato";
import {
  BUCKET_LEADS,
  EXTENSIONES_PROHIBIDAS,
  ORDEN_ESTADOS,
  TOPE_ARCHIVO_LEAD,
  puedeEscribirLeads,
} from "@/lib/leads";
import type { Resultado } from "@/app/clientify/actividad-lead";

// Editar un lead: sus datos, su estado, su linea, y --en las casas-- el proyecto
// con sus archivos. Lo corregido a mano queda aparte de lo que trae Clientify:
// una carga nueva no lo pisa, y cada cambio deja quien lo hizo y cuando.

export interface DatosLead {
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
  id_pais: number | null;
}

const CAMPOS_TEXTO = [
  "nombre",
  "apellido",
  "empresa",
  "cargo",
  "direccion",
  "comuna",
  "ciudad",
  "region",
  "origen",
  "campana",
] as const;

const ROTULOS: Record<string, string> = {
  nombre: "El nombre",
  apellido: "El apellido",
  empresa: "La empresa",
  cargo: "El cargo",
  direccion: "La direccion",
  comuna: "La comuna",
  ciudad: "La ciudad",
  region: "La region",
  origen: "El origen",
  campana: "La campana",
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const soloDigitos = (s: string) => s.replace(/\D/g, "");

interface Actual {
  nombre: string | null;
  apellido: string | null;
  empresa: string | null;
  cargo: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
  origen: string | null;
  campana: string | null;
  emails: { email?: string }[] | null;
  telefonos: { phone?: string; whatsapp?: boolean }[] | null;
  id_pais: number;
}

export async function guardarDatosLead(idLead: number, d: DatosLead): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite editar leads." };
  if (!Number.isInteger(idLead)) return { ok: false, mensaje: "Falta el lead." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("v_leads")
    .select(
      "nombre, apellido, empresa, cargo, direccion, comuna, ciudad, region, origen, campana, emails, telefonos, id_pais"
    )
    .eq("id_clientify", idLead)
    .maybeSingle();
  if (!data) return { ok: false, mensaje: "No se encontro el lead." };
  const actual = data as Actual;

  // Solo viaja lo que cambio: lo que no se toco sigue siguiendo a Clientify.
  const cambios: Record<string, unknown> = {};

  for (const k of CAMPOS_TEXTO) {
    const nuevo = (d[k] ?? "").trim();
    if (nuevo.length > (k === "nombre" || k === "apellido" ? 120 : 200))
      return { ok: false, mensaje: `${ROTULOS[k]} es demasiado largo.` };
    if (nuevo !== (actual[k] ?? "")) cambios[k] = nuevo;
  }

  const nombreFinal = `${"nombre" in cambios ? cambios.nombre : (actual.nombre ?? "")}${
    "apellido" in cambios ? cambios.apellido : (actual.apellido ?? "")
  }`.trim();
  const empresaFinal = "empresa" in cambios ? String(cambios.empresa) : (actual.empresa ?? "");
  if (!nombreFinal && !empresaFinal)
    return { ok: false, mensaje: "El lead necesita al menos un nombre o una empresa." };

  // Emails: uno por linea.
  const emailsNuevos = [
    ...new Set(
      (d.emails ?? "")
        .split(/[\n,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const emailsActuales = [
    ...new Set((actual.emails ?? []).map((e) => (e.email ?? "").trim().toLowerCase()).filter(Boolean)),
  ];
  // Solo se revisa el formato de los que se escriben ahora: uno que ya venia de
  // Clientify no puede impedir corregir otro dato.
  const malo = emailsNuevos.find((e) => !emailsActuales.includes(e) && !CORREO.test(e));
  if (malo) return { ok: false, mensaje: `"${malo}" no parece un email.` };
  if (emailsNuevos.length > 10) return { ok: false, mensaje: "Son demasiados emails (maximo 10)." };
  if (emailsNuevos.join("|") !== emailsActuales.join("|")) {
    const previos = new Map((actual.emails ?? []).map((e) => [(e.email ?? "").trim().toLowerCase(), e]));
    cambios.emails = emailsNuevos.map((email) => ({ ...(previos.get(email) ?? {}), email }));
  }

  // Telefonos: uno por linea, con el codigo del pais (+56 Chile, +51 Peru).
  const previos = new Map((actual.telefonos ?? []).map((t) => [soloDigitos(t.phone ?? ""), t]));
  const lineas = (d.telefonos ?? "")
    .split(/[\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const telefonosNuevos: string[] = [];
  for (const t of lineas) {
    const limpio = t.replace(/[^\d+]/g, "");
    const previo = previos.get(soloDigitos(limpio));
    // Uno que ya estaba se deja como esta; solo se exige el codigo de pais a los
    // que se escriben ahora.
    const phone = previo?.phone ?? limpio;
    if (!previo && !telefonoValido(limpio))
      return {
        ok: false,
        mensaje: `El telefono "${t}" necesita el codigo de pais, por ejemplo +56 9 1234 5678 (Chile) o +51 987 654 321 (Peru).`,
      };
    if (!telefonosNuevos.includes(phone)) telefonosNuevos.push(phone);
  }
  if (telefonosNuevos.length > 10) return { ok: false, mensaje: "Son demasiados telefonos (maximo 10)." };
  const telefonosActuales = [
    ...new Set((actual.telefonos ?? []).map((t) => soloDigitos(t.phone ?? "")).filter(Boolean)),
  ];
  if (telefonosNuevos.map(soloDigitos).join("|") !== telefonosActuales.join("|")) {
    cambios.telefonos = telefonosNuevos.map((phone) => ({
      ...(previos.get(soloDigitos(phone)) ?? {}),
      phone,
    }));
  }

  const cambiaPais = d.id_pais != null && d.id_pais !== actual.id_pais;
  if (Object.keys(cambios).length === 0 && !cambiaPais)
    return { ok: true, mensaje: "No hay cambios que guardar." };

  const { data: msg, error } = await supabase.rpc("lead_guardar_datos", {
    p_lead: idLead,
    p_campos: cambios,
    p_id_pais: cambiaPais ? d.id_pais : null,
  });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/clientify/${idLead}`);
  revalidatePath("/clientify");
  return { ok: true, mensaje: (msg as string) ?? "Datos actualizados." };
}

// Cambiar el estado del lead. Nulo: que vuelva a calcularse solo --el de
// Clientify, o Oportunidad si tiene una cotizacion enviada--.
export async function fijarEstadoLead(idLead: number, estado: string | null): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v))
    return { ok: false, mensaje: "Su perfil no permite cambiar el estado de un lead." };
  if (estado !== null && !ORDEN_ESTADOS.includes(estado))
    return { ok: false, mensaje: "Ese estado no es valido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_fijar_estado", { p_lead: idLead, p_estado: estado });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/clientify/${idLead}`);
  revalidatePath("/clientify");
  return { ok: true, mensaje: (data as string) ?? "Estado actualizado." };
}

export async function fijarLineaLead(
  idLead: number,
  linea: "paneles" | "casas" | null
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite editar leads." };
  if (linea !== null && linea !== "paneles" && linea !== "casas")
    return { ok: false, mensaje: "Esa linea no es valida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_fijar_linea", { p_lead: idLead, p_linea: linea });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/clientify/${idLead}`);
  revalidatePath("/clientify");
  return { ok: true, mensaje: (data as string) ?? "Linea actualizada." };
}

// --- Proyecto de casa -------------------------------------------------------

export interface DatosCasa {
  metros2: string;
  uf: string;
  clp: string;
  usd: string;
  pen: string;
}

// Los campos numericos llegan como los entrega el navegador: punto decimal y sin
// separador de miles. Vacio es "sin dato".
function numero(s: string, rotulo: string, tope: number): number | null | "error" | string {
  const t = (s ?? "").trim();
  if (t === "") return null;
  const n = Number(t.includes(".") ? t : t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return `${rotulo} no es un numero valido.`;
  if (n > tope) return `${rotulo} es demasiado grande.`;
  return n;
}

export async function guardarProyectoCasa(idLead: number, d: DatosCasa): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite editar leads." };

  const campos = [
    numero(d.metros2, "Los metros cuadrados", 1_000_000),
    numero(d.uf, "El valor en UF", 10_000_000),
    numero(d.clp, "El valor en pesos", 1e13),
    numero(d.usd, "El valor en dolares", 1e10),
    numero(d.pen, "El valor en soles", 1e11),
  ];
  const error = campos.find((c) => typeof c === "string");
  if (error) return { ok: false, mensaje: error as string };
  const [metros2, uf, clp, usd, pen] = campos as (number | null)[];

  const supabase = await createClient();
  const { data, error: errRpc } = await supabase.rpc("lead_guardar_casa", {
    p_lead: idLead,
    p_metros2: metros2,
    p_uf: uf,
    p_clp: clp,
    p_usd: usd,
    p_pen: pen,
  });
  if (errRpc) return { ok: false, mensaje: errRpc.message };

  revalidatePath(`/clientify/${idLead}`);
  return { ok: true, mensaje: (data as string) ?? "Datos del proyecto guardados." };
}

// --- Archivos del proyecto --------------------------------------------------
// El navegador sube el archivo directo al deposito --un plano pesa mas de lo que
// admite una peticion al servidor-- y despues pide que se anote aqui.

export async function registrarArchivoLead(
  idLead: number,
  ruta: string,
  nombre: string,
  tipo: string,
  tamano: number
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite subir archivos." };

  const supabase = await createClient();
  const carpeta = `${idLead}/`;
  const quitar = () => supabase.storage.from(BUCKET_LEADS).remove([ruta]);

  if (!ruta.startsWith(carpeta) || ruta.includes("..")) {
    return { ok: false, mensaje: "La ruta del archivo no es valida." };
  }
  if (!nombre.trim() || EXTENSIONES_PROHIBIDAS.test(nombre)) {
    await quitar();
    return { ok: false, mensaje: "Ese tipo de archivo no se puede subir." };
  }
  if (tamano > TOPE_ARCHIVO_LEAD) {
    await quitar();
    return { ok: false, mensaje: "El archivo pesa mas de 25 MB." };
  }

  // Que lo que se anota exista de verdad en el deposito.
  const { data: presentes } = await supabase.storage
    .from(BUCKET_LEADS)
    .list(String(idLead), { search: ruta.slice(carpeta.length) });
  const existe = (presentes ?? []).some((f) => `${carpeta}${f.name}` === ruta);
  if (!existe) return { ok: false, mensaje: "El archivo no llego al deposito. Intente de nuevo." };

  const { error } = await supabase.from("lead_archivos").insert({
    id_clientify: idLead,
    nombre: nombre.trim().slice(0, 200),
    ruta,
    tipo_mime: tipo || null,
    tamano,
    id_vendedor: v.id,
  });
  if (error) {
    await quitar();
    return { ok: false, mensaje: error.message };
  }

  revalidatePath(`/clientify/${idLead}`);
  return { ok: true, mensaje: "Archivo subido." };
}

export async function quitarArchivoLead(idArchivo: number, idLead: number): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite quitar archivos." };

  const supabase = await createClient();
  // Primero la fila --la base decide si es de quien lo subio o de quien
  // administra--, y solo si se borro se saca el archivo del deposito.
  const { data, error } = await supabase
    .from("lead_archivos")
    .delete()
    .eq("id", idArchivo)
    .eq("id_clientify", idLead)
    .select("ruta");
  if (error) return { ok: false, mensaje: error.message };
  if (!data?.length) return { ok: false, mensaje: "Solo quien lo subio, o quien administra, puede quitarlo." };

  await supabase.storage.from(BUCKET_LEADS).remove([data[0].ruta as string]);
  revalidatePath(`/clientify/${idLead}`);
  return { ok: true, mensaje: "Archivo quitado." };
}

// El deposito es privado: para abrir un archivo se pide un enlace que dura diez
// minutos.
export async function urlArchivoLead(
  idArchivo: number
): Promise<{ url?: string; error?: string }> {
  await requerirVendedor();
  const supabase = await createClient();
  const { data: fila } = await supabase
    .from("lead_archivos")
    .select("ruta")
    .eq("id", idArchivo)
    .maybeSingle();
  if (!fila) return { error: "No se encontro el archivo." };

  const { data, error } = await supabase.storage
    .from(BUCKET_LEADS)
    .createSignedUrl(fila.ruta as string, 60 * 10);
  if (error || !data) return { error: error?.message ?? "No se pudo abrir el archivo." };
  return { url: data.signedUrl };
}
