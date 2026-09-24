import { createClient } from "@/lib/supabase/server";
import { leerParametros, type Parametros } from "@/lib/parametros";
import { conComision } from "@/lib/formato";
import type { CotizacionDoc } from "@/components/DocumentoCotizacion";

// Datos de la cotizacion impresa, con la sesion de quien la pide (las reglas de
// acceso de la base siguen mandando). Lo usan la vista para imprimir, el PDF que
// se adjunta al correo y el que se comparte por WhatsApp: los tres tienen que
// decir exactamente lo mismo.
export async function leerCotizacionDoc(id: number): Promise<{
  d: CotizacionDoc;
  p: Parametros;
  emailCliente: string | null;
} | null> {
  const supabase = await createClient();

  const [{ data: cot }, { data: items }, { data: tot }] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select(
        "*, clientes(razon_social, rut, contacto, email, telefono), vendedores(nombre, cargo, email, telefono), formas_pago(descripcion), medios_pago(nombre, comision_pct)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("cotizacion_detalle")
      .select("*")
      .eq("id_cotizacion", id)
      .order("orden"),
    supabase.from("v_cotizacion_totales").select("*").eq("id", id).single(),
  ]);

  if (!cot) return null;

  // Empresa, banco e impuesto del mercado de la cotizacion.
  const p = await leerParametros(Number(cot.id_pais));

  // PostgREST devuelve la relacion como objeto o como arreglo segun la
  // cardinalidad que infiera del esquema; se normaliza a un solo registro.
  type Rel = Record<string, string | null>;
  function uno(x: unknown): Rel | null {
    if (Array.isArray(x)) return (x[0] as Rel) ?? null;
    return (x as Rel) ?? null;
  }

  const cli = uno(cot.clientes);
  const ven = uno(cot.vendedores);
  const fp = uno(cot.formas_pago);
  const mp = uno(cot.medios_pago) as { nombre?: string; comision_pct?: number } | null;

  const d: CotizacionDoc = {
    num_cotizacion: cot.num_cotizacion,
    fecha: (cot.fecha as string).slice(0, 10),
    validez_dias: cot.validez_dias ?? 7,
    tiempo_entrega: cot.tiempo_entrega,
    direccion_despacho: cot.direccion_despacho,
    cliente: cli,
    vendedor: ven,
    forma_pago: fp?.descripcion ?? null,
    medio_pago: mp?.nombre ?? null,
    comision_pct: Number(mp?.comision_pct ?? 0),
    total_a_pagar: conComision(Number(tot?.total ?? 0), Number(mp?.comision_pct ?? 0)),
    items: (items ?? []).map((it) => ({
      sku: (it.sku as string | null) ?? null,
      descripcion: it.descripcion,
      unidades: Number(it.unidades),
      valor_unitario: Number(it.valor_unitario),
    })),
    subtotal: Number(tot?.subtotal ?? 0),
    descuento: Number(tot?.descuento_monto ?? 0),
    descuento2: Number(tot?.descuento2_monto ?? 0),
    total_neto: Number(tot?.total_neto ?? 0),
    iva: Number(tot?.iva ?? 0),
    total: Number(tot?.total ?? 0),
  };

  return { d, p, emailCliente: cli?.email ?? null };
}
