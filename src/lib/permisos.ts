import type { Vendedor } from "@/types/database";

// Un permiso es area x nivel. El perfil es la plantilla de la que parte cada
// persona; despues se ajusta caso a caso. Va aparte de sesion.ts porque lo usan
// tambien los componentes de cliente, y ahi no puede viajar codigo de servidor.
export const AREAS = [
  { k: "comercial", t: "Comercial" },
  { k: "operaciones", t: "Operaciones" },
  { k: "compras", t: "Compras" },
  { k: "catalogo", t: "Catalogo" },
  { k: "tesoreria", t: "Tesoreria" },
  { k: "contabilidad", t: "Contabilidad" },
  { k: "administracion", t: "Administracion" },
  { k: "rrhh", t: "Recursos humanos" },
] as const;

export type Area = (typeof AREAS)[number]["k"];

// Cada nivel incluye al anterior.
export const NIVELES = ["ninguno", "ver", "operar", "aprobar", "administrar"] as const;
export type Nivel = (typeof NIVELES)[number];

export const TEXTO_NIVEL: Record<Nivel, string> = {
  ninguno: "Sin acceso",
  ver: "Ver",
  operar: "Operar",
  aprobar: "Aprobar",
  administrar: "Administrar",
};

// Las casillas de finanzas siguen mandando sobre cada pantalla de plata: el
// nivel de Tesoreria abre la puerta, la casilla dice a que pantalla.
export const CASILLAS_FIN = [
  ["fin_ver_ingresos", "Ver ingresos"],
  ["fin_ver_egresos", "Ver egresos"],
  ["fin_ver_cartola", "Ver cartola y conciliar"],
  ["fin_ver_informes", "Ver informes"],
  ["fin_editar", "Editar movimientos"],
  ["fin_mantenedores", "Mantenedores de finanzas"],
  ["fin_solicitar_gastos", "Solicitar gastos"],
  ["fin_pagar_gastos", "Pagar gastos"],
  ["fin_rendir_gastos", "Rendir gastos"],
  ["fin_ver_todo", "Ver los movimientos de todos"],
] as const;

export const PERFIL_SUPER = 1;

const ORDEN: Record<string, number> = Object.fromEntries(NIVELES.map((n, i) => [n, i]));

export function nivelEn(v: Pick<Vendedor, "permisos">, area: Area): Nivel {
  const n = v.permisos?.[area];
  return n && n in ORDEN ? (n as Nivel) : "ninguno";
}

// Estricto: sin permisos definidos no hay nivel.
export function puedeEn(v: Pick<Vendedor, "permisos">, area: Area, minimo: Nivel): boolean {
  return v.permisos != null && ORDEN[nivelEn(v, area)] >= ORDEN[minimo];
}

// Para el menu: quien aun no tiene permisos definidos queda como estaba.
export function alcanzaArea(v: Pick<Vendedor, "permisos">, area: Area, minimo: Nivel = "ver"): boolean {
  return v.permisos == null || puedeEn(v, area, minimo);
}

export function esSuperAdmin(v: Pick<Vendedor, "id_perfil">): boolean {
  return v.id_perfil === PERFIL_SUPER;
}
