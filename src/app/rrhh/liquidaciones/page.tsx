import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasRRHH from "@/components/rrhh/PestanasRRHH";
import GestorLiquidaciones, { type FilaLiquidacion } from "@/components/rrhh/GestorLiquidaciones";
import { puedeVerRuta } from "@/lib/menu";
import { hoyISO } from "@/lib/formato";
import { nivelRRHH, primerDiaDelMes } from "@/lib/rrhh";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Liquidaciones y honorarios" };
export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/rrhh/liquidaciones") || !nivelRRHH(v, "ver")) redirect("/");
  const { periodo: q } = await searchParams;
  const periodo = primerDiaDelMes(q && /^\d{4}-\d{2}/.test(q) ? q : hoyISO());

  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo } = await contextoMercado(v);
  const [{ data: liqs }, { data: personal }] = await Promise.all([
    conPais(
      supabase
        .from("rrhh_liquidaciones")
        .select("id, id_pais, id_personal, tipo, estado, liquido, costo_empleador, moneda, calculado_en, rrhh_personal(clase, entidades(razon_social))")
        .eq("periodo", periodo)
        .neq("estado", "Anulada"),
      idPaisActivo
    ),
    conPais(
      supabase.from("rrhh_personal").select("id, id_pais, relacion, estado, entidades(razon_social)").eq("estado", "Activo"),
      idPaisActivo
    ),
  ]);

  const nombre = (e: unknown) => {
    const x = (Array.isArray(e) ? e[0] : e) as { razon_social?: string } | null;
    return x?.razon_social ?? "(sin nombre)";
  };
  const filas: FilaLiquidacion[] = (liqs ?? [])
    .map((l) => {
      const p = (Array.isArray(l.rrhh_personal) ? l.rrhh_personal[0] : l.rrhh_personal) as { clase?: string; entidades?: unknown } | null;
      return {
        id: Number(l.id),
        id_pais: Number(l.id_pais),
        id_personal: Number(l.id_personal),
        nombre: nombre(p?.entidades),
        clase: p?.clase ?? "",
        tipo: l.tipo as string,
        estado: l.estado as string,
        liquido: l.liquido != null ? Number(l.liquido) : null,
        costo: l.costo_empleador != null ? Number(l.costo_empleador) : null,
        moneda: l.moneda as string | null,
        calculada: l.calculado_en != null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const conLiq = new Set(filas.map((f) => f.id_personal));
  const pendientes = (personal ?? [])
    .filter((p) => !conLiq.has(Number(p.id)))
    .map((p) => ({ id: Number(p.id), id_pais: Number(p.id_pais), texto: `${nombre(p.entidades)} (${p.relacion === "Honorarios" ? "honorarios" : "contrato"})`, honorarios: p.relacion === "Honorarios" }));

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Liquidaciones y honorarios" subtitulo="Emision mensual, aprobacion y pago" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasRRHH activa="/rrhh/liquidaciones" administra={nivelRRHH(v, "administrar")} />
        <GestorLiquidaciones
          periodo={periodo}
          filas={filas}
          pendientes={pendientes}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
          puedeOperar={nivelRRHH(v, "operar")}
        />
      </div>
    </div>
  );
}
