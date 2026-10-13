import { createClient } from "@/lib/supabase/server";
import { leerParametros, type Parametros } from "@/lib/parametros";
import { monedaDelPais } from "@/lib/formato";
import type { CotizacionDoc, PagoDoc } from "@/components/DocumentoCotizacion";

// Datos del pedido impreso, con la sesion de quien lo pide. Es el mismo documento
// que la cotizacion --misma estructura--, mas el estado de pago bajo el lugar de
// despacho. Lo usan la vista para imprimir y el archivo PDF.
export async function leerPedidoDoc(id: number): Promise<{
  d: CotizacionDoc;
  p: Parametros;
} | null> {
  const supabase = await createClient();

  const [{ data: ped }, { data: items }, { data: cta }] = await Promise.all([
    supabase
      .from("pedidos")
      .select(
        "*, clientes:entidades(razon_social, rut, contacto, email, telefono), vendedores(nombre, cargo, email, telefono), formas_pago(descripcion), medios_pago(nombre)"
      )
      .eq("id", id)
      .single(),
    supabase.from("pedido_detalle").select("*").eq("id_pedido", id).order("orden"),
    supabase.from("v_pedido_cuenta").select("*").eq("id", id).single(),
  ]);

  if (!ped) return null;

  const p = await leerParametros(Number(ped.id_pais));

  type Rel = Record<string, string | null>;
  const uno = (x: unknown): Rel | null =>
    Array.isArray(x) ? ((x[0] as Rel) ?? null) : ((x as Rel) ?? null);

  const cli = uno(ped.clientes);
  const ven = uno(ped.vendedores);
  const fp = uno(ped.formas_pago);
  const mp = uno(ped.medios_pago);

  const total = Number(cta?.total ?? 0);
  const abonado = Number(cta?.abonado ?? 0);
  const saldo = Number(cta?.saldo ?? 0);
  const estado: PagoDoc["estado"] =
    total > 0 && saldo <= 0 ? "Pagado" : abonado > 0 ? "Pago parcial" : "Pendiente de pago";

  const d: CotizacionDoc = {
    pedido: true,
    num_cotizacion: ped.num_pedido,
    moneda: (ped.moneda as string | null) ?? monedaDelPais(Number(ped.id_pais)),
    fecha: (ped.fecha as string).slice(0, 10),
    validez_dias: 0,
    tiempo_entrega: ped.tiempo_entrega,
    direccion_despacho: ped.direccion_despacho,
    cliente: cli,
    vendedor: ven,
    forma_pago: fp?.descripcion ?? null,
    medio_pago: mp?.nombre ?? null,
    comision_pct: Number(cta?.comision_pct ?? 0),
    total_a_pagar: total,
    items: (items ?? []).map((it) => ({
      sku: (it.sku as string | null) ?? null,
      descripcion: it.descripcion,
      unidades: Number(it.unidades),
      valor_unitario: Number(it.valor_unitario),
    })),
    subtotal: Number(cta?.subtotal ?? 0),
    descuento: Number(cta?.descuento_monto ?? 0),
    descuento2: Number(cta?.descuento2_monto ?? 0),
    descuento3: Number(cta?.descuento3_monto ?? 0),
    total_neto: Number(cta?.total_neto ?? 0),
    iva: Number(cta?.iva ?? 0),
    total: Number(cta?.total_sin_comision ?? 0),
    pago: { estado, total, abonado, saldo },
  };

  return { d, p };
}
