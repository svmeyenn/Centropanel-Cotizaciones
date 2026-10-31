import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasRRHH from "@/components/rrhh/PestanasRRHH";
import GestorParametrosRRHH from "@/components/rrhh/GestorParametrosRRHH";
import { puedeVerRuta } from "@/lib/menu";
import { nivelRRHH } from "@/lib/rrhh";
import { contextoMercado, paisAdministrado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Parametros de remuneraciones" };
export const dynamic = "force-dynamic";

// Las cifras legales (UF, UTM, topes, tasas, tramos de impuesto) las carga quien administra RRHH, con su fecha de
// vigencia. La aplicacion no las inventa: una liquidacion sin su parametro se detiene y dice cual falta.
export default async function Pagina({ searchParams }: { searchParams: Promise<{ pais?: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/rrhh/parametros") || !nivelRRHH(v, "administrar")) redirect("/");
  const { pais: qp } = await searchParams;

  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, qp);
  if (!pais) redirect("/");

  const supabase = await createClient();
  const [{ data: parametros }, { data: tramos }, { data: instituciones }] = await Promise.all([
    supabase.from("rrhh_parametros").select("*").eq("id_pais", pais.id).order("codigo").order("vigente_desde", { ascending: false }),
    supabase.from("rrhh_tramos_impuesto").select("*").eq("id_pais", pais.id).order("vigente_desde", { ascending: false }).order("desde"),
    supabase.from("rrhh_instituciones").select("*").eq("id_pais", pais.id).order("tipo").order("nombre"),
  ]);

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Parametros de remuneraciones" subtitulo={`${pais.nombre}: cifras legales con su vigencia`} />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasRRHH activa="/rrhh/parametros" administra />
        <GestorParametrosRRHH
          pais={{ id: pais.id, codigo: pais.codigo, nombre: pais.nombre }}
          otrosPaises={ctx.activo ? [] : ctx.accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
          parametros={(parametros ?? []) as never[]}
          tramos={(tramos ?? []) as never[]}
          instituciones={(instituciones ?? []) as never[]}
        />
      </div>
    </div>
  );
}
