// Formateo en convencion chilena: separador de miles con punto y sin decimales
// en pesos, que es como salen los montos en el informe de Access.
export function pesos(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

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

export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
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
export function conComision(total: number, comisionPct: number): number {
  if (!comisionPct || comisionPct <= 0 || comisionPct >= 100) return total;
  return Math.round(total / (1 - comisionPct / 100));
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
