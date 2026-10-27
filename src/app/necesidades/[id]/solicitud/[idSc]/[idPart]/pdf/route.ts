import { requerirVendedor } from "@/lib/sesion";
import { leerSolicitudDoc } from "@/lib/documentosCompra";
import { archivoSolicitudPdf } from "@/lib/pdf/ComprasPdf";

// La solicitud de cotizacion de un proveedor, como archivo PDF.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; idSc: string; idPart: string }> }) {
  await requerirVendedor();
  const { id, idSc, idPart } = await params;
  const doc = await leerSolicitudDoc(Number(id), Number(idSc), Number(idPart));
  if (!doc) return new Response("No encontrada", { status: 404 });
  const datos = await archivoSolicitudPdf(doc.d, doc.p);
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.d.folio}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
