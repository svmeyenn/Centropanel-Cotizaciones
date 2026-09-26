import "server-only";
import ExcelJS from "exceljs";
import { createHash } from "crypto";

// Lector de cartolas bancarias.
//
// Cada banco exporta lo suyo: unos traen una columna Monto con signo, otros
// Cargo y Abono por separado, y el encabezado casi nunca esta en la primera
// fila. En vez de exigir un formato, se busca la fila que parece encabezado y
// se reconocen las columnas por sus nombres habituales.

export type FilaBanco = {
  fecha: string;
  descripcion: string | null;
  documento: string | null;
  cargo: number;
  abono: number;
  huella: string;
};

const SINONIMOS = {
  fecha: [
    "fecha",
    "fecha transaccion",
    "fecha movimiento",
    "fecha operacion",
    "fecha contable",
  ],
  descripcion: [
    "descripcion",
    "detalle",
    "glosa",
    "concepto",
    "movimiento",
    "operacion",
  ],
  documento: [
    "documento",
    "n documento",
    "nro documento",
    "num documento",
    "numero documento",
    "referencia",
    "n operacion",
  ],
  cargo: ["cargo", "cargos", "debito", "debitos", "giro", "giros", "cheques o cargos"],
  abono: ["abono", "abonos", "credito", "creditos", "deposito", "depositos"],
  monto: ["monto", "importe", "valor"],
};

// Sin tildes, sin signos y en minusculas: asi "N° Documento" y "Nro.
// documento" caen en el mismo casillero.
const normalizar = (v: unknown) =>
  (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function columna(encabezado: string[], nombres: string[]) {
  const i = encabezado.findIndex((c) => nombres.includes(c));
  return i >= 0 ? i : null;
}

// Fechas de banco: 31/12/2026, 31-12-2026, 2026-12-31, o una fecha de verdad
// cuando el archivo es Excel.
function comoFecha(valor: unknown): string | null {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const u = new Date(
      Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate())
    );
    return u.toISOString().slice(0, 10);
  }

  const s = (valor ?? "").toString().trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const local = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (local) {
    const anio = local[3].length === 2 ? `20${local[3]}` : local[3];
    return `${anio}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }

  return null;
}

// Puntuacion de aca: el punto separa los miles y la coma los decimales.
function comoMonto(valor: unknown): number {
  if (typeof valor === "number") return valor;
  const texto = (valor ?? "").toString().trim();
  const n = Number(texto.replace(/[()\s$]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  // Los parentesis son la forma contable de escribir un negativo.
  return /\(.+\)/.test(texto) ? -n : n;
}

function separador(texto: string) {
  const linea = texto.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const candidatos = [";", "\t", ","] as const;
  return candidatos.reduce((mejor, c) =>
    linea.split(c).length > linea.split(mejor).length ? c : mejor
  );
}

// Parte una linea de CSV respetando las comillas.
function partir(linea: string, sep: string) {
  const celdas: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else entreComillas = !entreComillas;
    } else if (c === sep && !entreComillas) {
      celdas.push(actual);
      actual = "";
    } else actual += c;
  }
  celdas.push(actual);
  return celdas;
}

async function celdas(archivo: File): Promise<unknown[][]> {
  const nombre = archivo.name.toLowerCase();

  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    const texto = Buffer.from(await archivo.arrayBuffer()).toString("utf8");
    const sep = separador(texto);
    return texto
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => partir(l, sep));
  }

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = libro.worksheets[0];
  if (!hoja) return [];

  const filas: unknown[][] = [];
  hoja.eachRow((fila) => {
    const valores: unknown[] = [];
    fila.eachCell({ includeEmpty: true }, (celda, n) => {
      const v = celda.value;
      // Las formulas traen su resultado dentro; los enlaces, el texto.
      valores[n - 1] =
        v && typeof v === "object" && "result" in v
          ? (v as { result: unknown }).result
          : v && typeof v === "object" && "text" in v
            ? (v as { text: unknown }).text
            : v;
    });
    filas.push(valores);
  });
  return filas;
}

export async function leerArchivoCartola(
  archivo: File
): Promise<{ ok: true; filas: FilaBanco[] } | { ok: false; mensaje: string }> {
  let bruto: unknown[][];
  try {
    bruto = await celdas(archivo);
  } catch {
    return { ok: false, mensaje: "No se pudo abrir el archivo. Debe ser CSV o Excel." };
  }

  if (bruto.length === 0) return { ok: false, mensaje: "El archivo esta vacio." };

  // El encabezado es la primera fila que nombra una fecha y algun monto.
  const iEncabezado = bruto.findIndex((fila) => {
    const n = fila.map(normalizar);
    return (
      n.some((c) => SINONIMOS.fecha.includes(c)) &&
      n.some((c) =>
        [...SINONIMOS.cargo, ...SINONIMOS.abono, ...SINONIMOS.monto].includes(c)
      )
    );
  });

  if (iEncabezado < 0)
    return {
      ok: false,
      mensaje:
        "No encontre las columnas. El archivo tiene que traer una fila con Fecha y con Cargo/Abono o Monto.",
    };

  const encabezado = bruto[iEncabezado].map(normalizar);
  const iFecha = columna(encabezado, SINONIMOS.fecha)!;
  const iDescripcion = columna(encabezado, SINONIMOS.descripcion);
  const iDocumento = columna(encabezado, SINONIMOS.documento);
  const iCargo = columna(encabezado, SINONIMOS.cargo);
  const iAbono = columna(encabezado, SINONIMOS.abono);
  const iMonto = columna(encabezado, SINONIMOS.monto);

  const filas: FilaBanco[] = [];
  const vistas = new Map<string, number>();

  for (const fila of bruto.slice(iEncabezado + 1)) {
    const fecha = comoFecha(fila[iFecha]);
    if (!fecha) continue;

    let cargo = 0;
    let abono = 0;

    if (iCargo !== null || iAbono !== null) {
      cargo = Math.abs(iCargo === null ? 0 : comoMonto(fila[iCargo]));
      abono = Math.abs(iAbono === null ? 0 : comoMonto(fila[iAbono]));
    } else if (iMonto !== null) {
      const monto = comoMonto(fila[iMonto]);
      if (monto < 0) cargo = Math.abs(monto);
      else abono = monto;
    }

    // Una linea sin plata (saldos, totales, separadores) no es un movimiento.
    if (cargo === 0 && abono === 0) continue;
    if (cargo > 0 && abono > 0) continue;

    const descripcion =
      iDescripcion === null
        ? null
        : (fila[iDescripcion] ?? "").toString().trim() || null;
    const documento =
      iDocumento === null ? null : (fila[iDocumento] ?? "").toString().trim() || null;

    // La huella identifica la linea para no cargar dos veces la misma cartola.
    // Si el banco trae la misma transaccion repetida el mismo dia, el contador
    // las distingue en vez de descartar la segunda.
    const base = `${fecha}|${cargo}|${abono}|${normalizar(descripcion)}|${normalizar(documento)}`;
    const repeticion = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, repeticion);

    filas.push({
      fecha,
      descripcion: descripcion?.slice(0, 200) ?? null,
      documento: documento?.slice(0, 50) ?? null,
      cargo,
      abono,
      huella: createHash("md5").update(`${base}#${repeticion}`).digest("hex"),
    });
  }

  if (filas.length === 0)
    return {
      ok: false,
      mensaje: "No encontre movimientos con fecha y monto en el archivo.",
    };

  return { ok: true, filas };
}
