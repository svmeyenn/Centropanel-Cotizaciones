import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import EditorOC from "@/components/EditorOC";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { COLOR_ESTADO } from "@/lib/compras";
import { fecha } from "@/lib/formato";

export const dynamic = "force-dynamic";

const uno = <T,>(x: unknown): T | null => (Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null));

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const v = await requerirVendedor();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const supabase = await createClient();

  const { data: o } = await supabase
    .from("ordenes_compra")
    .select("*, proyectos(id_proyecto, nombre), entidades(razon_social), solicitudes(num_solicitud)")
    .eq("id", id)
    .single();
  if (!o) notFound();

  const [{ data: lineas }, { data: recs }, { data: pagos }, { data: partidas }, { data: cuentas }, { data: cats }, { data: aprueba }, { data: quienes }] =
    await Promise.all([
      supabase.from("oc_detalle").select("*").eq("id_oc", id).order("orden").order("id"),
      supabase.from("oc_recepciones").select("id, fecha, cantidad, guia, id_detalle").eq("id_oc", id).order("id"),
      supabase.from("movimientos").select("id_mov, monto, fecha, estado_pago, documento").eq("id_oc", id).order("id_mov"),
      supabase.from("proyecto_partidas").select("id, nombre").eq("id_proyecto", o.id_proyecto).order("orden").order("id"),
      supabase.from("cuentas").select("id_cuenta, alias").eq("id_pais", o.id_pais).eq("activa", true).order("alias"),
      supabase
        .from("categorias")
        .select("id_categoria, nombre")
        .eq("id_pais", o.id_pais)
        .eq("tipo", "Egreso")
        .eq("borrado", false)
        .order("nombre"),
      supabase.rpc("oc_puede_aprobar", { p_oc: id }),
      supabase.from("vendedores").select("id, nombre").in("id", [o.id_solicitante ?? 0, o.id_aprobador ?? 0]),
    ]);

  const desc = new Map((lineas ?? []).map((l) => [Number(l.id), l.descripcion as string]));
  const nombre = (idv: number | null) => (quienes ?? []).find((x) => Number(x.id) === idv)?.nombre;
  const proy = uno<{ id_proyecto: number; nombre: string }>(o.proyectos);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo={`${o.num_oc}`}
        subtitulo={`${uno<{ razon_social: string }>(o.entidades)?.razon_social ?? ""} · ${proy?.nombre ?? ""}`}
      />
      <div className="max-w-screen-xl mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/compras" />
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${COLOR_ESTADO[o.estado] ?? ""}`}>
            {o.estado}
          </span>
          <span>Fecha {fecha(o.fecha)}</span>
          {nombre(o.id_solicitante) && <span>Solicita: {nombre(o.id_solicitante)}</span>}
          {o.aprobada_en && (
            <span>
              Aprobada por {nombre(o.id_aprobador)} el {fecha(String(o.aprobada_en).slice(0, 10))}
            </span>
          )}
          {proy && (
            <Link href={`/proyectos/${proy.id_proyecto}?tab=compras`} className="text-verde hover:underline">
              Ver proyecto
            </Link>
          )}
          {uno<{ num_solicitud: string }>(o.solicitudes) && (
            <span>Origen: {uno<{ num_solicitud: string }>(o.solicitudes)?.num_solicitud}</span>
          )}
        </div>
        <EditorOC
          oc={{
            id,
            num_oc: o.num_oc,
            estado: o.estado,
            fecha_entrega: o.fecha_entrega,
            condiciones_pago: o.condiciones_pago,
            notas: o.notas,
            total: Number(o.total),
            id_partida: o.id_partida != null ? Number(o.id_partida) : null,
            motivo_rechazo: o.motivo_rechazo,
            factura_numero: o.factura_numero,
            factura_fecha: o.factura_fecha,
            factura_monto: o.factura_monto != null ? Number(o.factura_monto) : null,
            moneda: o.moneda,
          }}
          lineas={(lineas ?? []).map((l) => ({
            id: Number(l.id),
            descripcion: l.descripcion as string,
            unidades: Number(l.unidades),
            costo_unitario: Number(l.costo_unitario),
            recibido: Number(l.recibido),
          }))}
          partidas={(partidas ?? []).map((p) => ({ id: Number(p.id), nombre: p.nombre as string }))}
          recepciones={(recs ?? []).map((r) => ({
            id: Number(r.id),
            fecha: r.fecha as string,
            cantidad: Number(r.cantidad),
            guia: r.guia as string | null,
            descripcion: desc.get(Number(r.id_detalle)) ?? "",
          }))}
          pagos={(pagos ?? []).map((p) => ({
            id_mov: Number(p.id_mov),
            monto: Number(p.monto),
            fecha: p.fecha as string | null,
            estado_pago: p.estado_pago as string,
            documento: p.documento as string | null,
          }))}
          cuentas={(cuentas ?? []).map((c) => ({ id: Number(c.id_cuenta), alias: c.alias as string }))}
          categorias={(cats ?? []).map((c) => ({ id: Number(c.id_categoria), nombre: c.nombre as string }))}
          puedeAprobar={Boolean(aprueba)}
          puedeCrear={v.puede_crear}
          esAdmin={tienePerfilAdmin(v)}
        />
      </div>
    </div>
  );
}
