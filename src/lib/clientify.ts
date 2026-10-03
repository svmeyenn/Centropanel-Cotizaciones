// Lectura de los contactos de Clientify. Es la unica pieza que habla con su
// API: el resto del sistema trabaja con la copia que queda en la base.
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
}

type Crudo = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const texto = (x: unknown): string | null => {
  const s = typeof x === "string" ? x.trim() : "";
  return s ? s : null;
};

// Clientify responde con pequenas variaciones segun el punto de la API
// (nombre de la empresa suelto o dentro de un objeto, el responsable como
// correo o como nombre). Aqui se normaliza a una sola forma.
export function mapearContacto(c: Crudo): ContactoClientify {
  const emails: Crudo[] = Array.isArray(c.emails) ? c.emails : [];
  const telefonos: Crudo[] = Array.isArray(c.phones) ? c.phones : [];
  const responsable = texto(c.owner);
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

// Recorre todos los contactos, pagina por pagina, y entrega cada pagina ya
// normalizada. Se entrega de a una para no tener los 6.000 en memoria.
export async function* contactosClientify(): AsyncGenerator<ContactoClientify[]> {
  let url: string | null = `${BASE}/contacts/?page_size=100`;
  while (url) {
    const pagina = await pedir(url);
    const filas: Crudo[] = Array.isArray(pagina.results) ? pagina.results : [];
    yield filas.filter((f) => f?.id != null).map(mapearContacto);
    url = typeof pagina.next === "string" && pagina.next ? pagina.next : null;
  }
}
