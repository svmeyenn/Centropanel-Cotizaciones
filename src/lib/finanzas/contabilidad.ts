import { createClient } from "@/lib/supabase/server";

export interface CuentaPlan {
  codigo: string;
  nombre: string;
  clase: number;
  naturaleza: "Deudora" | "Acreedora";
}

export interface FilaResultado {
  codigo: string;
  nombre: string;
  unidad: string; // OBR, VTA, ADM o SIN (sin centro de costo)
  monto: number;
}

export interface FilaBalance {
  codigo: string;
  nombre: string;
  clase: number;
  saldo: number; // debe - haber
}

export const UNIDADES = ["OBR", "VTA", "ADM", "SIN"] as const;
export type Unidad = (typeof UNIDADES)[number];

export const NOMBRE_UNIDAD: Record<Unidad, string> = {
  OBR: "Obras",
  VTA: "Venta de productos",
  ADM: "Administración central",
  SIN: "Sin centro de costo",
};

export const fmt = (n: number) =>
  Math.round(n) === 0 ? "—" : Math.round(n).toLocaleString("es-CL").replace("-", "−");

export const fecha = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}-${m}-${a}`;
};

export async function cargarPlan(): Promise<CuentaPlan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_cuentas")
    .select("codigo, nombre, clase, naturaleza")
    .order("orden");
  return (data ?? []) as CuentaPlan[];
}

export async function cargarEstadoResultados(desde: string, hasta: string, idPais: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fin_estado_resultados", {
    p_desde: desde,
    p_hasta: hasta,
    p_pais: idPais,
  });
  return {
    error: error?.message ?? null,
    filas: ((data ?? []) as FilaResultado[]).map((f) => ({ ...f, monto: Number(f.monto) })),
  };
}

export async function cargarBalance(al: string, idPais: number) {
  const supabase = await createClient();
  const [bal, res] = await Promise.all([
    supabase.rpc("fin_balance", { p_al: al, p_pais: idPais }),
    supabase.rpc("fin_resultado_al", { p_al: al, p_pais: idPais }),
  ]);
  return {
    error: (bal.error ?? res.error)?.message ?? null,
    filas: ((bal.data ?? []) as FilaBalance[]).map((f) => ({ ...f, saldo: Number(f.saldo) })),
    resultado: Number(res.data ?? 0),
  };
}
