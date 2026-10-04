// Formateo en convencion chilena: separador de miles con punto y sin decimales
// en pesos, que es como salen los montos en el informe de Access.
//
// Con la moneda --"CLP", "PEN"-- cada monto sale con los decimales y la
// puntuacion de la suya: el peso sin decimales y a la chilena, el sol con dos y a
// la peruana. Sin moneda es el de siempre.
export function pesos(
  n: number | string | null | undefined,
  moneda?: string | null
): string {
  const v = Number(n ?? 0);
  if (moneda == null) return v.toLocaleString("es-CL", { maximumFractionDigits: 0 });
  const m = MONEDAS[moneda.toUpperCase()] ?? MONEDAS.CLP;
  return v.toLocaleString(m.locale, {
    minimumFractionDigits: m.decimales,
    maximumFractionDigits: m.decimales,
  });
}

// Un importe de un documento: el peso chileno como siempre --sin simbolo--, y las
// demas monedas con el suyo, para que un documento en soles no se lea como pesos.
export function importe(n: number | string | null | undefined, moneda?: string | null): string {
  const m = (moneda ?? "CLP").toUpperCase();
  return m === "CLP" ? pesos(n, "CLP") : dinero(n, m);
}

// Cuantos decimales lleva cada moneda, y redondear a ellos. La base de datos
// redondea igual (decimales_pais), y las dos cuentas tienen que dar lo mismo.
export function decimalesDe(moneda?: string | null): number {
  return (MONEDAS[(moneda ?? "CLP").toUpperCase()] ?? MONEDAS.CLP).decimales;
}

export function redondea(n: number, moneda?: string | null): number {
  const f = 10 ** decimalesDe(moneda);
  return Math.round((n + Number.EPSILON) * f) / f;
}

// Moneda de cada pais cuando el dato no la trae (1 Chile, 2 Peru).
export const monedaDelPais = (idPais: number | null | undefined) => (idPais === 2 ? "PEN" : "CLP");

