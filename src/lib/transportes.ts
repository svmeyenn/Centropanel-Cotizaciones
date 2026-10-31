import type { SupabaseClient } from "@supabase/supabase-js";

// Lo que se ofrece al elegir transportista en un pedido o una orden de compra: los activos del
// mercado, con sus vehiculos disponibles y sus tarifas vigentes. Tipos planos, aptos para un componente de cliente.
export interface OpcionTarifa {
  id: number;
  id_vehiculo: number | null;
  origen: string;
  destino: string;
  tipo_cobro: string;
  monto: number;
  moneda: string;
}

export interface OpcionVehiculo {
  id: number;
  etiqueta: string;
  capacidad_kg: number | null;
  capacidad_m3: number | null;
  largo_carga_m: number | null;
}

export interface OpcionTransportista {
  id: number;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  vehiculos: OpcionVehiculo[];
  tarifas: OpcionTarifa[];
}

export async function cargarTransportes(supabase: SupabaseClient, idPais: number | null): Promise<OpcionTransportista[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from("entidades")
    .select("id_entidad, razon_social, contacto, telefono, email, entidad_tipos!inner(tipo)")
    .eq("entidad_tipos.tipo", "transportista")
    .eq("activo", true)
    .order("razon_social");
  if (idPais != null) q = q.eq("id_pais", idPais);
  const { data: ts } = await q;
  if (!ts || ts.length === 0) return [];
  const ids = ts.map((t) => Number(t.id_entidad));
  const [{ data: vs }, { data: tf }] = await Promise.all([
    supabase.from("transporte_vehiculos").select("id, id_entidad, tipo, patente, capacidad_kg, capacidad_m3, largo_carga_m").in("id_entidad", ids).eq("activo", true).order("patente"),
    supabase
      .from("transporte_tarifas")
      .select("id, id_entidad, id_vehiculo, origen, destino, tipo_cobro, monto, moneda, vigente_desde, vigente_hasta")
      .in("id_entidad", ids)
      .eq("activa", true)
      .order("id"),
  ]);
  return ts.map((t) => {
    const id = Number(t.id_entidad);
    return {
      id,
      nombre: t.razon_social as string,
      contacto: (t.contacto as string) ?? "",
      telefono: (t.telefono as string) ?? "",
      email: (t.email as string) ?? "",
      vehiculos: (vs ?? [])
        .filter((v) => Number(v.id_entidad) === id)
        .map((v) => ({
          id: Number(v.id),
          etiqueta: `${v.tipo} ${v.patente}`,
          capacidad_kg: v.capacidad_kg == null ? null : Number(v.capacidad_kg),
          capacidad_m3: v.capacidad_m3 == null ? null : Number(v.capacidad_m3),
          largo_carga_m: v.largo_carga_m == null ? null : Number(v.largo_carga_m),
        })),
      tarifas: (tf ?? [])
        .filter((x) => Number(x.id_entidad) === id)
        .filter((x) => (!x.vigente_desde || x.vigente_desde <= hoy) && (!x.vigente_hasta || x.vigente_hasta >= hoy))
        .map((x) => ({
          id: Number(x.id),
          id_vehiculo: x.id_vehiculo == null ? null : Number(x.id_vehiculo),
          origen: (x.origen as string) ?? "",
          destino: (x.destino as string) ?? "",
          tipo_cobro: x.tipo_cobro as string,
          monto: Number(x.monto),
          moneda: x.moneda as string,
        })),
    };
  });
}
