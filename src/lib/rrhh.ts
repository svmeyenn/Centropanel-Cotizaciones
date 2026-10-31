import type { Vendedor } from "@/types/database";
import { puedeEn, type Nivel } from "@/lib/permisos";

// Recursos humanos: constantes y ayudas que comparten el servidor y el cliente.
// Los calculos legales viven en la base (rrhh_calcular); aqui solo se nombran las cosas.

export const RELACIONES = ["Contrato", "Honorarios"] as const;
export const CLASES = ["Administrativo", "Obra"] as const;
export const ESTADOS_PERSONAL = ["Activo", "Suspendido", "Desvinculado"] as const;
export const TIPOS_CONTRATO = ["Indefinido", "Plazo fijo", "Por obra o faena", "Part time", "Honorarios"] as const;
export const GRATIFICACIONES = ["Ninguna", "Legal", "Garantizada"] as const;
export const TIPOS_ANTICIPO = ["Anticipo de sueldo", "Prestamo", "Descuento"] as const;
export const TIPOS_CUENTA = ["Cuenta corriente", "Cuenta vista", "Cuenta RUT", "Cuenta de ahorro"] as const;
export const MEDIOS_PAGO = ["Transferencia", "Cheque", "Efectivo"] as const;

// Quien puede hacer que en RRHH: la misma regla que aplica la base (rrhh_ver/operar/aprobar/admin).
// El Super administrador entra siempre; el resto necesita el nivel en el area.
export function nivelRRHH(v: Vendedor, minimo: Nivel): boolean {
  return v.id_perfil === 1 || puedeEn(v, "rrhh", minimo);
}

// Primer dia del mes: asi se guarda el periodo de una liquidacion.
export const primerDiaDelMes = (iso: string) => `${iso.slice(0, 7)}-01`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function nombrePeriodo(iso: string): string {
  const [a, m] = iso.slice(0, 10).split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
}

// Folio legible de la liquidacion: LIQ-0001 para sueldo, HON-0001 para honorarios.
export function folioLiquidacion(tipo: string, id: number): string {
  return `${tipo === "Honorarios" ? "HON" : "LIQ"}-${String(id).padStart(4, "0")}`;
}

export const COLOR_ESTADO_LIQ: Record<string, string> = {
  Borrador: "bg-gray-100 text-gray-700",
  Aprobada: "bg-amber-100 text-amber-800",
  Pagada: "bg-green-100 text-green-800",
  Anulada: "bg-red-100 text-red-700",
};

// Parametros que deben cargarse a mano cada periodo o cuando cambian: la aplicacion no los inventa.
export const PARAMETROS_MANUALES: Record<number, { codigo: string; texto: string; unidad: string }[]> = {
  1: [
    { codigo: "UF", texto: "Valor de la UF", unidad: "CLP" },
    { codigo: "UTM", texto: "Valor de la UTM", unidad: "CLP" },
    { codigo: "IMM", texto: "Ingreso minimo mensual", unidad: "CLP" },
    { codigo: "TOPE_AFP_UF", texto: "Tope imponible AFP/salud", unidad: "UF" },
    { codigo: "TOPE_AFC_UF", texto: "Tope imponible seguro de cesantia", unidad: "UF" },
    { codigo: "SIS", texto: "Tasa del seguro de invalidez (empleador)", unidad: "%" },
    { codigo: "AFP_COMISION", texto: "Comision de cada AFP (una por institucion)", unidad: "%" },
  ],
  2: [
    { codigo: "UIT", texto: "Valor de la UIT", unidad: "PEN" },
    { codigo: "AFP_COMISION", texto: "Comision de cada AFP (una por institucion)", unidad: "%" },
    { codigo: "AFP_PRIMA", texto: "Prima de seguro de cada AFP (opcional)", unidad: "%" },
    { codigo: "AFP_TOPE_PRIMA", texto: "Tope de la prima de seguro (opcional)", unidad: "PEN" },
  ],
};
