import "server-only";
import { celdas, normalizar } from "@/lib/finanzas/cartola-banco";
import { leerMontoLibre } from "@/lib/formato";

// Lector de la lista de precios de un proveedor. Igual que con la cartola, no se
// exige un formato: se busca la fila que parece encabezado y se reconocen las
// columnas por sus nombres habituales. El costo se empareja con la maestra por el
// SKU de Centropanel o, si no hay, por el codigo del proveedor.

const SINONIMOS = {
  sku: ["sku", "sku centropanel", "codigo centropanel", "cod centropanel"],
  codigo: ["codigo", "cod", "codigo proveedor", "cod proveedor", "codigo del proveedor", "codigo prov", "referencia"],
  costo: [
    "costo",
    "costo unitario",
    "costo nuevo",
    "nuevo costo",
    "precio",
    "precio unitario",
    "precio lista",
    "precio neto",
    "valor",
    "valor unitario",
  ],
};

export type FilaLista = { sku: string | null; codigo: string | null; costo: number; fila: number };

export type ListaLeida =
  | { ok: true; filas: FilaLista[] }
  | { ok: false; mensaje: string };

const clave = (v: unknown) => (v ?? "").toString().trim().toUpperCase();

export async function leerListaPrecios(archivo: File): Promise<ListaLeida> {
  let bruto: unknown[][];
  try {
    bruto = await celdas(archivo);
  } catch {
    return { ok: false, mensaje: "No se pudo abrir el archivo. Tiene que ser .xlsx, .csv o .txt." };
  }

  // El encabezado es la primera fila con una columna de costo y una de identificacion.
  let cabecera = -1;
  let iSku: number | null = null;
  let iCodigo: number | null = null;
  let iCosto: number | null = null;
  for (let r = 0; r < Math.min(bruto.length, 30); r++) {
    const enc = (bruto[r] ?? []).map(normalizar);
    const buscar = (nombres: string[]) => {
      const i = enc.findIndex((c) => nombres.includes(c));
      return i >= 0 ? i : null;
    };
    const costo = buscar(SINONIMOS.costo);
    const sku = buscar(SINONIMOS.sku);
    const codigo = buscar(SINONIMOS.codigo);
    if (costo !== null && (sku !== null || codigo !== null)) {
      cabecera = r;
      iCosto = costo;
      iSku = sku;
      iCodigo = codigo;
      break;
    }
  }
  if (cabecera < 0 || iCosto === null)
    return {
      ok: false,
      mensaje:
        'No encontre las columnas. El archivo necesita una columna "SKU" o "Codigo" (el del proveedor) y una columna "Costo" o "Precio".',
    };

  const filas: FilaLista[] = [];
  for (let r = cabecera + 1; r < bruto.length; r++) {
    const f = bruto[r] ?? [];
    const crudo = f[iCosto];
    if (crudo === null || crudo === undefined || crudo.toString().trim() === "") continue;
    const costo = typeof crudo === "number" ? crudo : leerMontoLibre(crudo.toString().replace(/[$\s]/g, ""));
    if (!Number.isFinite(costo) || costo < 0) continue;
    const sku = iSku !== null ? clave(f[iSku]) : "";
    const codigo = iCodigo !== null ? clave(f[iCodigo]) : "";
    if (!sku && !codigo) continue;
    filas.push({ sku: sku || null, codigo: codigo || null, costo, fila: r + 1 });
  }
  if (filas.length === 0) return { ok: false, mensaje: "El archivo no trae ninguna fila con costo." };
  return { ok: true, filas };
}
