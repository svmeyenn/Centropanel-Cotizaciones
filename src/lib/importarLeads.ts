// Leer la planilla de contactos que se descarga del CRM (.xlsx) y dejarla como
// leads. Puro y sin acceso a la base: la pantalla lo usa para leer el archivo y la
// accion del servidor para decidir que se escribe.

export interface LeadImportado {
  id: number;
  nombre: string | null;
  apellido: string | null;
  empresa: string | null;
  cargo: string | null;
  propietario: string | null;
  estado: string | null;
  origen: string | null;
  creado: string | null;
  ultimo_contacto: string | null;
  etiquetas: string[];
  observaciones: string | null;
  emails: string[];
  telefonos: string[];
  direccion: string | null;
  ciudad: string | null;
  region: string | null;
  pais: string | null;
  campos: { field: string; value: string }[];
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s: unknown) =>
  sinTildes(String(s ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();

// El archivo trae los estados en castellano; la base los guarda con el nombre de
// siempre.
const ESTADOS: Record<string, string> = {
  contactado: "warm-lead",
  "no contactado": "cold-lead",
  otro: "other",
  "lead perdido": "lost-lead",
  "en oportunidad": "in-deal",
  "lead no calificado": "not-qualified-lead",
  cliente: "client",
  "lead caliente no usar": "hot-lead",
  "lead caliente": "hot-lead",
  "cliente perdido": "lost-client",
  visitante: "visitor",
};

// De donde llego el contacto: el archivo usa los nombres internos del canal.
const ORIGENES: Record<string, string> = {
  inbox_whatsapp: "WhatsApp",
  webform: "Formulario",
  "regular-bots": "Chatbot",
  chatbot: "Chatbot",
  import: "Importado",
  manual: "Manual",
  meetings: "Reunion",
};

// Los campos propios del negocio que el archivo trae como columnas sueltas.
const CAMPOS_PROPIOS = [
  "Tipo de Servicio",
  "Lugar de Construcción",
  "Cuando Construye",
  "Utm-Medium",
  "Fbclid",
  "Campaign-Id",
  "Ad-Id",
  "Utm-Id",
  "Utm-Content",
  "Utm-Term",
  "Utm-Campaign",
  "Gclid",
  "Gbraid",
  "Public",
  "Gad-Campaignid",
  "Utm-Source",
  "Brid",
];

const texto = (x: unknown): string | null => {
  if (x == null) return null;
  const s = (x instanceof Date ? "" : String(x)).trim();
  return s && s !== "-----" ? s : null;
};

// Un formulario sin elegir trae "Seleccione una opcion", y a veces un "Si" o un
// "No" de otra pregunta: no son datos.
const dato = (x: unknown): string | null => {
  const s = texto(x);
  return s && !/^seleccione/i.test(s) && !/^(s[ií]|no)$/i.test(s) ? s : null;
};

// La planilla trae las fechas en la hora de Chile, sin zona; la lectura las entrega
// como si fueran UTC. Se devuelve el instante real.
function deSantiago(d: Date): string {
  const comoUtc = d.getTime();
  let t = comoUtc;
  for (let i = 0; i < 2; i++) {
    const pared = new Date(t).toLocaleString("sv-SE", { timeZone: "America/Santiago" });
    t += comoUtc - Date.parse(pared.replace(" ", "T") + "Z");
  }
  return new Date(t).toISOString();
}

const fechaIso = (x: unknown): string | null => {
  if (x instanceof Date && !Number.isNaN(x.getTime())) return deSantiago(x);
  const s = texto(x);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// Telefono con su codigo de pais. Los hay escritos de todas formas: "+56912345678",
// "56912345678", "912345678", "12345678". Si no se sabe de que pais es, un celular de
// nueve digitos que empieza con 9 es chileno, salvo que el lead traiga señas de Peru.
export function normalizaTelefono(bruto: string, esPeru: boolean): string | null {
  const t = bruto.trim();
  if (!t) return null;
  const d = t.replace(/\D/g, "");
  if (d.length < 8) return null;
  if (t.startsWith("+") || t.startsWith("00")) return "+" + d.replace(/^00/, "");
  if (d.length === 11 && (d.startsWith("56") || d.startsWith("51"))) return "+" + d;
  if (d.length === 9 && d.startsWith("9")) return (esPeru ? "+51" : "+56") + d;
  if (d.length === 8 && !esPeru) return "+569" + d;
  return t;
}

const REGIONES_PERU = new Set([
  "amazonas", "ancash", "apurimac", "arequipa", "ayacucho", "cajamarca", "callao", "cusco", "cuzco",
  "huancavelica", "huanuco", "ica", "junin", "la libertad", "lambayeque", "lima", "loreto",
  "madre de dios", "moquegua", "pasco", "piura", "puno", "san martin", "tacna", "tumbes", "ucayali",
]);

export function leadsDeHoja(filas: unknown[][]): { leads: LeadImportado[]; error?: string } {
  if (!filas || filas.length < 2) return { leads: [], error: "El archivo no trae filas." };
  const cab = filas[0].map(clave);
  const col = (...nombres: string[]) => {
    for (const n of nombres) {
      const i = cab.indexOf(clave(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iId = col("id");
  if (iId < 0 || col("estado") < 0 || col("creado") < 0)
    return { leads: [], error: "El archivo no parece una planilla de contactos: faltan las columnas ID, estado y creado." };

  const iNombre = col("nombre");
  const iApellido = col("apellidos", "apellido");
  const iEmpresa = col("empresa");
  const iCargo = col("cargo");
  const iProp = col("propietario");
  const iEstado = col("estado");
  const iOrigen = col("origen contacto");
  const iCreado = col("creado");
  const iUltimo = col("ultimo contacto");
  const iObs = col("observaciones");
  const iEtiq = col("etiquetas");
  const iCalle = col("calle 1");
  const iCiudad = col("ciudad 1");
  const iProvincia = col("provincia/estado 1");
  const iPais = col("pais 1", "pais");
  const iCorreos = [col("correo electronico 1"), col("correo electronico 2"), col("correo electronico 3")];
  const iOtrosCorreos = col("otros correos electronicos");
  const iTels = [col("telefono 1"), col("telefono 2"), col("telefono 3")];
  const iOtrosTels = col("otros telefonos");
  const propios = CAMPOS_PROPIOS.map((n) => ({ nombre: n, i: col(n) })).filter((c) => c.i >= 0);
  const celda = (f: unknown[], i: number) => (i >= 0 ? f[i] : null);

  const leads: LeadImportado[] = [];
  for (const f of filas.slice(1)) {
    const id = Number(celda(f, iId));
    if (!Number.isInteger(id) || id <= 0) continue;

    const etiquetas = (texto(celda(f, iEtiq)) ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const campos = propios
      .map((c) => ({ field: c.nombre, value: dato(f[c.i]) }))
      .filter((c): c is { field: string; value: string } => c.value != null);
    const lugar = campos.find((c) => c.field === "Lugar de Construcción")?.value ?? null;
    const region = dato(celda(f, iProvincia)) ?? lugar;
    const paisTexto = dato(celda(f, iPais));

    // Señas de que el lead es de Peru, para completar bien un telefono sin codigo.
    const esPeru =
      /^(pe|peru|perú)$/i.test(paisTexto ?? "") ||
      etiquetas.some((e) => /(^|[^a-z])per[uú]([^a-z]|$)|centropanel\.pe/i.test(e)) ||
      REGIONES_PERU.has(clave(region ?? ""));

    const correos = [
      ...iCorreos.map((i) => texto(celda(f, i))),
      ...(texto(celda(f, iOtrosCorreos)) ?? "").split(/[,;\s]+/),
    ]
      .map((x) => (x ?? "").trim().toLowerCase())
      .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));

    const telefonos = [
      ...iTels.map((i) => texto(celda(f, i))),
      ...(texto(celda(f, iOtrosTels)) ?? "").split(/[,;]+/),
    ]
      .map((x) => normalizaTelefono(x ?? "", esPeru))
      .filter((x): x is string => x != null);

    const estadoTxt = clave(celda(f, iEstado));
    const origenBruto = texto(celda(f, iOrigen));

    leads.push({
      id,
      nombre: texto(celda(f, iNombre)),
      apellido: texto(celda(f, iApellido)),
      empresa: texto(celda(f, iEmpresa)),
      cargo: texto(celda(f, iCargo)),
      propietario: texto(celda(f, iProp)),
      estado: ESTADOS[estadoTxt] ?? null,
      origen: origenBruto ? (ORIGENES[origenBruto.toLowerCase()] ?? origenBruto) : null,
      creado: fechaIso(celda(f, iCreado)),
      ultimo_contacto: fechaIso(celda(f, iUltimo)),
      etiquetas,
      observaciones: texto(celda(f, iObs)),
      emails: [...new Set(correos)],
      telefonos: [...new Set(telefonos)],
      direccion: texto(celda(f, iCalle)),
      ciudad: dato(celda(f, iCiudad)),
      region,
      pais: paisTexto,
      campos,
    });
  }
  return { leads };
}
