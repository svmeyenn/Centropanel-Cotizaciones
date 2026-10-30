import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import FichaNecesidad, { type Detalle } from "@/components/FichaNecesidad";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { monedaDelPais } from "@/lib/formato";
import { etiquetaProyecto } from "@/lib/compras";

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

  // Solo pueden recibir la solicitud los proveedores que tienen asignado, en su maestra, algun item de la necesidad.
  const { data: conItems } = await supabase.rpc("nm_proveedores_con_items", { p_nm: id });
  const cubre = new Map(((conItems ?? []) as { id_proveedor: number; n: number }[]).map((x) => [Number(x.id_proveedor), Number(x.n)]));

  return (
    <div className="min-h-screen">
      <Cabecera proceso={{ tipo: "compras", etapa: "necesidad", enlaces: { necesidad: { ref: detalle.nm.folio }, solicitud: (detalle.solicitudes ?? []).find((s) => s.estado !== "Abierta" && s.estado !== "Anulada") ? { href: `/necesidades/${detalle.nm.id}/solicitud/${(detalle.solicitudes ?? []).find((s) => s.estado !== "Abierta" && s.estado !== "Anulada")!.id}`, ref: (detalle.solicitudes ?? []).find((s) => s.estado !== "Abierta" && s.estado !== "Anulada")!.folio } : undefined } }} titulo={[detalle.nm.folio, etiquetaProyecto(detalle.nm.proyecto, (detalle.nm as { proyecto_cliente?: string | null }).proyecto_cliente)].filter(Boolean).join(" · ")} subtitulo="Necesidad de material" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/necesidades" />
        <FichaNecesidad
          detalle={detalle}
          moneda={monedaDelPais(Number(detalle.nm.id_pais))}
          proveedoresDisponibles={(provs ?? []).filter((p) => cubre.has(Number(p.id_entidad))).map((p) => ({ id: Number(p.id_entidad), nombre: `${p.nombre_referencia as string} (${cubre.get(Number(p.id_entidad))} de ${detalle.items.length} items)` }))}
        />
      </div>
    </div>
  );
}
