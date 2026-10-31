import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelPresupuesto from "@/components/finanzas/PanelPresupuesto";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, paisAdministrado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string; anio?: string; hasta?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/presupuesto")) redirect("/");

  const sp = await searchParams;
  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, sp.pais);
  if (!pais) redirect("/");

  const hoy = new Date();
  const anio = /^\d{4}$/.test(sp.anio ?? "") ? Number(sp.anio) : hoy.getFullYear();
  const mesDefecto = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : anio < hoy.getFullYear() ? 12 : 1;
  const hasta = Math.min(12, Math.max(1, Number(sp.hasta) || mesDefecto));

  const supabase = await createClient();
  const [centros, presupuestos, real] = await Promise.all([
    supabase
      .from("centros_costo")
      .select("id, codigo, nombre, unidades_negocio!inner(id_pais)")
      .eq("unidades_negocio.id_pais", pais.id)
      .eq("activo", true)
      .order("codigo"),
    supabase.from("presupuestos").select("id_centro_costo, mes, tipo, monto").eq("anio", anio),
    supabase.rpc("fin_real_vs_presupuesto", { p_anio: anio, p_hasta_mes: hasta, p_pais: pais.id }),
  ]);

  // montos[centro][tipo] = 12 meses
  const montos: Record<string, number[]> = {};
  for (const p of presupuestos.data ?? []) {
    const clave = `${Number(p.id_centro_costo)}|${p.tipo}`;
    (montos[clave] ??= Array(12).fill(0))[Number(p.mes) - 1] = Number(p.monto);
  }

  return (
    <div className="min-h-screen vista-fin">
      <Cabecera
        titulo="Presupuesto"
        subtitulo="Lo planificado por centro de costo y mes, contra lo que ya ocurrió"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelPresupuesto
          pais={{ id: pais.id, nombre: pais.nombre, moneda: pais.moneda_base, codigo: pais.codigo }}
          paises={ctx.activo ? [] : ctx.accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
          anio={anio}
          anios={[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1]}
          hasta={hasta}
          centros={(centros.data ?? []).map((c) => ({ id: Number(c.id), codigo: c.codigo as string, nombre: c.nombre as string }))}
          montos={montos}
          real={((real.data ?? []) as {
            id_centro: number;
            codigo: string;
            nombre: string;
            unidad: string;
            pres_ingreso: number;
            real_ingreso: number;
            pres_gasto: number;
            real_gasto: number;
          }[]).map((r) => ({
            codigo: r.codigo,
            nombre: r.nombre,
            presIngreso: Number(r.pres_ingreso),
            realIngreso: Number(r.real_ingreso),
            presGasto: Number(r.pres_gasto),
            realGasto: Number(r.real_gasto),
          }))}
          errorReal={real.error?.message ?? null}
          puedeEditar={v.fin_mantenedores}
        />
      </div>
    </div>
  );
}
