import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelAvance from "@/components/finanzas/PanelAvance";
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
  if (!puedeVerRuta(v, "/avance-obras")) redirect("/");

  const sp = await searchParams;
  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, sp.pais);
  if (!pais) redirect("/");

  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("proyectos")
    .select("id_proyecto, nombre, cliente, num_pedido")
    .eq("id_pais", pais.id)
    .eq("tipo", "obra")
    .eq("borrado", false)
    .eq("activo", true)
    .order("nombre");

  const ids = (obras ?? []).map((o) => Number(o.id_proyecto));
  const [avances, contratos] = await Promise.all([
    ids.length
      ? supabase.from("avance_obra").select("id_proyecto, fecha, porcentaje").in("id_proyecto", ids).order("fecha", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("pedidos").select("id, id_proyecto").in("id_proyecto", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const idsPedido = (contratos.data ?? []).map((p) => Number(p.id));
  const { data: cuentas } = idsPedido.length
    ? await supabase.from("v_pedido_cuenta").select("id, total_neto").in("id", idsPedido)
    : { data: [] };

  const neto = new Map((cuentas ?? []).map((c) => [Number(c.id), Number(c.total_neto)]));
  const contratoDe = (idProy: number) =>
    (contratos.data ?? []).filter((p) => Number(p.id_proyecto) === idProy).reduce((s, p) => s + (neto.get(Number(p.id)) ?? 0), 0);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Avance de obras"
        subtitulo="El ingreso de cada obra se reconoce según lo avanzado (NIIF 15), no al facturar"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelAvance
          pais={{ nombre: pais.nombre, moneda: pais.moneda_base, codigo: pais.codigo }}
          paises={ctx.activo ? [] : ctx.accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
          obras={(obras ?? []).map((o) => {
            const propios = (avances.data ?? []).filter((a) => Number(a.id_proyecto) === Number(o.id_proyecto));
            return {
              id: Number(o.id_proyecto),
              nombre: o.nombre as string,
              cliente: (o.cliente as string | null) ?? null,
              contrato: contratoDe(Number(o.id_proyecto)),
              ultimaFecha: (propios[0]?.fecha as string | undefined) ?? null,
              ultimoPct: propios[0] ? Number(propios[0].porcentaje) : null,
            };
          })}
          hoy={new Date().toISOString().slice(0, 10)}
          puedeEditar={v.fin_mantenedores}
        />
      </div>
    </div>
  );
}
