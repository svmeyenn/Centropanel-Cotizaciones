import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import FichaNecesidad, { type Detalle } from "@/components/FichaNecesidad";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { monedaDelPais } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  await requerirVendedor();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const supabase = await createClient();

  // Todo el detalle --items, proveedores, precios y solicitudes-- llega en una sola consulta.
  const { data, error } = await supabase.rpc("nm_detalle", { p_nm: id });
  if (error || !data) notFound();
  const detalle = data as Detalle;

  const { data: provs } = await supabase
    .from("entidades")
    .select("id_entidad, nombre_referencia, entidad_tipos!inner(tipo)")
    .eq("entidad_tipos.tipo", "proveedor")
    .eq("activo", true)
    .eq("id_pais", detalle.nm.id_pais)
    .order("nombre_referencia");

  return (
    <div className="min-h-screen">
      <Cabecera titulo={detalle.nm.folio} subtitulo="Necesidad de material" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/necesidades" />
        <FichaNecesidad
          detalle={detalle}
          moneda={monedaDelPais(Number(detalle.nm.id_pais))}
          proveedoresDisponibles={(provs ?? []).map((p) => ({ id: Number(p.id_entidad), nombre: p.nombre_referencia as string }))}
        />
      </div>
    </div>
  );
}
