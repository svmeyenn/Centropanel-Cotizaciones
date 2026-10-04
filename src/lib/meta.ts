// Comparar los leads descargados de Meta con los que ya estan en el sistema.
// Puro y sin acceso a la base: lo usan la pantalla (para mostrar) y las acciones
// (para decidir que se escribe), asi que lo que se ve es lo que se aplica.

export interface FilaMeta {
  id: number;
  fecha_meta: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  telefono2: string | null;
  whatsapp: string | null;
  origen_meta: string | null;
  formulario: string | null;
  canal: string | null;
  etapa: string | null;
  id_pais: number;
  descartado: boolean;
  id_lead: number | null;
  // Por que se dio por existente: el email manda, despues el telefono, y el
  // nombre es solo una pista.
  via: "email" | "telefono" | "nombre" | null;
  lead_nombre: string | null;
  lead_emails: { email?: string }[] | null;
  lead_telefonos: { phone?: string; whatsapp?: boolean }[] | null;
  lead_origen: string | null;
  lead_campana: string | null;
}

export type CampoMeta = "nombre" | "email" | "telefono" | "telefono2" | "whatsapp" | "origen" | "campana";
export type ModoMeta = "corregir" | "agregar";
export type EstadoCampo = "igual" | "falta" | "distinto";

export interface Comparacion {
  campo: CampoMeta;
  etiqueta: string;
  lead: string;
  meta: string;
  estado: EstadoCampo;
  puedeCorregir: boolean;
  puedeAgregar: boolean;
}

