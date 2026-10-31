import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasRRHH from "@/components/rrhh/PestanasRRHH";
import PlanillaPrevisional, { type FilaPlanilla } from "@/components/rrhh/PlanillaPrevisional";
import { puedeVerRuta } from "@/lib/menu";
import { hoyISO } from "@/lib/formato";
import { nivelRRHH, primerDiaDelMes } from "@/lib/rrhh";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Planilla previsional" };
export const dynamic = "force-dynamic";

// Lo que hay que pagar a AFP, salud, seguro de cesantia, mutual y al fisco por las liquidaciones del mes.
// Solo cuentan las aprobadas y pagadas: un borrador todavia puede cambiar.
export default async function Pagina({ searchParams }: { searchParams: Promise<{ periodo?: string; pais?: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/rrhh/planilla") || !nivelRRHH(v, "ver")) redirect("/");
  const { periodo: q, pais: qp } = await searchParams;
  const periodo = primerDiaDelMes(q && /^\d{4}-\d{2}/.test(q) ? q : hoyISO());

  const { accesibles, idPaisActivo, esAdminGeneral } = await contextoMercado(v);
  const idPais = idPaisActivo ?? (Number(qp) || accesibles[0]?.id || 1);

  const supabase = await createClient();
  const [{ data: lineas }, { data: instituciones }] = await Promise.all([
    supabase
      .from("rrhh_liquidacion_lineas")
      .select("descripcion, tipo, monto, id_institucion, rrhh_liquidaciones!inner(id, periodo, estado, id_pais, moneda, rrhh_personal(entidades(razon_social, rut)))")
      .eq("rrhh_liquidaciones.periodo", periodo)
      .eq("rrhh_liquidaciones.id_pais", idPais)
      .in("rrhh_liquidaciones.estado", ["Aprobada", "Pagada"])
      .in("tipo", ["Descuento", "Aporte"]),
    supabase.from("rrhh_instituciones").select("id, nombre").eq("id_pais", idPais),
  ]);
  const nIns = new Map((instituciones ?? []).map((i) => [Number(i.id), i.nombre as string]));

  const filas: FilaPlanilla[] = [];
  for (const l of lineas ?? []) {
    const liq = (Array.isArray(l.rrhh_liquidaciones) ? l.rrhh_liquidaciones[0] : l.rrhh_liquidaciones) as {
      id: number;
      moneda: string | null;
      rrhh_personal: unknown;
    } | null;
    if (!liq) continue;
    const pp = (Array.isArray(liq.rrhh_personal) ? liq.rrhh_personal[0] : liq.rrhh_personal) as { entidades?: unknown } | null;
    const ent = (Array.isArray(pp?.entidades) ? (pp?.entidades as unknown[])[0] : pp?.entidades) as { razon_social?: string; rut?: string } | null;
    const concepto = l.descripcion as string;
    // Los descuentos que van a una institucion se juntan bajo ella; los demas, bajo su propio concepto.
    const destino = l.id_institucion != null ? (nIns.get(Number(l.id_institucion)) ?? concepto) : concepto;
    filas.push({
      destino,
      concepto,
      tipo: l.tipo as string,
      persona: ent?.razon_social ?? "",
      rut: ent?.rut ?? "",
      monto: Number(l.monto),
      moneda: liq.moneda ?? (idPais === 2 ? "PEN" : "CLP"),
    });
  }

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Planilla previsional" subtitulo="Cotizaciones, impuestos y aportes a pagar por mes" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasRRHH activa="/rrhh/planilla" administra={nivelRRHH(v, "administrar")} />
        <PlanillaPrevisional
          periodo={periodo}
          idPais={idPais}
          paises={esAdminGeneral && idPaisActivo == null ? accesibles.map((p) => ({ id: p.id, nombre: p.nombre })) : []}
          filas={filas}
        />
      </div>
    </div>
  );
}
