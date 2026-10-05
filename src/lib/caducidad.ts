import type { FiltroLeads } from "@/lib/filtrosLeads";

// Cuando un lead deja de ser un lead. Las reglas son siempre las mismas --que
// estado se mira y contra que fecha--, pero el plazo de cada una es un parametro
// por pais: cada mercado trabaja a su ritmo. Cero o vacio significa que esa
// regla no se aplica.
//
// La misma definicion la usan la pantalla de depuracion, que cuenta, y la lista
// de leads, que muestra: asi las dos nunca dicen cosas distintas.

export type ClaveCaducidad =
  | "LeadCaducaNoContactado"
  | "LeadCaducaContactado"
  | "LeadCaducaCaliente"
  | "LeadCaducaOportunidad";

export interface ReglaCaducidad {
  clave: ClaveCaducidad;
  estado: string;
  titulo: string;
  // Contra que fecha se mide: cuando entro, o cuando se le hizo caso por ultima vez.
  campo: "creado" | "toque";
  explicacion: string;
  // Lo que se propone hacer con ese grupo, y el estado al que se lleva.
  // Lo que se hace con el grupo; el estado de destino se nombra aparte, con su
  // nombre vigente.
  verbo: string;
  destino: string;
  dias: number;
}

export const REGLAS: Omit<ReglaCaducidad, "dias">[] = [
  {
    clave: "LeadCaducaNoContactado",
    estado: "cold-lead",
    titulo: "No contactados que nunca contestaron",
    campo: "creado",
    explicacion: "Entraron hace mas de {dias} dias y nunca se logro hablar con ellos.",
    verbo: "Pasarlos a",
    destino: "not-qualified-lead",
  },
  {
    clave: "LeadCaducaContactado",
    estado: "warm-lead",
    titulo: "Contactados que se enfriaron",
    campo: "toque",
    explicacion: "Se les hablo alguna vez, pero no hay ninguna actividad hace mas de {dias} dias.",
    verbo: "Pasarlos a",
    destino: "lost-lead",
  },
  {
    clave: "LeadCaducaCaliente",
    estado: "hot-lead",
    titulo: "Calientes que ya no lo son",
    campo: "toque",
    explicacion: "Marcados como calientes y sin actividad hace mas de {dias} dias.",
    verbo: "Bajarlos a",
    destino: "warm-lead",
  },
  {
    clave: "LeadCaducaOportunidad",
    estado: "in-deal",
    titulo: "Oportunidades detenidas",
    campo: "toque",
    explicacion:
      "Son los de mas valor: conviene mirarlos uno a uno antes de cerrarlos. Sin actividad hace mas de {dias} dias.",
    verbo: "Revisar uno a uno",
    destino: "",
  },
];

export const DIAS_POR_DEFECTO: Record<ClaveCaducidad, number> = {
  LeadCaducaNoContactado: 90,
  LeadCaducaContactado: 180,
  LeadCaducaCaliente: 60,
  LeadCaducaOportunidad: 180,
};

// El filtro de la lista que deja ver exactamente ese grupo.
export function filtroDeRegla(r: Pick<ReglaCaducidad, "estado" | "campo">, dias: number): FiltroLeads {
  return { q: "", estado: r.estado, dueno: "", linea: "", campo: r.campo, dias };
}

export function enlaceDeRegla(r: Pick<ReglaCaducidad, "estado" | "campo">, dias: number): string {
  return `/leads?${new URLSearchParams({ estado: r.estado, campo: r.campo, dias: String(dias) })}`;
}

export const textoRegla = (plantilla: string, dias: number) =>
  plantilla.replace("{dias}", String(dias));
