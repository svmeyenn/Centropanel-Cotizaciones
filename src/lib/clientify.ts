// Los contactos de Clientify llegan por dos caminos y los dos terminan en la
// misma forma: por su API --si hay clave, que es de pago aparte-- o desde un
// archivo con la lista que se sube a la pantalla.
//
// La clave se carga en Vercel como CLIENTIFY_API_KEY; nunca viaja al navegador
// porque esto solo corre en el servidor. La direccion de la API es la de la
// cuenta de Centro Panel y se puede cambiar con CLIENTIFY_API_URL.

const BASE = (process.env.CLIENTIFY_API_URL ?? "https://api-plus.clientify.com/api/v1").replace(/\/$/, "");

export const hayClaveClientify = () => Boolean(process.env.CLIENTIFY_API_KEY);

export interface ContactoClientify {
  id_clientify: number;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  emails: unknown[];
  telefono: string | null;
  telefonos: unknown[];
  estado: string | null;
  propietario_email: string | null;
  propietario: string | null;
  id_empresa_clientify: number | null;
  empresa: string | null;
  cargo: string | null;
  etiquetas: string[];
  estado_marketing: number | null;
  creado_clientify: string | null;
  ultimo_contacto: string | null;
  observaciones: string | null;
  campos_personalizados: unknown[];
  origen: string | null;
  modificado_clientify: string | null;
  comuna: string | null;
  region: string | null;
  direccion: string | null;
  ciudad: string | null;
  pais: string | null;
}

type Crudo = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const texto = (x: unknown): string | null => {
  const s = typeof x === "string" ? x.trim() : "";
  return s ? s : null;
};

// Los formularios traen un "Seleccione una Region" cuando la persona no eligio, y
// a veces un "Si" o un "No" que respondia otra pregunta: eso no es un dato.
const dato = (x: unknown): string | null => {
  const s = texto(x);
  return s && !/^seleccione/i.test(s) && !/^(s[ií]|no)$/i.test(s) ? s : null;
};

