import { createClient } from "@/lib/supabase/server";

export interface LineaFlujo {
  codigo: string;
  actividad: string;
  nombre: string;
  cobros: number;
  pagos: number;
  movimientos: number;
}

export interface PartidaProyectada {
  fuente: string;
  sentido: "Cobro" | "Pago";
  // 0 = vencido, 1..13 = semana, 14 = sin fecha, 15 = despues de las 13 semanas
  semana: number;
  monto: number;
  documentos: number;
}

export interface MovimientoFlujo {
  id_mov: number;
  fecha: string;
  tipo: "Ingreso" | "Egreso";
  monto: number;
  origen_destino: string | null;
  categoria: string | null;
  concepto_flujo: string | null;
  concepto_categoria: string | null;
}

// Estado de flujos de efectivo, metodo directo, de un mercado: el efectivo con
// que se partio, lo cobrado y pagado por concepto, y el efectivo con que se cierra.
export async function cargarFlujoEfectivo(desde: string, hasta: string, idPais: number) {
  const supabase = await createClient();
  // Fin del dia hasta: el cierre es el efectivo al inicio del dia siguiente.
  const siguiente = new Date(`${hasta}T00:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  const [lineas, inicial, final] = await Promise.all([
    supabase.rpc("fin_flujo_efectivo", { p_desde: desde, p_hasta: hasta, p_pais: idPais }),
    supabase.rpc("fin_efectivo_al", { p_fecha: desde, p_pais: idPais }),
    supabase.rpc("fin_efectivo_al", { p_fecha: siguiente.toISOString().slice(0, 10), p_pais: idPais }),
  ]);
  const error = lineas.error ?? inicial.error ?? final.error;
  return {
    error: error?.message ?? null,
    lineas: ((lineas.data ?? []) as LineaFlujo[]).map((l) => ({
      ...l,
      cobros: Number(l.cobros),
      pagos: Number(l.pagos),
      movimientos: Number(l.movimientos),
    })),
    inicial: Number(inicial.data ?? 0),
    final: Number(final.data ?? 0),
  };
}

export async function cargarFlujoProyectado(idPais: number, desde: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fin_flujo_proyectado", {
    p_pais: idPais,
    p_desde: desde,
  });
  return {
    error: error?.message ?? null,
    partidas: ((data ?? []) as PartidaProyectada[]).map((p) => ({
      ...p,
      semana: Number(p.semana),
      monto: Number(p.monto),
      documentos: Number(p.documentos),
    })),
  };
}

// Los movimientos pagados del periodo, para reclasificar el concepto de flujo.
export async function cargarMovimientosFlujo(desde: string, hasta: string, idPais: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("movimientos")
    .select(
      "id_mov, fecha, fecha_pago, tipo, monto, origen_destino, concepto_flujo, categorias(nombre, concepto_flujo)"
    )
    .eq("id_pais", idPais)
    .eq("estado_pago", "Pagado")
    // Misma fecha que usa el estado: la de pago, y la del movimiento si no tiene.
    .or(
      `and(fecha_pago.gte.${desde},fecha_pago.lte.${hasta}),and(fecha_pago.is.null,fecha.gte.${desde},fecha.lte.${hasta})`
    )
    .order("fecha", { ascending: false })
    .limit(300);
  return ((data ?? []) as unknown as {
    id_mov: number;
    fecha: string;
    tipo: "Ingreso" | "Egreso";
    monto: number;
    origen_destino: string | null;
    concepto_flujo: string | null;
    categorias: { nombre: string; concepto_flujo: string | null } | null;
  }[]).map(
    (m): MovimientoFlujo => ({
      id_mov: m.id_mov,
      fecha: m.fecha,
      tipo: m.tipo,
      monto: Number(m.monto),
      origen_destino: m.origen_destino,
      categoria: m.categorias?.nombre ?? null,
      concepto_flujo: m.concepto_flujo,
      concepto_categoria: m.categorias?.concepto_flujo ?? null,
    })
  );
}
