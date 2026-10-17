import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorAprobadores from "@/components/GestorAprobadores";
import PestanasPais from "@/components/PestanasPais";
import { contextoMercado, paisAdministrado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ pais?: string }> }) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) redirect("/");
  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, (await searchParams).pais);
  if (!pais) redirect("/");

  const supabase = await createClient();
  const [{ data: aprob }, { data: vend }] = await Promise.all([
    supabase.from("oc_aprobadores").select("id, id_vendedor, monto_desde, vendedores(nombre)").eq("id_pais", pais.id).order("monto_desde"),
    supabase.from("vendedores").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Aprobadores de compra" subtitulo={`Quien autoriza las ordenes de compra en ${pais.nombre}`} />
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasPais paises={ctx.activo ? [] : ctx.accesibles} elegido={pais} ruta="/compras/aprobadores" />
        <GestorAprobadores
          key={pais.id}
          idPais={pais.id}
          moneda={pais.moneda_base}
          aprobadores={(aprob ?? []).map((a) => {
            const x = (Array.isArray(a.vendedores) ? a.vendedores[0] : a.vendedores) as { nombre: string } | null;
            return { id: Number(a.id), id_vendedor: Number(a.id_vendedor), nombre: x?.nombre ?? "", monto_desde: Number(a.monto_desde) };
          })}
          vendedores={(vend ?? []).map((x) => ({ id: Number(x.id), nombre: x.nombre as string }))}
        />
      </div>
    </div>
  );
}
