import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerCotizacionDoc } from "@/lib/cotizacionDoc";
import BotonImprimir from "./BotonImprimir";
import DocumentoCotizacion from "@/components/DocumentoCotizacion";

// El titulo de la pagina es el nombre que el navegador propone al guardar como
// PDF, asi que aqui vale el folio y no el titulo del sistema: el archivo sale
// como "COT00001.pdf". Es una propuesta, no una imposicion -- quien guarda
// puede cambiarlo en el dialogo.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) return { title: "Cotizacion" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("cotizaciones")
    .select("num_cotizacion")
    .eq("id", id)
    .single();

  return { title: { absolute: data?.num_cotizacion ?? "Cotizacion" } };
}

// Replica de rptCotizacion. Se imprime desde el navegador (Ctrl+P -> Guardar
// como PDF), y asi el documento es ademas seleccionable. El archivo que se
// adjunta al correo o se comparte por WhatsApp lo genera pdf/archivo con los
// mismos datos.
export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const doc = await leerCotizacionDoc(id);
  if (!doc) notFound();

  return (
    <div className="bg-white min-h-screen">
      <BotonImprimir idCotizacion={id} />
      <DocumentoCotizacion d={doc.d} p={doc.p} />
    </div>
  );
}
