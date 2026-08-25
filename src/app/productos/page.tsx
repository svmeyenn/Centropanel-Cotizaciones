import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import TablaProductos from "@/components/TablaProductos";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  const esAdmin = v.rol === "Administrador";
  const supabase = await createClient();

  // El administrador ve la tabla completa (con costo y margen); el resto ve la
  // vista de venta, que omite los costos por RLS.
  const { data: productos } = esAdmin
    ? await supabase
        .from("productos")
        .select(
          "id, descripcion, tipo, espesor_total, costo_unitario, precio_venta, margen_aplicado, precio_manual, activo"
        )
        .order("tipo")
        .order("descripcion")
    : await supabase
        .from("v_catalogo_venta")
        .select("id, descripcion, tipo, precio_venta, activo")
        .order("tipo")
        .order("descripcion");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Catalogo de productos"
        subtitulo="Paneles ya configurados y servicios, con su precio de venta"
      />
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <BarraNavegacion>
          <Link
            href="/configurador"
            className="bg-verde text-white text-sm font-semibold px-3 py-1.5 rounded"
          >
            Configurar panel
          </Link>
        </BarraNavegacion>
        <TablaProductos productos={productos ?? []} esAdmin={esAdmin} />
      </div>
    </div>
  );
}
