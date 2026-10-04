// Lo que devuelven inicio_gestion() y panel_leads(). La base arma los numeros
// --y decide que puede ver cada perfil--; estas pantallas solo los dibujan.

export type TipoAgenda = "lead" | "cotizacion" | "entrega";

export type ItemAgenda = {
  tipo: TipoAgenda;
  id: number;
  fecha: string;
  accion: string;
  comentario: string | null;
  sujeto: string;
  detalle: string | null;
  id_ref: number;
  id_pais: number;
  id_responsable: number | null;
  responsable: string | null;
};

export type LeadEnBandeja = {
  id_clientify: number;
  nombre_completo: string | null;
  creado_clientify: string | null;
  origen?: string | null;
  campana?: string | null;
  linea: string | null;
  propietario: string | null;
  id_pais: number;
  estado_efectivo?: string;
  ultimo_toque?: string | null;
};

export type EstadoEnJuego = {
  estado: string;
  n: number;
  montos: Record<string, number>;
  dias_promedio: number;
  dias_maximo: number;
};

export type CotizacionSinAccion = {
  id: number;
  num_cotizacion: string | null;
  estado: string;
  fecha: string;
  dias: number;
  total: number;
  moneda: string;
  cliente: string | null;
  vendedor: string | null;
  id_pais: number;
};

export type Gestion = {
  hoy: string;
  lunes: string;
  quien: number | null;
  jefe: boolean;
  mis_emails: string[];
  agenda: ItemAgenda[];
  conteos: { atrasado: number; hoy: number; semana: number; proxima: number };
  sin_contactar: { n: number; n7: number; lista: LeadEnBandeja[] };
  sin_seguimiento: { n: number; lista: LeadEnBandeja[] };
  sin_propietario: number | null;
  cotizaciones: {
    embudo: EstadoEnJuego[];
    sin_accion_n: number;
    sin_accion_montos: Record<string, number>;
    sin_accion: CotizacionSinAccion[];
  };
};

export type FilaEquipoLeads = {
  propietario: string;
  asignados: number;
  nuevos_mes: number;
  sin_contactar: number;
  contactados: number;
  oportunidades: number;
  perdidos: number;
  sin_seguimiento: number;
  compromisos_vencidos: number;
};

export type CumplimientoFila = {
  id_vendedor: number;
  vendedor: string;
  comprometidas: number;
  a_tiempo: number;
  tarde: number;
  caducadas: number;
  pendientes: number;
};

export type PanelLeadsDatos = {
  mes: string;
  // La cartera que se mira: el mes elegido y los dos anteriores, nada mas atras.
  desde: string;
  hasta: string;
  kpi: {
    total: number;
    nuevos_mes: number;
    nuevos_ant: number;
    cohorte_oportunidad: number;
    sin_contactar: number;
    sin_contactar_7d: number;
    sin_seguimiento: number;
    compromisos_vencidos: number;
  };
  embudo: Record<string, number>;
  linea: Record<string, number>;
  semanas: { semana: string; por_origen: Record<string, number>; total: number }[];
  semanas_desde: string;
  origenes_top: string[];
  equipo: FilaEquipoLeads[];
  // Por que se cierra una oportunidad, segun lo que anota el CRM. Del periodo.
  razones_perdida: { razon: string; n: number; monto: number }[];
  razones_ganada: { razon: string; n: number; monto: number }[];
  origenes: { origen: string; n: number; oportunidades: number }[];
  cumplimiento: CumplimientoFila[];
};

// Fechas como texto AAAA-MM-DD, sin pasar por la zona horaria del navegador:
// un "2026-10-06" no puede convertirse en el 5 por estar en otro huso.
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  const f = (s: string) => {
    const [a, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((f(hasta) - f(desde)) / 86400000);
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function diaSemana(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

export function diaCorto(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

// "ago a oct 2026": el periodo de tres meses que mira el desempeno de leads.
export function periodo(desde: string, hasta: string): string {
  const [a1, m1] = desde.slice(0, 10).split("-").map(Number);
  const [a2, m2] = hasta.slice(0, 10).split("-").map(Number);
  const uno = `${MESES[m1 - 1]}${a1 === a2 ? "" : ` ${a1}`}`;
  return `${uno} a ${MESES[m2 - 1]} ${a2}`;
}

// "hace 3 dias", "hoy", "en 2 dias": se entiende sin contar en el calendario.
export function plazo(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "en 1 dia";
  if (dias === -1) return "hace 1 dia";
  return dias > 0 ? `en ${dias} dias` : `hace ${-dias} dias`;
}

export function antiguedad(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "1 dia";
  if (dias < 14) return `${dias} dias`;
  if (dias < 60) return `${Math.round(dias / 7)} semanas`;
  return `${Math.round(dias / 30)} meses`;
}
