import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import TablaProductos from "@/components/TablaProductos";
import type { MateriaVenta } from "@/components/Configurador";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import BotonNuevoProducto from "@/components/BotonNuevoProducto";
import { createClient } from "@/lib/supabase/server";
import type { ProveedorDeItem } from "@/components/ProveedoresDelItem";
import { leerIvaPorPais } from "@/lib/parametros";

export default async function Pagina() {
  const v = await requerirVendedor();
  const esAdmin = tienePerfilAdmin(v);
  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo } = await contextoMercado(v);

  // El administrador ve la tabla completa (con costo y margen); el resto ve la
  // vista de venta, que omite los costos por RLS.
  const { data: productos } = esAdmin
    ? await conPais(
        supabase
          .from("productos")
          .select(
            "id, sku, descripcion, tipo, familia, subfamilia, espesor_total, costo_unitario, precio_venta, margen_aplicado, precio_manual, activo, id_eps, id_placa_a, id_placa_b, id_pais, grupo_descuento",
          ),
        idPaisActivo,
      )
        .order("familia")
        .order("subfamilia")
        .order("descripcion")
    : await conPais(
        supabase
          .from("v_catalogo_venta")
          .select(
            "id, sku, descripcion, tipo, familia, subfamilia, precio_venta, activo, id_pais",
          ),
        idPaisActivo,
      )
        .order("familia")
        .order("descripcion");

  // Los paneles hechos con una plancha EPS que no calza con sus placas.
  const { data: malos } = await supabase.rpc("paneles_eps_erroneo");
  const advertencias: Record<number, string> = {};
  for (const m of (malos ?? []) as { id: number; mensaje: string }[]) advertencias[Number(m.id)] = m.mensaje;

  // Grupo de descuento de cada familia del catalogo.
  const { data: familiasCat } = await supabase
    .from("familias")
    .select("nombre, grupo");
  const gruposFamilia: Record<string, string> = {};
  for (const f of familiasCat ?? []) {
    gruposFamilia[f.nombre as string] = f.grupo as string;
  }

  // El PVP de cada producto lleva el IVA de su mercado.
  const ivaPorPais = await leerIvaPorPais();

  // Insumos para editar la composicion de un panel. Solo los ve el
  // administrador, que es quien puede editarla.
  const { data: materias } = esAdmin
    ? await conPais(
        supabase
          .from("v_materias_primas_venta")
          .select("id, nombre, tipo, etiqueta, espesor_nominal")
          .eq("activo", true),
        idPaisActivo,
      ).order("nombre")
    : { data: [] as unknown[] };

  // Proveedor preferente de cada producto comprado: el que define su costo.
  const preferentes: Record<number, { proveedor: string; costo: number }> = {};
  const proveedoresDe: Record<number, ProveedorDeItem[]> = {};
  if (esAdmin) {
    const { data: provItems } = await supabase
      .from("proveedor_items")
      .select("id, id_proveedor, id_producto, costo, moneda, activo, es_preferente, entidades(razon_social)")
      .not("id_producto", "is", null)
      .order("id");
    for (const x of provItems ?? []) {
      const pr = Array.isArray(x.entidades) ? x.entidades[0] : x.entidades;
      (proveedoresDe[Number(x.id_producto)] ??= []).push({
        id: Number(x.id),
        id_proveedor: Number(x.id_proveedor),
        proveedor: (pr as { razon_social?: string } | null)?.razon_social ?? "",
        costo: Number(x.costo),
        moneda: (x.moneda as string | null) ?? null,
        activo: Boolean(x.activo),
        preferente: Boolean(x.es_preferente),
      });
    }
    const { data: pref } = await supabase.rpc("preferentes_costos");
    for (const x of (pref ?? []) as { id_producto: number | null; proveedor: string; costo: number | null }[]) {
      if (x.id_producto != null && x.costo != null)
        preferentes[Number(x.id_producto)] = { proveedor: x.proveedor, costo: Number(x.costo) };
    }
  }

  // Familias ya en uso, para sugerirlas al dar de alta y no acabar con
  // "Tornillos" y "tornillo" como grupos distintos.
  const familias = [
    ...new Set(
      (productos ?? [])
        .map((p) => (p.familia as string | null) ?? "")
        .filter(Boolean),
    ),
  ].sort();

  const subfamilias = [
    ...new Set(
      (productos ?? [])
        .map((p) => (p.subfamilia as string | null) ?? "")
        .filter(Boolean),
    ),
  ].sort();

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Catalogo de productos"
        subtitulo="Paneles ya configurados y servicios, con su precio de venta"
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion>
          <Link
            href="/configurador"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Configurar panel
          </Link>
          {esAdmin && (
            <BotonNuevoProducto
              ivaPorPais={ivaPorPais}
              familias={familias}
              subfamilias={subfamilias}
              paises={paises}
            />
          )}
        </BarraNavegacion>
        <TablaProductos
          productos={productos ?? []}
          esAdmin={esAdmin}
          ivaPorPais={ivaPorPais}
          materias={(materias ?? []) as MateriaVenta[]}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
          gruposFamilia={gruposFamilia}
          advertencias={advertencias}
          preferentes={preferentes}
          proveedoresDe={proveedoresDe}
        />
      </div>
    </div>
  );
}
