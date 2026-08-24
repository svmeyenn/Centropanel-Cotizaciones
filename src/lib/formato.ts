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
