import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelPlanCuentas from "@/components/finanzas/PanelPlanCuentas";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/plan-cuentas")) redirect("/");

  const ctx = await contextoMercado(v);
  const supabase = await createClient();

  let consultaCat = supabase
    .from("categorias")
    .select("id_categoria, id_pais, nombre, tipo, codigo_cuenta, concepto_flujo")
    .eq("borrado", false)
    .order("tipo")
    .order("nombre");
  if (ctx.idPaisActivo != null) consultaCat = consultaCat.eq("id_pais", ctx.idPaisActivo);

  const [plan, conceptos, categorias] = await Promise.all([
    supabase.from("plan_cuentas").select("*").order("orden"),
    supabase.from("conceptos_flujo").select("*").order("orden"),
    consultaCat,
  ]);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Plan de cuentas"
        subtitulo="Las cuentas IFRS, los conceptos del flujo de efectivo y a qué cuenta va cada categoría"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelPlanCuentas
          plan={plan.data ?? []}
          conceptos={conceptos.data ?? []}
          categorias={categorias.data ?? []}
          paises={ctx.accesibles.map((p) => ({ id: p.id, nombre: p.nombre }))}
          puedeEditar={v.fin_mantenedores}
        />
      </div>
    </div>
  );
}
