import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerPedidoDoc } from "@/lib/pedidoDoc";
import BotonImprimir from "@/app/cotizaciones/[id]/pdf/BotonImprimir";
import DocumentoCotizacion from "@/components/DocumentoCotizacion";

export const dynamic = "force-dynamic";

// El nombre que el navegador propone al guardar como PDF es el folio del pedido.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) return { title: "Pedido" };

  const supabase = await createClient();
  const { data } = await supabase.from("pedidos").select("num_pedido").eq("id", id).single();

  return { title: { absolute: data?.num_pedido ?? "Pedido" } };
}

export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const doc = await leerPedidoDoc(id);
  if (!doc) notFound();

  return (
    <div className="bg-white min-h-screen">
      <BotonImprimir idPedido={id} />
      <DocumentoCotizacion d={doc.d} p={doc.p} />
    </div>
  );
}
