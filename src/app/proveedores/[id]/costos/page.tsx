import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import ActualizarCostos from "@/components/ActualizarCostos";
import type { ItemMaestra } from "@/components/MaestraProveedor";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/lib/relaciones";

export const metadata = { title: "Actualizar costos" };
export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) redirect("/");

  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [{ data: prov }, { data: items }] = await Promise.all([
    supabase.from("entidades").select("id_entidad, razon_social, paises(moneda_base)").eq("id_entidad", id).single(),
    supabase
      .from("proveedor_items")
      .select("id, codigo, costo, activo, moneda, es_preferente, id_materia_prima, id_producto, materias_primas(nombre, tipo, sku), productos(descripcion, familia, sku)")
      .eq("id_proveedor", id),
  ]);
  if (!prov) notFound();

  const monedaMercado = uno<{ moneda_base: string }>(prov.paises)?.moneda_base ?? "CLP";

  const filas: ItemMaestra[] = (items ?? []).map((it) => {
    const mp = uno<{ nombre: string; tipo: string; sku: string | null }>(it.materias_primas);
    const pr = uno<{ descripcion: string; familia: string | null; sku: string | null }>(it.productos);
    return {
      id: Number(it.id),
      sku: mp?.sku ?? pr?.sku ?? null,
      descripcion: mp?.nombre ?? pr?.descripcion ?? "",
      grupo: mp ? `Materia prima - ${mp.tipo}` : (pr?.familia ?? "Productos"),
      codigo: it.codigo as string | null,
      costo: Number(it.costo),
      activo: Boolean(it.activo),
      moneda: (it.moneda as string | null) ?? null,
      preferente: Boolean(it.es_preferente),
      otros: [],
    };
  });

  return (
    <div className="min-h-screen">
      <Cabecera titulo={prov.razon_social as string} subtitulo="Actualizar los costos del proveedor, todos juntos" />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion volverA={`/proveedores/${id}`}>
          <Link href={`/proveedores/${id}`} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
            Maestra del proveedor
          </Link>
        </BarraNavegacion>
        <p className="text-xs text-gray-600 max-w-3xl">
          Escriba el costo nuevo de cada producto, reajuste los marcados por un porcentaje o cargue la lista de precios del proveedor.
          Nada se guarda hasta pulsar &quot;Guardar&quot;. Cada cambio queda en el historial con la fecha desde la que rige; si el proveedor es el
          preferente de un producto, se recostean los paneles y las cotizaciones sin pedido (los pedidos no se tocan).
        </p>
        <ActualizarCostos idProveedor={id} monedaMercado={monedaMercado} items={filas} />
      </div>
    </div>
  );
}
