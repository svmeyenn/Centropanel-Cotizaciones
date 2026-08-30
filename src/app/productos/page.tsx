import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import TablaProductos from "@/components/TablaProductos";
import { requerirVendedor } from "@/lib/sesion";
import BotonNuevoProducto from "@/components/BotonNuevoProducto";
import { createClient } from "@/lib/supabase/server";
import { leerParametros, pNum } from "@/lib/parametros";

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
          "id, descripcion, tipo, familia, espesor_total, costo_unitario, precio_venta, margen_aplicado, precio_manual, activo"
        )
        .order("familia")
        .order("descripcion")
    : await supabase
        .from("v_catalogo_venta")
        .select("id, descripcion, tipo, familia, precio_venta, activo")
        .order("familia")
        .order("descripcion");

  const iva = pNum(await leerParametros(), "IVA", 0.19);

  // Familias ya en uso, para sugerirlas al dar de alta y no acabar con
  // "Tornillos" y "tornillo" como grupos distintos.
  const familias = [
    ...new Set(
      (productos ?? [])
        .map((p) => (p.familia as string | null) ?? "")
        .filter(Boolean)
    ),
  ].sort();

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Catalogo de productos"
        subtitulo="Paneles ya configurados y servicios, con su precio de venta"
      />
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <BarraNavegacion>
          <Link
            href="/configurador"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Configurar panel
          </Link>
          {esAdmin && <BotonNuevoProducto iva={iva} familias={familias} />}
        </BarraNavegacion>
        <TablaProductos productos={productos ?? []} esAdmin={esAdmin} iva={iva} />
      </div>
    </div>
  );
}
