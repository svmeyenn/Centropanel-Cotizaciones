import { requerirVendedor } from "@/lib/sesion";
import { leerCotizacionDoc } from "@/lib/cotizacionDoc";
import { archivoCotizacionPdf } from "@/lib/pdf/CotizacionPdf";

// El PDF como archivo, para compartirlo por WhatsApp desde el celular: el menu
// de compartir del telefono si admite adjuntar, a diferencia de wa.me.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) return new Response("No encontrada", { status: 404 });

  const doc = await leerCotizacionDoc(id);
  if (!doc) return new Response("No encontrada", { status: 404 });

  const datos = await archivoCotizacionPdf(doc.d, doc.p);
  const nombre = `${doc.d.num_cotizacion ?? "Cotizacion"}.pdf`;

  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
