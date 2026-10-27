import { requerirVendedor } from "@/lib/sesion";
import { leerOrdenDoc } from "@/lib/documentosCompra";
import { archivoOrdenCompraPdf } from "@/lib/pdf/ComprasPdf";

// La orden de compra como archivo PDF, para enviarla al proveedor.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirVendedor();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return new Response("No encontrada", { status: 404 });
  const doc = await leerOrdenDoc(id);
  if (!doc) return new Response("No encontrada", { status: 404 });
  const datos = await archivoOrdenCompraPdf(doc.d, doc.p);
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.d.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
