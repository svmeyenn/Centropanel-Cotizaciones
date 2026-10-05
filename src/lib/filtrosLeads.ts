// Los filtros de la lista de leads, en un solo lugar: los usan la pantalla y el
// cambio masivo de propietario, que tiene que alcanzar exactamente los mismos
// leads que el usuario esta viendo.

import { CATALOGO_POR_DEFECTO, estadosParaFiltros } from "@/lib/catalogoEstados";

export interface FiltroLeads {
  q: string;
  estado: string;
  // Correo del propietario; varios separados por coma (una persona puede figurar
  // con mas de uno), o SIN_PROPIETARIO.
  dueno: string;
  linea: string;
  // Atajos que vienen del inicio: "sin_contactar" o "sin_seguimiento".
  gestion?: string;
  // Antiguedad: contra que fecha se mide y cuantos dias. Lo usa la depuracion.
  campo?: "creado" | "toque";
  dias?: number;
  // Leads en espera del cliente: no cuentan en los pendientes del inicio, y por
  // eso tampoco en estos atajos.
  enEspera?: number[];
}

export const SIN_PROPIETARIO = "__sin__";


// Lo que depende de los estados que se configuran: donde entra un lead nuevo y
// cuales cuentan como vivos. Quien llama lo saca del catalogo; sin el valen los
// de origen.
export interface EstadosParaFiltros {
  nuevo: string;
  enSeguimiento: string[];
}
const POR_DEFECTO: EstadosParaFiltros = estadosParaFiltros(CATALOGO_POR_DEFECTO);

export const GESTIONES: Record<string, string> = {
  sin_contactar: "Sin contactar",
  sin_seguimiento: "Sin seguimiento (vivos y sin nada comprometido)",
};

interface Consulta {
  or(filtro: string): Consulta;
  eq(columna: string, valor: string | boolean): Consulta;
  in(columna: string, valores: string[]): Consulta;
  is(columna: string, valor: null): Consulta;
  lt(columna: string, valor: string): Consulta;
  not(columna: string, operador: string, valor: string): Consulta;
}

export function aplicarFiltrosLeads<T>(consulta: T, f: FiltroLeads, estados: EstadosParaFiltros = POR_DEFECTO): T {
  let c = consulta as unknown as Consulta;
  // Los caracteres que usa el filtro para separar condiciones se sacan del
  // texto buscado: si no, "Perez, Juan" rompe la consulta.
  const busqueda = f.q.replace(/[,()%*]/g, " ").trim();
  if (busqueda) {
    const patron = `%${busqueda}%`;
    c = c.or(
      `nombre_completo.ilike.${patron},email.ilike.${patron},telefono.ilike.${patron},empresa.ilike.${patron},campana.ilike.${patron}`
    );
  }
  // Un lead con una cotizacion enviada ya es una oportunidad, diga lo que diga
  // el CRM: se filtra y se muestra por el estado efectivo.
  if (f.estado) c = c.eq("estado_efectivo", f.estado);
  if (f.dueno === SIN_PROPIETARIO) c = c.is("propietario_email", null);
  else if (f.dueno.includes(",")) c = c.in("propietario_email", f.dueno.split(",").filter(Boolean));
  else if (f.dueno) c = c.eq("propietario_email", f.dueno);
  if (f.gestion === "sin_contactar") c = c.eq("estado_efectivo", estados.nuevo);
  if (f.gestion === "sin_seguimiento")
    c = c.in("estado_efectivo", estados.enSeguimiento).eq("con_compromiso", false);
  if (f.gestion && f.enEspera && f.enEspera.length > 0)
    c = c.not("id_clientify", "in", `(${f.enEspera.join(",")})`);
  if (f.linea === "paneles" || f.linea === "casas") c = c.eq("linea", f.linea);

  // Antiguedad. "Creado" mira cuando entro el lead; "toque", cuando se le hizo
  // caso por ultima vez --y un lead que nunca se toco cuenta desde que entro--.
  if (f.dias && f.dias > 0) {
    const limite = new Date(Date.now() - f.dias * 86400000).toISOString();
    if (f.campo === "creado") c = c.lt("creado_clientify", limite);
    else c = c.or(`ultimo_toque.lt.${limite},and(ultimo_toque.is.null,creado_clientify.lt.${limite})`);
  }
  return c as unknown as T;
}