// Clientify responde con pequenas variaciones segun el punto de la API
// (nombre de la empresa suelto o dentro de un objeto, el responsable como
// correo o como nombre). Aqui se normaliza a una sola forma.
export function mapearContacto(c: Crudo): ContactoClientify {
  const emails: Crudo[] = Array.isArray(c.emails) ? c.emails : [];
  const telefonos: Crudo[] = Array.isArray(c.phones) ? c.phones : [];
  const responsable = texto(c.owner);
  const direccion: Crudo | null = Array.isArray(c.addresses) ? (c.addresses[0] ?? null) : null;
  const campoLugar: Crudo | undefined = (Array.isArray(c.custom_fields) ? c.custom_fields : []).find(
    (f: Crudo) => /^lugar de construcc/i.test(String(f?.field ?? ""))
  );
  const detalleEmpresa: Crudo | null =
    c.company_detail && typeof c.company_detail === "object" ? c.company_detail : null;

  return {
    id_clientify: Number(c.id),
    nombre: texto(c.first_name),
    apellido: texto(c.last_name),
    email: texto(emails[0]?.email),
    emails,
    telefono: texto(telefonos[0]?.phone),
    telefonos,
    estado: texto(c.status),
    propietario_email: responsable?.includes("@") ? responsable : null,
    propietario:
      texto(c.owner_name) ?? (responsable && !responsable.includes("@") ? responsable : null),
    id_empresa_clientify: Number(c.company_id ?? detalleEmpresa?.id) || null,
    empresa:
      texto(c.company_name) ??
      (typeof c.company === "string" ? texto(c.company) : null) ??
      texto(detalleEmpresa?.name),
    cargo: texto(c.title),
    etiquetas: (Array.isArray(c.tags) ? c.tags : [])
      .map((t: unknown) => (typeof t === "string" ? t : texto((t as Crudo)?.name)))
      .filter((t: string | null): t is string => Boolean(t)),
    estado_marketing: Number.isFinite(Number(c.marketing_status))
      ? Number(c.marketing_status)
      : null,
    creado_clientify: texto(c.created),
    ultimo_contacto: texto(c.last_contact),
    observaciones: texto(c.remarks) ?? texto(c.description),
    campos_personalizados: Array.isArray(c.custom_fields) ? c.custom_fields : [],
    origen: texto(c.contact_source),
    modificado_clientify: texto(c.modified),
    // Clientify guarda una sola "ciudad" por direccion; en Chile es la comuna.
    comuna: dato(direccion?.city),
    region: dato(direccion?.state) ?? dato(campoLugar?.value),
    direccion: texto(direccion?.street),
    ciudad: dato(direccion?.city),
    pais: dato(direccion?.country),
  };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pedir(url: string): Promise<Crudo> {
  let ultimoError = "";
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch(url, {
      headers: {
        Authorization: `Token ${process.env.CLIENTIFY_API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    }).catch((e: Error) => e);

    if (r instanceof Error) {
      ultimoError = r.message;
    } else if (r.ok) {
      return r.json();
    } else if (r.status === 401 || r.status === 403) {
      throw new Error("Clientify rechazo la clave (CLIENTIFY_API_KEY). Revise que sea la vigente.");
    } else if (r.status === 429 || r.status >= 500) {
      ultimoError = `Clientify respondio ${r.status}`;
    } else {
      throw new Error(`Clientify respondio ${r.status} al pedir los contactos.`);
    }
    await esperar(1500 * (intento + 1));
  }
  throw new Error(`No se pudo leer Clientify: ${ultimoError}`);
}

// Recorre todos los contactos, pagina por pagina, tal como llegan: quien los
// guarda los normaliza con mapearContacto, igual que cuando vienen de un
// archivo. Se entrega de a una pagina para no tener los 6.000 en memoria.
export async function* contactosClientify(): AsyncGenerator<Crudo[]> {
  let url: string | null = `${BASE}/contacts/?page_size=100`;
  while (url) {
    const pagina = await pedir(url);
    const filas: Crudo[] = Array.isArray(pagina.results) ? pagina.results : [];
    yield filas.filter((f) => f?.id != null);
    url = typeof pagina.next === "string" && pagina.next ? pagina.next : null;
  }
}

// --- Oportunidades -------------------------------------------------------

export interface OportunidadClientify {
  id_clientify: number;
  nombre: string | null;
  monto: number | null;
  moneda: string | null;
  estado: number | null;
  id_etapa: number | null;
  id_pipeline: number | null;
  probabilidad: number | null;
  id_contacto: number | null;
  id_empresa: number | null;
  propietario_email: string | null;
  creado_clientify: string | null;
  modificado_clientify: string | null;
  cierre_esperado: string | null;
  cierre_real: string | null;
  cotizaciones: string[];
}

// Las etapas de los dos embudos de Centro Panel, por su numero en Clientify.
export const ETAPAS: Record<number, string> = {
  394303: "Contacto realizado",
  394304: "Cotizacion enviada",
  394305: "Negociacion",
  370167: "Presentacion de presupuesto",
  370166: "Reunion consultiva",
  370168: "Ajuste o negociacion",
};

export const ESTADOS_OPORTUNIDAD: Record<number, string> = {
  1: "Abierta",
  2: "Vencida",
  3: "Ganada",
  4: "Perdida",
};

const idDeUrl = (x: unknown, recurso: string): number | null => {
  const m = typeof x === "string" ? x.match(new RegExp("/" + recurso + "/(\\d+)")) : null;
  return m ? Number(m[1]) : null;
};

// Los folios que nombra una oportunidad. El equipo los escribe como "COT00118",
// y cuando una oportunidad agrupa varias, como "COT00114-5-7": los numeros
// cortos reemplazan los ultimos digitos del primero (114, 115 y 117).
export function foliosEnNombre(nombre: string): string[] {
  const folios = new Set<string>();
  const re = /COT\s*(\d+)((?:\s*-\s*\d+)*)/gi;
  for (const m of nombre.matchAll(re)) {
    const base = m[1];
    folios.add(`COT${base.padStart(5, "0")}`);
    for (const suf of (m[2].match(/\d+/g) ?? [])) {
      folios.add(`COT${(base.slice(0, Math.max(0, base.length - suf.length)) + suf).padStart(5, "0")}`);
    }
  }
  return [...folios];
}

export function mapearOportunidad(d: Crudo): OportunidadClientify {
  const monto = Number(d.amount);
  const nombre = texto(d.name);
  return {
    id_clientify: Number(d.id),
    nombre,
    monto: Number.isFinite(monto) ? monto : null,
    moneda: texto(d.currency),
    estado: Number.isFinite(Number(d.status)) ? Number(d.status) : null,
    id_etapa: idDeUrl(d.pipeline_stage, "stages"),
    id_pipeline: idDeUrl(d.pipeline, "pipelines"),
    probabilidad: Number.isFinite(Number(d.probability)) ? Number(d.probability) : null,
    id_contacto: idDeUrl(d.contact, "contacts"),
    id_empresa: idDeUrl(d.company, "companies"),
    propietario_email: texto(d.owner),
    creado_clientify: texto(d.created),
    modificado_clientify: texto(d.modified),
    cierre_esperado: texto(d.expected_closed_date),
    cierre_real: texto(d.actual_closed_date),
    cotizaciones: nombre ? foliosEnNombre(nombre) : [],
  };
}

// --- Conversacion --------------------------------------------------------

export interface ActividadClientify {
  id: number;
  id_contacto: number;
  tipo: string;
  fecha: string;
  autor: string | null;
  titulo: string | null;
  texto: string | null;
}

const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "a", eacute: "e", iacute: "i", oacute: "o", uacute: "u",
  Aacute: "A", Eacute: "E", Iacute: "I", Oacute: "O", Uacute: "U",
  ntilde: "n", Ntilde: "N", uuml: "u", iexcl: "!", iquest: "?",
};

// Las notas llegan en HTML. Se guardan como texto con saltos de linea.
export function textoPlano(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, e) => ENTIDADES[e] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Un registro del muro de un contacto. Solo interesan los que son conversacion:
// notas, llamadas, correos y reuniones.
const TIPOS_CONVERSACION = /^(note|call|meeting|email|mail|sms|whatsapp)/i;

export function mapearActividad(e: Crudo, idContacto: number): ActividadClientify | null {
  const tipo = texto(e.type);
  if (!tipo || !TIPOS_CONVERSACION.test(tipo) || !texto(e.created)) return null;
  const x: Crudo = e.extra && typeof e.extra === "object" ? e.extra : {};
  const cuerpo = x.note_comment ?? x.comment ?? x.body ?? x.description ?? x.subject ?? "";
  return {
    id: Number(e.id),
    id_contacto: idContacto,
    tipo,
    fecha: String(e.created),
    autor: texto(e.user),
    titulo: texto(x.note_name) ?? texto(x.title) ?? texto(x.subject),
    texto: textoPlano(String(cuerpo)) || null,
  };
}
