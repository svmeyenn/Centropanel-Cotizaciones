import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelActivos from "@/components/finanzas/PanelActivos";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, paisAdministrado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/activos-fijos")) redirect("/");

  const sp = await searchParams;
  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, sp.pais);
  if (!pais) redirect("/");

  const supabase = await createClient();
  const [activos, centros] = await Promise.all([
    supabase.from("activos_fijos").select("*").eq("id_pais", pais.id).order("fecha_compra", { ascending: false }),
    supabase
      .from("centros_costo")
      .select("id, codigo, nombre, unidades_negocio!inner(id_pais)")
      .eq("unidades_negocio.id_pais", pais.id)
      .eq("activo", true)
      .order("codigo"),
  ]);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Activos fijos"
        subtitulo="Maquinaria, vehículos y equipos, con su depreciación lineal mensual"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelActivos
          pais={{ id: pais.id, nombre: pais.nombre, moneda: pais.moneda_base, codigo: pais.codigo }}
          paises={ctx.activo ? [] : ctx.accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
          activos={(activos.data ?? []).map((a) => ({
            id: Number(a.id),
            nombre: a.nombre as string,
            fechaCompra: a.fecha_compra as string,
            costo: Number(a.costo),
            residual: Number(a.valor_residual),
            vidaMeses: Number(a.vida_util_meses),
            centro: a.id_centro_costo == null ? null : Number(a.id_centro_costo),
            idMov: a.id_mov == null ? null : Number(a.id_mov),
            activo: a.activo as boolean,
          }))}
          centros={(centros.data ?? []).map((c) => ({ id: Number(c.id), codigo: c.codigo as string, nombre: c.nombre as string }))}
          puedeEditar={v.fin_mantenedores}
        />
      </div>
    </div>
  );
}
