import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import NuevaOC from "@/components/NuevaOC";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/lib/relaciones";

export const dynamic = "force-dynamic";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ proyecto?: string }>;
}) {
  await requerirVendedor();
  const { proyecto } = await searchParams;
  const supabase = await createClient();

  const [{ data: proyectos }, { data: partidas }, { data: provs }, { data: sols }, { data: usadas }] =
    await Promise.all([
      supabase
        .from("proyectos")
        .select("id_proyecto, nombre, id_pais")
        .eq("borrado", false)
        .eq("activo", true)
        .order("nombre"),
      supabase.from("proyecto_partidas").select("id, id_proyecto, nombre").order("orden").order("id"),
      supabase
        .from("entidades")
        .select("id_entidad, razon_social, id_pais, entidad_tipos!inner(tipo)")
        .eq("entidad_tipos.tipo", "proveedor")
        .eq("activo", true)
        .order("razon_social"),
      supabase
        .from("solicitudes")
        .select("id, num_solicitud, entidades(razon_social), pedidos(id_pais)")
        .order("id", { ascending: false }),
      supabase.from("ordenes_compra").select("id_solicitud").not("id_solicitud", "is", null),
    ]);

  const ocupadas = new Set((usadas ?? []).map((u) => Number(u.id_solicitud)));

  return (
    <div className="min-h-screen">
      <Cabecera proceso={{ tipo: "compras", etapa: "oc" }} titulo="Nueva orden de compra" subtitulo="Elija el proyecto y el proveedor" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/compras" />
        <NuevaOC
          proyectoInicial={proyecto ? Number(proyecto) : null}
          proyectos={(proyectos ?? []).map((p) => ({
            id: Number(p.id_proyecto),
            nombre: p.nombre as string,
            id_pais: Number(p.id_pais),
          }))}
          partidas={(partidas ?? []).map((p) => ({
            id: Number(p.id),
            id_proyecto: Number(p.id_proyecto),
            nombre: p.nombre as string,
          }))}
          proveedores={(provs ?? []).map((p) => ({
            id: Number(p.id_entidad),
            razon_social: p.razon_social as string,
            id_pais: Number(p.id_pais),
          }))}
          solicitudes={(sols ?? [])
            .filter((s) => !ocupadas.has(Number(s.id)))
            .map((s) => ({
              id: Number(s.id),
              num: s.num_solicitud as string,
              proveedor: uno<{ razon_social: string }>(s.entidades)?.razon_social ?? "",
              id_pais: Number(uno<{ id_pais: number }>(s.pedidos)?.id_pais ?? 0),
            }))}
        />
      </div>
    </div>
  );
}
