import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelDiario from "@/components/finanzas/PanelDiario";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, paisAdministrado, requerirVendedor } from "@/lib/sesion";
import { asegurarContabilidad, cargarPlan } from "@/lib/finanzas/contabilidad";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; pais?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/libro-diario")) redirect("/");

  const hoy = new Date().toISOString().slice(0, 10);
  const sp = await searchParams;
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  const desde = sp.desde && ok.test(sp.desde) ? sp.desde : `${hoy.slice(0, 4)}-01-01`;
  const hasta = sp.hasta && ok.test(sp.hasta) ? sp.hasta : hoy;

  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, sp.pais);
  if (!pais) redirect("/");

  await asegurarContabilidad();
  const supabase = await createClient();
  const [plan, asientos, centros] = await Promise.all([
    cargarPlan(),
    supabase
      .from("asientos")
      .select("id, fecha, glosa, origen, asiento_lineas(id, codigo_cuenta, debe, haber, id_centro_costo)")
      .eq("id_pais", pais.id)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("centros_costo")
      .select("id, codigo, nombre, unidades_negocio!inner(id_pais)")
      .eq("unidades_negocio.id_pais", pais.id)
      .eq("activo", true)
      .order("codigo"),
  ]);

  return (
    <div className="min-h-screen vista-fin">
      <Cabecera
        titulo="Libro diario"
        subtitulo="Los asientos de partida doble que alimentan el estado de resultados y el balance"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelDiario
          pais={{ id: pais.id, nombre: pais.nombre, moneda: pais.moneda_base, codigo: pais.codigo }}
          otrosPaises={ctx.activo ? [] : ctx.accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
          desde={desde}
          hasta={hasta}
          hoy={hoy}
          plan={plan.map((c) => ({ codigo: c.codigo, nombre: c.nombre }))}
          centros={(centros.data ?? []).map((c) => ({ id: Number(c.id), codigo: c.codigo as string, nombre: c.nombre as string }))}
          asientos={
            (asientos.data ?? []) as unknown as {
              id: number;
              fecha: string;
              glosa: string;
              origen: string;
              asiento_lineas: { id: number; codigo_cuenta: string; debe: number; haber: number; id_centro_costo: number | null }[];
            }[]
          }
          puedeEditar={v.fin_mantenedores}
        />
      </div>
    </div>
  );
}
