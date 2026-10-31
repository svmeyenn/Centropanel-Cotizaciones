import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import FichaTransportista from "@/components/transportes/FichaTransportista";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/lib/relaciones";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/transportistas")) redirect("/");
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [{ data: e }, { data: extra }, { data: vehiculos }, { data: tarifas }, { data: pedidos }, { data: ocs }] = await Promise.all([
    supabase.from("entidades").select("*, paises(moneda_base, etiqueta_id, prefijo_telefono), entidad_tipos!inner(tipo)").eq("id_entidad", id).eq("entidad_tipos.tipo", "transportista").maybeSingle(),
    supabase.from("transportistas").select("cobertura, notas").eq("id_entidad", id).maybeSingle(),
    supabase.from("transporte_vehiculos").select("*").eq("id_entidad", id).order("activo", { ascending: false }).order("patente"),
    supabase.from("transporte_tarifas").select("*").eq("id_entidad", id).order("activa", { ascending: false }).order("id"),
    supabase.from("pedidos").select("id, num_pedido, fecha, flete_estimado, estado").eq("id_transportista", id).order("fecha", { ascending: false }).limit(15),
    supabase.from("ordenes_compra").select("id, num_oc, fecha, estado").eq("id_transportista", id).order("fecha", { ascending: false }).limit(15),
  ]);
  if (!e) notFound();
  const pais = uno<{ moneda_base: string; etiqueta_id: string; prefijo_telefono: string }>(e.paises);

  return (
    <div className="min-h-screen">
      <Cabecera titulo={e.razon_social as string} subtitulo="Ficha del transportista" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <Link href="/transportistas" className="text-xs text-verde underline">
          ← Todos los transportistas
        </Link>
        <FichaTransportista
          id={id}
          datos={{
            razon_social: e.razon_social as string,
            rut: (e.rut as string) ?? "",
            contacto: (e.contacto as string) ?? "",
            email: (e.email as string) ?? "",
            telefono: (e.telefono as string) ?? "",
            direccion: (e.direccion as string) ?? "",
            cobertura: (extra?.cobertura as string) ?? "",
            notas: (extra?.notas as string) ?? "",
            activo: Boolean(e.activo),
          }}
          etiquetaId={pais?.etiqueta_id ?? "RUT"}
          prefijo={pais?.prefijo_telefono ?? "+56"}
          moneda={pais?.moneda_base ?? "CLP"}
          vehiculos={(vehiculos ?? []).map((x) => ({
            id: Number(x.id),
            tipo: x.tipo as string,
            patente: x.patente as string,
            descripcion: (x.descripcion as string) ?? "",
            capacidad_kg: x.capacidad_kg == null ? null : Number(x.capacidad_kg),
            largo_carga_m: x.largo_carga_m == null ? null : Number(x.largo_carga_m),
            activo: Boolean(x.activo),
            notas: (x.notas as string) ?? "",
          }))}
          tarifas={(tarifas ?? []).map((t) => ({
            id: Number(t.id),
            id_vehiculo: t.id_vehiculo == null ? null : Number(t.id_vehiculo),
            origen: (t.origen as string) ?? "",
            destino: (t.destino as string) ?? "",
            tipo_cobro: t.tipo_cobro as string,
            monto: Number(t.monto),
            moneda: t.moneda as string,
            vigente_desde: (t.vigente_desde as string) ?? "",
            vigente_hasta: (t.vigente_hasta as string) ?? "",
            activa: Boolean(t.activa),
            notas: (t.notas as string) ?? "",
          }))}
          usoPedidos={(pedidos ?? []).map((p) => ({ id: Number(p.id), num: p.num_pedido as string, fecha: String(p.fecha).slice(0, 10), flete: p.flete_estimado == null ? null : Number(p.flete_estimado), estado: p.estado as string }))}
          usoOC={(ocs ?? []).map((o) => ({ id: Number(o.id), num: o.num_oc as string, fecha: String(o.fecha).slice(0, 10), estado: o.estado as string }))}
          puedeEditar={v.puede_editar || tienePerfilAdmin(v)}
        />
      </div>
    </div>
  );
}
