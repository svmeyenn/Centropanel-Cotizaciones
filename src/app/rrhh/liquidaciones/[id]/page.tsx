import { notFound, redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasRRHH from "@/components/rrhh/PestanasRRHH";
import DetalleLiquidacion from "@/components/rrhh/DetalleLiquidacion";
import { folioLiquidacion, nivelRRHH } from "@/lib/rrhh";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Liquidacion" };
export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  const v = await requerirVendedor();
  if (!nivelRRHH(v, "ver")) redirect("/");
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const { data: l } = await supabase.from("rrhh_liquidaciones").select("*").eq("id", id).maybeSingle();
  if (!l) notFound();

  const [{ data: p }, { data: lineas }, { data: imp }, { data: centros }, { data: proyectos }, { data: cuentas }] = await Promise.all([
    supabase.from("rrhh_personal").select("id, cargo, clase, banco, tipo_cuenta, numero_cuenta, entidades(razon_social, rut)").eq("id", l.id_personal).single(),
    supabase.from("rrhh_liquidacion_lineas").select("*").eq("id_liquidacion", id).order("orden"),
    supabase.from("rrhh_liquidacion_imputacion").select("id_centro_costo, id_proyecto, porcentaje, monto").eq("id_liquidacion", id),
    supabase.from("centros_costo").select("id, codigo, nombre"),
    supabase.from("proyectos").select("id_proyecto, nombre").eq("id_pais", l.id_pais),
    supabase.from("cuentas").select("id_cuenta, alias, banco, numero_cuenta").eq("id_pais", l.id_pais).eq("activa", true).order("alias"),
  ]);
  const ent = (Array.isArray(p?.entidades) ? p?.entidades[0] : p?.entidades) as { razon_social: string; rut: string | null } | null;
  const nCentro = new Map((centros ?? []).map((c) => [Number(c.id), `${c.codigo} · ${c.nombre}`]));
  const nProy = new Map((proyectos ?? []).map((c) => [Number(c.id_proyecto), c.nombre as string]));

  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <Cabecera titulo={folioLiquidacion(l.tipo as string, id)} subtitulo={ent?.razon_social ?? ""} />
      </div>
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="print:hidden space-y-4">
          <BarraNavegacion />
          <PestanasRRHH activa="/rrhh/liquidaciones" administra={nivelRRHH(v, "administrar")} />
        </div>
        <DetalleLiquidacion
          liq={{
            id,
            id_pais: Number(l.id_pais),
            id_personal: Number(l.id_personal),
            periodo: l.periodo as string,
            tipo: l.tipo as string,
            estado: l.estado as string,
            dias_trabajados: Number(l.dias_trabajados ?? 30),
            moneda: (l.moneda as string | null) ?? "CLP",
            boleta_numero: (l.boleta_numero as string | null) ?? "",
            boleta_fecha: (l.boleta_fecha as string | null) ?? "",
            boleta_bruto: l.boleta_bruto != null ? Number(l.boleta_bruto) : null,
            uf: l.uf != null ? Number(l.uf) : null,
            utm: l.utm != null ? Number(l.utm) : null,
            imponible: Number(l.imponible ?? 0),
            total_haberes: Number(l.total_haberes ?? 0),
            total_descuentos: Number(l.total_descuentos ?? 0),
            liquido: Number(l.liquido ?? 0),
            aportes_empleador: Number(l.aportes_empleador ?? 0),
            costo_empleador: Number(l.costo_empleador ?? 0),
            fecha_pago: (l.fecha_pago as string | null) ?? "",
            medio_pago: (l.medio_pago as string | null) ?? "",
            nota: (l.nota as string | null) ?? "",
            motivo_anulacion: (l.motivo_anulacion as string | null) ?? "",
            calculada: l.calculado_en != null,
          }}
          persona={{
            nombre: ent?.razon_social ?? "",
            rut: ent?.rut ?? "",
            cargo: (p?.cargo as string | null) ?? "",
            cuenta: [p?.banco, p?.tipo_cuenta, p?.numero_cuenta].filter(Boolean).join(" · "),
          }}
          lineas={(lineas ?? []).map((x) => ({
            id: Number(x.id),
            descripcion: x.descripcion as string,
            tipo: x.tipo as string,
            imponible: Boolean(x.imponible),
            cantidad: x.cantidad != null ? Number(x.cantidad) : null,
            base: x.base != null ? Number(x.base) : null,
            tasa: x.tasa != null ? Number(x.tasa) : null,
            monto: Number(x.monto),
          }))}
          imputaciones={(imp ?? []).map((x) => ({
            centro: nCentro.get(Number(x.id_centro_costo)) ?? "Centro de costo",
            proyecto: x.id_proyecto != null ? (nProy.get(Number(x.id_proyecto)) ?? null) : null,
            porcentaje: Number(x.porcentaje),
            monto: Number(x.monto),
          }))}
          puedeOperar={nivelRRHH(v, "operar")}
          puedeAprobar={nivelRRHH(v, "aprobar")}
          puedeAdministrar={nivelRRHH(v, "administrar")}
          cuentas={(cuentas ?? []).map((c) => ({ id: Number(c.id_cuenta), nombre: [c.alias ?? c.banco, c.numero_cuenta].filter(Boolean).join(" · ") }))}
        />
      </div>
    </div>
  );
}
