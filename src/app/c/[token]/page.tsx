import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Parametros } from "@/lib/parametros";
import DocumentoCotizacion, {
  type CotizacionDoc,
} from "@/components/DocumentoCotizacion";
import BarraDescarga from "./BarraDescarga";

// Cotizacion publica: la ve el cliente sin cuenta, con el token del enlace.
//
// Existe porque ni mailto: ni wa.me admiten adjuntar un archivo -- es una
// limitacion de los propios protocolos, no del sistema -- asi que la unica
// forma de hacer llegar el documento desde el enlace es publicarlo y mandar la
// URL. Todo pasa por cotizacion_publica(), que devuelve solo lo que va impreso:
// sin costos, sin margen y sin notas internas.
export const dynamic = "force-dynamic";

export default async function Pagina({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Un token mal formado ni siquiera llega a la base: gen_random_uuid() produce
  // uuid v4 y cualquier otra cosa es un intento a mano.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  ) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("cotizacion_publica", { p_token: token });
  if (!data) notFound();

  const j = data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const t = j.totales ?? {};

  const d: CotizacionDoc = {
    num_cotizacion: j.num_cotizacion,
    fecha: String(j.fecha).slice(0, 10),
    validez_dias: Number(j.validez_dias ?? 7),
    tiempo_entrega: j.tiempo_entrega ?? null,
    direccion_despacho: j.direccion_despacho ?? null,
    cliente: j.cliente ?? null,
    vendedor: j.vendedor ?? null,
    forma_pago: j.forma_pago ?? null,
    items: (j.items ?? []).map((it: Record<string, unknown>) => ({
      descripcion: (it.descripcion as string) ?? null,
      unidades: Number(it.unidades),
      valor_unitario: Number(it.valor_unitario),
    })),
    subtotal: Number(t.subtotal ?? 0),
    descuento: Number(t.descuento_monto ?? 0),
    total_neto: Number(t.total_neto ?? 0),
    iva: Number(t.iva ?? 0),
    total: Number(t.total ?? 0),
  };

  const p = (j.parametros ?? {}) as Parametros;

  return (
    <div className="bg-white min-h-screen">
      <BarraDescarga num={d.num_cotizacion ?? ""} />
      <DocumentoCotizacion d={d} p={p} />
    </div>
  );
}
