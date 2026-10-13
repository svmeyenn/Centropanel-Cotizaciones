import { requerirVendedor } from "@/lib/sesion";
import { leerPedidoDoc } from "@/lib/pedidoDoc";
import { archivoCotizacionPdf } from "@/lib/pdf/CotizacionPdf";

// El pedido como archivo PDF, con la misma estructura que la cotizacion.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) return new Response("No encontrado", { status: 404 });

  const doc = await leerPedidoDoc(id);
  if (!doc) return new Response("No encontrado", { status: 404 });

  const datos = await archivoCotizacionPdf(doc.d, doc.p);
  const nombre = `${doc.d.num_cotizacion ?? "Pedido"}.pdf`;

  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
