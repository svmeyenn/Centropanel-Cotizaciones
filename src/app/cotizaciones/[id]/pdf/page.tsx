import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerParametros } from "@/lib/parametros";
import BotonImprimir from "./BotonImprimir";
import DocumentoCotizacion, {
  type CotizacionDoc,
} from "@/components/DocumentoCotizacion";

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
// como PDF) en vez de generar el binario en el servidor: Vercel hobby no
// sostiene bien Puppeteer/Chromium, y asi el documento es ademas seleccionable.
export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();

  const [{ data: cot }, { data: items }, { data: tot }, p] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select(
        "*, clientes(razon_social, rut, contacto, email, telefono), vendedores(nombre, cargo, email, telefono), formas_pago(descripcion)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("cotizacion_detalle")
      .select("*")
      .eq("id_cotizacion", id)
      .order("orden"),
    supabase.from("v_cotizacion_totales").select("*").eq("id", id).single(),
    leerParametros(),
  ]);

  if (!cot) notFound();

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

  const d: CotizacionDoc = {
    num_cotizacion: cot.num_cotizacion,
    fecha: (cot.fecha as string).slice(0, 10),
    validez_dias: cot.validez_dias ?? 7,
    tiempo_entrega: cot.tiempo_entrega,
    direccion_despacho: cot.direccion_despacho,
    cliente: cli,
    vendedor: ven,
    forma_pago: fp?.descripcion ?? null,
    items: (items ?? []).map((it) => ({
      descripcion: it.descripcion,
      unidades: Number(it.unidades),
      valor_unitario: Number(it.valor_unitario),
    })),
    subtotal: Number(tot?.subtotal ?? 0),
    descuento: Number(tot?.descuento_monto ?? 0),
    total_neto: Number(tot?.total_neto ?? 0),
    iva: Number(tot?.iva ?? 0),
    total: Number(tot?.total ?? 0),
  };

  return (
    <div className="bg-white min-h-screen">
      <BotonImprimir idCotizacion={id} />
      <DocumentoCotizacion d={d} p={p} />
    </div>
  );
}