export type Grupo = "nuevo" | "diferencias" | "faltantes" | "al_dia" | "ignorado";

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normaliza = (s: string | null | undefined) =>
  quitarTildes((s ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
const nueve = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-9);
const correo = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export const emailsDelLead = (f: FilaMeta) =>
  (f.lead_emails ?? []).map((e) => correo(e.email)).filter(Boolean);
export const telefonosDelLead = (f: FilaMeta) =>
  (f.lead_telefonos ?? []).map((t) => t.phone ?? "").filter((t) => nueve(t).length >= 8);

// Con email o telefono en comun es la misma persona; con solo el nombre, no se
// puede asegurar.
export const coincidenciaSegura = (f: FilaMeta) => f.via === "email" || f.via === "telefono";

export function comparar(f: FilaMeta): Comparacion[] {
  if (!f.id_lead) return [];
  const filas: Comparacion[] = [];

  // Nombre: sin mayusculas ni tildes, "jose Gallardo" y "José Gallardo" son lo mismo.
  const nl = (f.lead_nombre ?? "").trim();
  filas.push({
    campo: "nombre",
    etiqueta: "Nombre",
    lead: nl,
    meta: f.nombre,
    estado: !nl ? "falta" : normaliza(nl) === normaliza(f.nombre) ? "igual" : "distinto",
    puedeCorregir: true,
    puedeAgregar: false,
  });

  if (f.email) {
    const mis = emailsDelLead(f);
    filas.push({
      campo: "email",
      etiqueta: "Email",
      lead: mis.join(", "),
      meta: f.email,
      estado: mis.includes(correo(f.email)) ? "igual" : mis.length === 0 ? "falta" : "distinto",
      puedeCorregir: true,
      puedeAgregar: true,
    });
  }

  const tels = telefonosDelLead(f);
  const t9 = tels.map(nueve);
  const telefono = (campo: "telefono" | "telefono2" | "whatsapp", etiqueta: string, valor: string | null) => {
    if (!valor || nueve(valor).length < 8) return;
    // Un segundo numero que coincide con el primero no se repite.
    if (campo !== "telefono" && nueve(valor) === nueve(f.telefono)) return;
    const esta = t9.includes(nueve(valor));
    filas.push({
      campo,
      etiqueta,
      lead: tels.join(", "),
      meta: valor,
      // Solo el telefono principal puede "corregir" al del lead; los demas se suman.
      estado: esta ? "igual" : tels.length === 0 || campo !== "telefono" ? "falta" : "distinto",
      puedeCorregir: campo === "telefono",
      puedeAgregar: true,
    });
  };
  telefono("telefono", "Telefono", f.telefono);
  telefono("telefono2", "Telefono secundario", f.telefono2);
  telefono("whatsapp", "WhatsApp", f.whatsapp);

  // Origen y campana solo se completan cuando el lead no los tiene, y solo con una
  // coincidencia segura.
  if (coincidenciaSegura(f)) {
    if (f.origen_meta) {
      const meta = `Meta ${f.origen_meta}`;
      filas.push({
        campo: "origen",
        etiqueta: "Origen",
        lead: f.lead_origen ?? "",
        meta,
        estado: f.lead_origen ? "igual" : "falta",
        puedeCorregir: false,
        puedeAgregar: true,
      });
    }
    if (f.formulario) {
      filas.push({
        campo: "campana",
        etiqueta: "Campana",
        lead: f.lead_campana ?? "",
        meta: f.formulario,
        estado: f.lead_campana ? "igual" : "falta",
        puedeCorregir: false,
        puedeAgregar: true,
      });
    }
  }
  return filas;
}

export function grupoDe(f: FilaMeta): Grupo {
  if (f.descartado) return "ignorado";
  if (!f.id_lead) return "nuevo";
  const c = comparar(f);
  if (c.some((x) => x.estado === "distinto")) return "diferencias";
  if (c.some((x) => x.estado === "falta")) return "faltantes";
  return "al_dia";
}

export const traeContacto = (f: FilaMeta) => Boolean(f.email || f.telefono || f.whatsapp || f.telefono2);

// Lo que hay que escribir en el lead para aplicar las acciones pedidas. Devuelve
// solo lo que cambia, en la forma que espera la base.
export function cambiosParaLead(
  f: FilaMeta,
  acciones: { campo: CampoMeta; modo: ModoMeta }[]
): { cambios: Record<string, unknown>; error?: string } {
  const cambios: Record<string, unknown> = {};
  let emails = (f.lead_emails ?? []).filter((e) => e.email);
  let telefonos = (f.lead_telefonos ?? []).filter((t) => t.phone);

  for (const { campo, modo } of acciones) {
    if (campo === "nombre") {
      cambios.nombre = f.nombre;
      cambios.apellido = "";
    } else if (campo === "email" && f.email) {
      const nuevo = correo(f.email);
      const resto = emails.filter((e) => correo(e.email) !== nuevo);
      emails =
        modo === "corregir"
          ? [{ email: nuevo }, ...resto.slice(1)]
          : [...emails.filter((e) => correo(e.email) !== nuevo), { email: nuevo }];
      cambios.emails = emails;
    } else if (campo === "telefono" || campo === "telefono2" || campo === "whatsapp") {
      const valor = campo === "telefono" ? f.telefono : campo === "telefono2" ? f.telefono2 : f.whatsapp;
      if (!valor) continue;
      const digitos = valor.replace(/\D/g, "");
      if (digitos.length < 8 || digitos.length > 15)
        return { cambios, error: `El telefono "${valor}" no parece valido.` };
      const resto = telefonos.filter((t) => nueve(t.phone) !== nueve(valor));
      const nuevo = { phone: valor, ...(campo === "whatsapp" ? { whatsapp: true } : {}) };
      telefonos = modo === "corregir" ? [nuevo, ...resto.slice(1)] : [...telefonos.filter((t) => nueve(t.phone) !== nueve(valor)), nuevo];
      cambios.telefonos = telefonos;
    } else if (campo === "origen" && f.origen_meta) {
      cambios.origen = `Meta ${f.origen_meta}`;
    } else if (campo === "campana" && f.formulario) {
      cambios.campana = f.formulario;
    }
  }
  return { cambios };
}

// --- Archivo CSV de Meta ----------------------------------------------------

// Lee un CSV con comillas, comas y saltos de linea dentro de un campo.
export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo);
      campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x !== "")) filas.push(fila);
  return filas;
}

export interface FilaArchivoMeta {
  fecha: string;
  nombre: string;
  email: string;
  origen: string;
  formulario: string;
  canal: string;
  etapa: string;
  propietario: string;
  etiquetas: string;
  telefono: string;
  telefono2: string;
  whatsapp: string;
}

const COLUMNAS: Record<string, keyof FilaArchivoMeta> = {
  "fecha de creacion": "fecha",
  nombre: "nombre",
  "correo electronico": "email",
  origen: "origen",
  formulario: "formulario",
  canal: "canal",
  etapa: "etapa",
  propietario: "propietario",
  etiquetas: "etiquetas",
  telefono: "telefono",
  "numero de telefono secundario": "telefono2",
  "numero de whatsapp": "whatsapp",
};

export function filasDeArchivoMeta(texto: string): FilaArchivoMeta[] | null {
  const tabla = parsearCsv(texto);
  if (tabla.length < 2) return null;
  const columnas = tabla[0].map((h) => COLUMNAS[normaliza(h)]);
  if (!columnas.includes("nombre")) return null;
  return tabla.slice(1).map((celdas) => {
    const f: FilaArchivoMeta = {
      fecha: "", nombre: "", email: "", origen: "", formulario: "", canal: "", etapa: "",
      propietario: "", etiquetas: "", telefono: "", telefono2: "", whatsapp: "",
    };
    columnas.forEach((k, i) => {
      if (k) f[k] = (celdas[i] ?? "").trim();
    });
    return f;
  });
}
