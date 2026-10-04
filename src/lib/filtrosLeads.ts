// Los filtros de la lista de leads, en un solo lugar: los usan la pantalla y el
// cambio masivo de propietario, que tiene que alcanzar exactamente los mismos
// leads que el usuario esta viendo.

export interface FiltroLeads {
  q: string;
  estado: string;
  // Correo del propietario; varios separados por coma (una persona puede figurar
  // con mas de uno), o SIN_PROPIETARIO.
  dueno: string;
  linea: string;
  // Atajos que vienen del inicio: "sin_contactar" o "sin_seguimiento".
  gestion?: string;
}

export const SIN_PROPIETARIO = "__sin__";

// Lo que un lead vivo puede estar esperando: si no tiene nada comprometido por
// delante, nadie lo esta siguiendo.
export const ESTADOS_EN_SEGUIMIENTO = ["warm-lead", "hot-lead", "in-deal"];

export const GESTIONES: Record<string, string> = {
  sin_contactar: "Sin contactar",
  sin_seguimiento: "Sin seguimiento (vivos y sin nada comprometido)",
};

interface Consulta {
  or(filtro: string): Consulta;
  eq(columna: string, valor: string | boolean): Consulta;
  in(columna: string, valores: string[]): Consulta;
  is(columna: string, valor: null): Consulta;
}

export function aplicarFiltrosLeads<T>(consulta: T, f: FiltroLeads): T {
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
  if (f.gestion === "sin_contactar") c = c.eq("estado_efectivo", "cold-lead");
  if (f.gestion === "sin_seguimiento")
    c = c.in("estado_efectivo", ESTADOS_EN_SEGUIMIENTO).eq("con_compromiso", false);
  if (f.linea === "paneles" || f.linea === "casas") c = c.eq("linea", f.linea);
  return c as unknown as T;
}
