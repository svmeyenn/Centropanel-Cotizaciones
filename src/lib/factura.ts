// La estructura de una factura para los documentos de compra: detalle, subtotal --la suma de los subtotales de cada
// linea--, descuento, subtotal despues del descuento, impuesto (IVA en Chile, IGV en Peru) y total final a pagar.
// Los mismos redondeos que hace la base de datos en la orden de compra.

export interface Descuento {
  tipo: "pct" | "monto";
  valor: number;
}

export interface Totales {
  subtotal: number;
  descuento: number;
  subtotalNeto: number;
  iva: number;
  total: number;
}

// Pesos chilenos sin decimales; el resto, dos.
export function decimalesDe(moneda: string | null | undefined): number {
  return (moneda ?? "CLP").toUpperCase() === "CLP" ? 0 : 2;
}

export function redondear(n: number, dec: number): number {
  const f = 10 ** dec;
  return Math.round((n + Number.EPSILON) * f) / f;
}

// Subtotal de una linea, redondeado como se muestra.
export function subtotalLinea(cantidad: number, precio: number, moneda: string | null | undefined): number {
  return redondear(cantidad * precio, decimalesDe(moneda));
}

export function totalesFactura(subtotalLineas: number, descuento: Descuento, ivaPct: number, moneda: string | null | undefined): Totales {
  const dec = decimalesDe(moneda);
  const subtotal = redondear(subtotalLineas, dec);
  const valor = Math.max(0, Number(descuento.valor) || 0);
  const desc = descuento.tipo === "pct" ? redondear((subtotal * Math.min(valor, 100)) / 100, dec) : Math.min(redondear(valor, dec), subtotal);
  const subtotalNeto = subtotal - desc;
  const iva = redondear(subtotalNeto * ivaPct, dec);
  return { subtotal, descuento: desc, subtotalNeto, iva, total: subtotalNeto + iva };
}

// IVA en Chile, IGV en Peru (el mismo criterio de monedaDelPais).
export function impuestoDelPais(idPais: number | null | undefined): "IVA" | "IGV" {
  return idPais === 2 ? "IGV" : "IVA";
}

// "19%" o "18%", con los decimales que haga falta.
export function porcentajeImpuesto(ivaPct: number): string {
  return `${Math.round(ivaPct * 10000) / 100}%`;
}

// Como se rotula el descuento: "Descuento 10%" o "Descuento".
export function rotuloDescuento(d: Descuento): string {
  return d.tipo === "pct" && d.valor > 0 ? `Descuento ${Math.round(d.valor * 100) / 100}%` : "Descuento";
}