// Cantidades: enteras cuando corresponde, con decimales solo si los tiene.
// Replica el IIf([Unidades]=Int([Unidades]),...) del informe.
export function unidades(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isInteger(v)
    ? v.toLocaleString("es-CL")
    : v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

// Precio de venta a publico: el neto con IVA incluido. Se redondea a peso,
// igual que el IVA del documento, para que lo que se ve sumado en pantalla
// cuadre con el total de la cotizacion.
export function conIva(
  neto: number | string | null | undefined,
  iva: number
): number {
  return Math.round(Number(neto ?? 0) * (1 + iva));
}

export function porcentaje(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

// Las fechas de cotizacion son DATE puros ("2026-08-24"). Construirlos con
// new Date(s) los interpreta como UTC y en Chile (UTC-3/-4) retrocede un dia,
// asi que se parsea a mano.
export function fecha(s: string | null | undefined): string {
  if (!s) return "";
  const [a, m, d] = s.slice(0, 10).split("-");
  return `${d}-${m}-${a}`;
}

// El dia de hoy, AAAA-MM-DD, en la hora de Chile. Sin fijar la zona, el servidor
// (que corre en UTC) cambia de dia a las nueve de la noche de Chile y las fechas
// que se proponen por omision salen con la de manana. La base de datos cuenta
// los dias igual (America/Santiago).
export function hoyISO(zona = "America/Santiago"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Fecha de vencimiento = fecha + validez, en dias corridos.
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  const mes = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mes}-${dia}`;
}

// Primer nombre en formato titulo: de "LUIS HERNAN ROMERO" -> "Luis".
// Equivalente a PrimerNombre() en modCotizacion.bas.
export function primerNombre(nombre: string | null | undefined): string {
  let s = (nombre ?? "").trim();
  if (!s) return "";
  const coma = s.indexOf(",");
  if (coma > 0) s = s.slice(coma + 1).trim();
  const esp = s.indexOf(" ");
  if (esp > 0) s = s.slice(0, esp);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Recargo por comision del medio de pago: el total se divide por
// (1 - comision) para que el neto llegue completo. Con 1 %, cobrar 1.000
// significa facturar 1.010.
export function conComision(total: number, comisionPct: number, moneda?: string | null): number {
  if (!comisionPct || comisionPct <= 0 || comisionPct >= 100) return total;
  return redondea(total / (1 - comisionPct / 100), moneda);
}

// --- identificadores y telefonos -------------------------------------------

// RUT chileno con puntos y guion: 123456789 -> 12.345.678-9. Se formatea al
// mostrarlo y al salir del campo; en la base se guarda como se escribio.
export function rut(v: string | null | undefined): string {
  const limpio = (v ?? "").replace(/[^0-9kK]/g, "").toUpperCase();
  if (limpio.length < 2) return limpio;
  const dv = limpio.slice(-1);
  const cuerpo = limpio.slice(0, -1).replace(/^0+/, "");
  if (!cuerpo) return limpio;
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

// El telefono se muestra como +56 123 456 789: codigo de pais aparte y el
// resto en grupos de tres. Sin codigo de area no sirve para llamar desde otro
// pais, que es justo lo que empieza a pasar con Peru.
export function telefono(v: string | null | undefined): string {
  const bruto = (v ?? "").trim();
  if (!bruto) return "";
  const digitos = bruto.replace(/[^\d+]/g, "");
  if (!digitos.startsWith("+")) return bruto;

  // Los codigos que usamos son de dos digitos (+56 Chile, +51 Peru).
  const cod = digitos.slice(1, 3);
  const resto = digitos.slice(3);
  const grupos = resto.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `+${cod} ${grupos}`.trim();
}

// Un telefono sirve solo si trae el codigo de area: +56 y al menos ocho
// digitos mas.
export function telefonoValido(v: string | null | undefined): boolean {
  const d = (v ?? "").replace(/[^\d+]/g, "");
  return /^\+\d{2}\d{8,12}$/.test(d);
}

// Busqueda por telefono. En las fichas el mismo numero aparece escrito de
// todas las formas posibles --"9 7525 1426", "952043453", "+56936631583"--,
// asi que comparar el texto no sirve: se comparan solo los digitos.
//
// El codigo de pais se prueba en las dos direcciones, porque muchas fichas
// antiguas lo guardan sin el: buscando +56 9 5204 3453 tiene que aparecer el
// que quedo grabado como 952043453, y al reves.
export function coincideTelefono(
  guardado: string | null | undefined,
  buscado: string
): boolean {
  const soloDigitos = (s: string | null | undefined) =>
    (s ?? "").replace(/\D/g, "");
  const g = soloDigitos(guardado);
  const b = soloDigitos(buscado);
  if (!g || !b) return false;
  const sinCodigo = b.replace(/^(?:56|51)/, "");
  return g.includes(b) || (sinCodigo !== b && g.includes(sinCodigo));
}

// Un monto en su moneda. Cada moneda se escribe como la lee quien la usa:
// pesos y UF a la chilena (1.234,56), soles y dolares a la peruana (1,234.56),
// con los decimales que le corresponden --el peso no tiene, la UF y el sol dos--.
const MONEDAS: Record<string, { prefijo: string; decimales: number; locale: string }> = {
  CLP: { prefijo: "$", decimales: 0, locale: "es-CL" },
  UF: { prefijo: "UF ", decimales: 2, locale: "es-CL" },
  PEN: { prefijo: "S/ ", decimales: 2, locale: "es-PE" },
  USD: { prefijo: "US$ ", decimales: 2, locale: "es-PE" },
};

export function dinero(n: number | string | null | undefined, moneda: string | null | undefined): string {
  const m = MONEDAS[(moneda ?? "CLP").toUpperCase()] ?? MONEDAS.CLP;
  const v = Number(n ?? 0);
  return (
    m.prefijo +
    v.toLocaleString(m.locale, {
      minimumFractionDigits: m.decimales,
      maximumFractionDigits: m.decimales,
    })
  );
}

// La suma de una lista de montos que pueden ser de monedas distintas: no se suman
// pesos con soles, cada moneda va con su total. Con una sola se escribe como
// siempre; con varias, cada una con su simbolo para que no se confundan.
export function resumenMontos(pares: [string, number][]): string {
  const por = new Map<string, number>();
  for (const [m, v] of pares) por.set(m, (por.get(m) ?? 0) + v);
  if (por.size === 0) return pesos(0, "CLP");
  const varias = por.size > 1;
  return [...por.entries()].map(([m, v]) => (varias ? dinero(v, m) : importe(v, m))).join(" · ");
}

// Un monto escrito a mano. En pesos y UF el punto separa los miles y la coma los
// decimales; en soles y dolares es al reves. Leer "20.55" a la chilena daria
// 2.055: cien veces mas.
export function leerMonto(texto: string, moneda?: string | null): number {
  const t = (texto ?? "").trim();
  if (!t) return NaN;
  const m = (moneda ?? "CLP").toUpperCase();
  const limpio = m === "PEN" || m === "USD" ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  return Number(limpio);
}

// Una suma de montos con sus decimales ya redondeados: evita 37.050000000000004.
export const limpia = (n: number) => Math.round(n * 1e6) / 1e6;

// Un monto de finanzas con centimos solo si los tiene: un movimiento en pesos es
// siempre entero y sale como siempre; uno en soles muestra sus dos decimales.
export function pesosConCentimos(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Un monto escrito a mano sin saber la moneda. Con los dos signos manda el ultimo
// ("1,234.50" y "1.234,50" son 1234,5); con uno solo, es decimal si aparece una
// vez y lo siguen uno o dos digitos ("45.50", "45,5"), y de miles si no ("1.234",
// "1.234.567"). Un importe de dinero no lleva tres decimales.
export function leerMontoLibre(texto: string): number {
  const t = (texto ?? "").trim().replace(/\s/g, "");
  if (!t) return 0;
  const punto = t.lastIndexOf(".");
  const coma = t.lastIndexOf(",");
  let dec = -1;
  if (punto >= 0 && coma >= 0) dec = Math.max(punto, coma);
  else {
    const i = Math.max(punto, coma);
    if (i >= 0) {
      const veces = t.split(t[i]).length - 1;
      const detras = t.length - i - 1;
      if (veces === 1 && detras >= 1 && detras <= 2) dec = i;
    }
  }
  const entero = (dec >= 0 ? t.slice(0, dec) : t).replace(/[.,]/g, "");
  return Number(dec >= 0 ? entero + "." + t.slice(dec + 1) : entero);
}
