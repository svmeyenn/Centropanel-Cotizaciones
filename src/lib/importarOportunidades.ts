// Leer la planilla de oportunidades que se descarga del CRM (.xlsx) y dejarla
// como filas de la base. Puro y sin acceso a la base: la pantalla lo usa para
// leer el archivo y la accion del servidor para decidir que se escribe.

export interface OportunidadImportada {
  id: number;
  nombre: string | null;
  monto: number;
  moneda: string;
  // 1 abierta, 2 vencida, 3 ganada, 4 perdida: los mismos numeros que ya usa la base.
  estado: number;
  etapa: string | null;
  proceso: string | null;
  probabilidad: number | null;
  id_contacto: number | null;
  propietario: string | null;
  creado: string | null;
  modificado: string | null;
  cierre_esperado: string | null;
  cierre_real: string | null;
  razon_perdida: string | null;
  razon_ganada: string | null;
  // Folios de cotizacion que vienen dentro del nombre ("Luis Canales - COT00119-20").
  cotizaciones: string[];
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s: unknown) =>
  sinTildes(String(s ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();

// El archivo dice el estado en castellano; la base lo guarda con el numero de
// siempre. "Vencida" no es un cierre: es una oportunidad abierta cuya fecha
// comprometida ya paso.
const ESTADOS: Record<string, number> = {
  abierta: 1,
  vencida: 2,
  ganada: 3,
  perdida: 4,
};

const texto = (x: unknown): string | null => {
  if (x == null) return null;
  const s = (x instanceof Date ? "" : String(x)).trim();
  return s && s !== "-----" ? s : null;
};

// La planilla trae las fechas en la hora de Chile, sin zona; la lectura las
// entrega como si fueran UTC. Se devuelve el instante real.
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

// Solo el dia, para las fechas de cierre: la hora no dice nada ahi.
const soloDia = (x: unknown): string | null => fechaIso(x)?.slice(0, 10) ?? null;

const numero = (x: unknown): number => {
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  const s = texto(x);
  if (!s) return 0;
  const n = Number(s.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// "30%" -> 30.
const porcentaje = (x: unknown): number | null => {
  const s = texto(x);
  if (!s) return null;
  const n = Number(s.replace("%", "").trim());
  return Number.isFinite(n) ? Math.round(n) : null;
};

// Los folios que el equipo escribe dentro del nombre de la oportunidad:
// "COT00119-20" son la 119 y la 120; "COT00114-5-7" son la 114, 115 y 117.
export function folios(nombre: string): string[] {
  const m = /COT[\s-]*0*(\d+)((?:\s*-\s*\d+)*)/i.exec(nombre ?? "");
  if (!m) return [];
  const base = Number(m[1]);
  const salida = [base];
  for (const trozo of (m[2] ?? "").split("-")) {
    const n = Number(trozo.trim());
    if (!Number.isFinite(n) || trozo.trim() === "") continue;
    // Un sufijo corto completa al folio base: 119-20 es 119 y 120, no 119 y 20.
    const largo = String(n).length;
    const completo = largo >= String(base).length ? n : Number(String(base).slice(0, -largo) + trozo.trim());
    if (Number.isFinite(completo) && completo > 0) salida.push(completo);
  }
  return [...new Set(salida)].map((n) => `COT${String(n).padStart(5, "0")}`);
}

// Las dos planillas que se descargan del CRM se abren con el mismo boton: esta
// se reconoce porque sus columnas hablan de importe y de etapa.
export function esPlanillaDeOportunidades(filas: unknown[][]): boolean {
  if (!filas || filas.length === 0) return false;
  const cab = filas[0].map(clave);
  return cab.includes("importe") && cab.includes("etapa");
}

export function oportunidadesDeHoja(filas: unknown[][]): {
  oportunidades: OportunidadImportada[];
  error?: string;
} {
  if (!filas || filas.length < 2) return { oportunidades: [], error: "El archivo no trae filas." };
  const cab = filas[0].map(clave);
  const col = (...nombres: string[]) => {
    for (const n of nombres) {
      const i = cab.indexOf(clave(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iId = col("id");
  const iEstado = col("estado");
  const iImporte = col("importe");
  if (iId < 0 || iEstado < 0 || iImporte < 0)
    return {
      oportunidades: [],
      error: "El archivo no parece una planilla de oportunidades: faltan las columnas ID, estado e importe.",
    };

  const iNombre = col("nombre");
  const iCreado = col("creado");
  const iProp = col("propietario");
  const iEsperada = col("fecha esperada de cierre");
  const iCierre = col("fecha de cierre");
  const iProceso = col("proceso de ventas");
  const iEtapa = col("etapa");
  const iProb = col("probabilidad");
  const iPerdida = col("razon de perdida");
  const iGanada = col("razon de oportunidad ganada");
  const iContacto = col("contact id");
  const iModificado = col("modificado");
  const iMoneda = col("moneda", "moneda de la cuenta");
  const celda = (f: unknown[], i: number) => (i >= 0 ? f[i] : null);

  const oportunidades: OportunidadImportada[] = [];
  for (const f of filas.slice(1)) {
    const id = Number(celda(f, iId));
    if (!Number.isInteger(id) || id <= 0) continue;

    const estado = ESTADOS[clave(celda(f, iEstado))];
    if (!estado) continue;

    const idContacto = Number(celda(f, iContacto));
    const nombre = texto(celda(f, iNombre));

    oportunidades.push({
      id,
      nombre,
      monto: numero(celda(f, iImporte)),
      moneda: (texto(celda(f, iMoneda)) ?? "CLP").toUpperCase(),
      estado,
      etapa: texto(celda(f, iEtapa)),
      proceso: texto(celda(f, iProceso)),
      probabilidad: porcentaje(celda(f, iProb)),
      id_contacto: Number.isInteger(idContacto) && idContacto > 0 ? idContacto : null,
      propietario: texto(celda(f, iProp)),
      creado: fechaIso(celda(f, iCreado)),
      modificado: fechaIso(celda(f, iModificado)),
      cierre_esperado: soloDia(celda(f, iEsperada)),
      cierre_real: soloDia(celda(f, iCierre)),
      razon_perdida: texto(celda(f, iPerdida)),
      razon_ganada: texto(celda(f, iGanada)),
      cotizaciones: nombre ? folios(nombre) : [],
    });
  }
  return { oportunidades };
}
