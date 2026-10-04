// Los filtros de la lista de leads, en un solo lugar: los usan la pantalla y el
// cambio masivo de propietario, que tiene que alcanzar exactamente los mismos
// leads que el usuario esta viendo.

export interface FiltroLeads {
  q: string;
  estado: string;
  dueno: string;
  linea: string;
}

interface Consulta {
  or(filtro: string): Consulta;
  eq(columna: string, valor: string): Consulta;
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
  if (f.dueno) c = c.eq("propietario_email", f.dueno);
  if (f.linea === "paneles" || f.linea === "casas") c = c.eq("linea", f.linea);
  return c as unknown as T;
}
