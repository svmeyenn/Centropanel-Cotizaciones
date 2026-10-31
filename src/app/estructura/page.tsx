import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelEstructura from "@/components/PanelEstructura";
import { cargarEstructura } from "@/lib/estructura";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const v = await requerirVendedor();
  if (!v.fin_mantenedores) redirect("/");

  const ctx = await contextoMercado(v);
  const supabase = await createClient();
  const { unidades, centros } = await cargarEstructura(ctx.idPaisActivo);

  const [{ data: paises }, { data: proyectos }, { data: movs }] = await Promise.all([
    supabase
      .from("paises")
      .select("id, codigo, nombre, moneda_base, prefijo_telefono, etiqueta_id, activo, opera")
      .order("orden")
      .order("nombre"),
    supabase.from("proyectos").select("id_proyecto, id_pais, id_centro_costo, borrado").eq("borrado", false),
    // Movimientos sin proyecto y sin centro de costo: los que hay que clasificar
    // a mano.
    supabase
      .from("movimientos")
      .select("id_mov, id_pais, tipo, fecha, origen_destino, monto, id_categoria")
      .is("id_centro_costo", null)
      .is("id_proyecto", null)
      .order("fecha", { ascending: false })
      .limit(300),
  ]);

  const { data: categorias } = await supabase.from("categorias").select("id_categoria, nombre");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Unidades de negocio y centros de costo"
        subtitulo="Mercado > Unidad de negocio > Centro de costo > Proyecto"
      />
      <div className="p-6 space-y-4">
        <BarraNavegacion />
        <PanelEstructura
          unidades={unidades}
          centros={centros}
          paises={(paises ?? []) as never}
          proyectos={(proyectos ?? []) as never}
          sinClasificar={(movs ?? []) as never}
          categorias={(categorias ?? []) as never}
          esAdminGeneral={ctx.esAdminGeneral}
        />
      </div>
    </div>
  );
}
