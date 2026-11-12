import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import CalculoCostoProveedor, { type ItemCalculo, type ReglaGuardada } from "@/components/CalculoCostoProveedor";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/lib/relaciones";

export const metadata = { title: "Calculo del costo" };
export const dynamic = "force-dynamic";

// Como se calcula el costo de lo que vende el proveedor: por metro cubico o cada SKU por su cuenta,
// para todo el proveedor, una familia o un item puntual.
export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) redirect("/");

  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [{ data: prov }, { data: calculo, error }, { data: reglas }] = await Promise.all([
    supabase.from("entidades").select("id_entidad, razon_social, paises(moneda_base)").eq("id_entidad", id).single(),
    supabase.rpc("proveedor_costo_calculo", { p_proveedor: id }),
    supabase.from("proveedor_reglas_costo").select("alcance, familia, id_item, metodo, valor_m3").eq("id_proveedor", id),
  ]);
  if (!prov) notFound();
  if (error) throw new Error(error.message);

  const monedaMercado = uno<{ moneda_base: string }>(prov.paises)?.moneda_base ?? "CLP";
  const items = ((calculo ?? []) as Record<string, unknown>[]).map(
    (x): ItemCalculo => ({
      id: Number(x.id),
      sku: (x.sku as string | null) ?? null,
      descripcion: String(x.descripcion ?? ""),
      familia: String(x.familia ?? "Sin familia"),
      costo: Number(x.costo ?? 0),
      moneda: (x.moneda as string | null) ?? null,
      activo: Boolean(x.activo),
      volumen: x.volumen_m3 == null ? null : Number(x.volumen_m3),
    })
  );
  const guardadas = ((reglas ?? []) as Record<string, unknown>[]).map(
    (r): ReglaGuardada => ({
      alcance: r.alcance as ReglaGuardada["alcance"],
      familia: (r.familia as string | null) ?? null,
      id_item: r.id_item == null ? null : Number(r.id_item),
      metodo: r.metodo as "m3" | "sku",
      valor_m3: r.valor_m3 == null ? null : Number(r.valor_m3),
    })
  );

  return (
    <div className="min-h-screen">
      <Cabecera titulo={prov.razon_social as string} subtitulo="Calculo del costo: por metro cubico o por SKU" />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion volverA={`/proveedores/${id}`}>
          <Link href={`/proveedores/${id}`} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
            Maestra del proveedor
          </Link>
          <Link href={`/proveedores/${id}/costos`} className="bg-dorado-osc text-white text-xs font-semibold px-2.5 py-1 rounded">
            Actualizar costos
          </Link>
        </BarraNavegacion>
        <p className="text-xs text-gray-600 max-w-3xl">
          Elija como se calcula el costo. <strong>Por m³</strong>: el costo de cada item es su volumen (ancho x largo x espesor de la ficha) por el
          valor del metro cubico, y al cambiar ese valor se actualizan todos de una vez. <strong>Por SKU</strong>: cada item lleva su propio costo,
          que se cambia en &quot;Actualizar costos&quot;. Lo puntual manda: un item con su propia regla ignora la de su familia, y una familia con
          regla ignora la del proveedor.
        </p>
        <CalculoCostoProveedor idProveedor={id} monedaMercado={monedaMercado} items={items} reglas={guardadas} />
      </div>
    </div>
  );
}
