import { ALCANCE_CONTACTOS, correoConfigurado, tokenPara } from "@/lib/gmail";

// Guarda el contacto de un lead en Contactos de Google de la persona que le escribe --el correo
// de Centropanel con que entra--. Esa libreta es la que se sincroniza con el telefono, y de ahi la
// toma WhatsApp: el contacto aparece con su nombre y no como un numero suelto.
//
// Usa la misma cuenta de servicio con delegacion de dominio que el envio de correos --variables
// GOOGLE_SA_EMAIL y GOOGLE_SA_KEY--, autorizada ademas para el permiso `contacts`. Sin ella no hace
// nada: `contactosConfigurado` lo dice.
export const contactosConfigurado = correoConfigurado;

const API = "https://people.googleapis.com/v1";
const GRUPO = "Cliente";

type Persona = { names?: { displayName?: string }[]; phoneNumbers?: { value?: string; canonicalForm?: string }[] };

async function llamar<T>(token: string, ruta: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      r.status === 403
        ? "Google no deja escribir contactos: falta autorizar el permiso de contactos para la cuenta de servicio, o activar la API People."
        : (j.error?.message ?? `Google respondio ${r.status}`)
    );
  }
  return j as T;
}

const soloDigitos = (s: string) => s.replace(/\D/g, "");

// La etiqueta "Cliente": si ya existe en la libreta se usa, y si no se crea.
async function grupoLeads(token: string): Promise<string | null> {
  try {
    const lista = await llamar<{ contactGroups?: { resourceName: string; name: string; groupType?: string }[] }>(token, "/contactGroups?pageSize=200");
    const ya = lista.contactGroups?.find((g) => g.name === GRUPO && g.groupType === "USER_CONTACT_GROUP");
    if (ya) return ya.resourceName;
    const nuevo = await llamar<{ resourceName: string }>(token, "/contactGroups", {
      method: "POST",
      body: JSON.stringify({ contactGroup: { name: GRUPO } }),
    });
    return nuevo.resourceName;
  } catch {
    return null; // sin etiqueta el contacto se guarda igual
  }
}

// ¿Ya esta ese telefono en la libreta? Se compara por los ultimos 9 digitos, que es lo que no
// cambia entre "+56 9 1234 5678", "9 1234 5678" y "56912345678".
async function yaExiste(token: string, telefono: string): Promise<boolean> {
  const digitos = soloDigitos(telefono);
  const clave = digitos.slice(-9);
  // Google pide una primera busqueda vacia para preparar el indice de busqueda.
  await llamar(token, "/people:searchContacts?query=&readMask=names").catch(() => null);
  const r = await llamar<{ results?: { person?: Persona }[] }>(
    token,
    `/people:searchContacts?query=${encodeURIComponent(clave)}&readMask=names,phoneNumbers&pageSize=10`
  );
  return (r.results ?? []).some((x) =>
    (x.person?.phoneNumbers ?? []).some((t) => soloDigitos(t.canonicalForm ?? t.value ?? "").endsWith(clave))
  );
}

// "creado" si lo guardo; "existia" si ese telefono ya estaba en la libreta.
export async function guardarContacto(o: {
  de: string;
  nombre: string;
  telefono: string;
  email?: string | null;
  empresa?: string | null;
  nota?: string;
}): Promise<"creado" | "existia"> {
  const token = await tokenPara(o.de, ALCANCE_CONTACTOS);
  if (await yaExiste(token, o.telefono)) return "existia";

  const partes = o.nombre.trim().split(/\s+/).filter(Boolean);
  const grupo = await grupoLeads(token);
  await llamar(token, "/people:createContact?personFields=names,phoneNumbers", {
    method: "POST",
    body: JSON.stringify({
      names: [{ givenName: partes[0] ?? o.telefono, familyName: partes.slice(1).join(" ") || undefined }],
      phoneNumbers: [{ value: o.telefono.startsWith("+") ? o.telefono : `+${soloDigitos(o.telefono)}`, type: "mobile" }],
      emailAddresses: o.email ? [{ value: o.email, type: "work" }] : undefined,
      organizations: o.empresa ? [{ name: o.empresa }] : undefined,
      biographies: o.nota ? [{ value: o.nota, contentType: "TEXT_PLAIN" }] : undefined,
      memberships: grupo ? [{ contactGroupMembership: { contactGroupResourceName: grupo } }] : undefined,
    }),
  });
  return "creado";
}
