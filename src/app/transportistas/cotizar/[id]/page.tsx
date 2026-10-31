import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasTransportes from "@/components/transportes/PestanasTransportes";
import CotizacionFlete from "@/components/transportes/CotizacionFlete";
import { folioFlete } from "@/lib/carga";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { cargarTransportes } from "@/lib/transportes";
import { createClient } from "@/lib/supabase/server";
import { monedaDelPais } from "@/lib/formato";
import { uno } from "@/lib/relaciones";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/transportistas")) redirect("/");
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("flete_cotizaciones")
    .select("*, pedidos(id, num_pedido), ordenes_compra(id, num_oc)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const [{ data: resp }, transportistas, { data: emisor }] = await Promise.all([
    supabase.from("flete_cotizacion_respuestas").select("*").eq("id_cotizacion", id).order("id"),
    cargarTransportes(supabase, Number(c.id_pais)),
    supabase.from("vendedores").select("nombre").eq("id", c.creado_por ?? 0).maybeSingle(),
  ]);
  const ped = uno<{ id: number; num_pedido: string }>(c.pedidos);
  const oc = uno<{ id: number; num_oc: string }>(c.ordenes_compra);
  const moneda = monedaDelPais(Number(c.id_pais));

  // Un transportista dado de baja despues de cotizar sigue apareciendo en su cotizacion.
  const ids = (resp ?? []).map((r) => Number(r.id_transportista));
  const { data: ents } = ids.length
    ? await supabase.from("entidades").select("id_entidad, razon_social, contacto, telefono, email").in("id_entidad", ids)
    : { data: [] };
  const { data: vehs } = ids.length
    ? await supabase.from("transporte_vehiculos").select("id, id_entidad, tipo, patente, capacidad_kg, capacidad_m3, largo_carga_m").in("id_entidad", ids).eq("activo", true)
    : { data: [] };

  const filas = (resp ?? []).map((r) => {
    const e = (ents ?? []).find((x) => Number(x.id_entidad) === Number(r.id_transportista));
    const op = transportistas.find((t) => t.id === Number(r.id_transportista));
    return {
      id: Number(r.id),
      idTransportista: Number(r.id_transportista),
      nombre: (e?.razon_social as string) ?? "—",
      contacto: (e?.contacto as string) ?? "",
      telefono: (e?.telefono as string) ?? "",
      email: (e?.email as string) ?? "",
      vehiculos: (vehs ?? [])
        .filter((x) => Number(x.id_entidad) === Number(r.id_transportista))
        .map((x) => ({
          id: Number(x.id),
          etiqueta: `${x.tipo} ${x.patente}`,
          capacidad_kg: x.capacidad_kg == null ? null : Number(x.capacidad_kg),
          capacidad_m3: x.capacidad_m3 == null ? null : Number(x.capacidad_m3),
          largo_carga_m: x.largo_carga_m == null ? null : Number(x.largo_carga_m),
        })),
      tarifas: op?.tarifas ?? [],
      idVehiculo: r.id_vehiculo == null ? null : Number(r.id_vehiculo),
      monto: r.monto == null ? null : Number(r.monto),
      moneda: (r.moneda as string) ?? moneda,
      plazoDias: r.plazo_dias == null ? null : Number(r.plazo_dias),
      validaHasta: (r.valida_hasta as string) ?? "",
      notas: (r.notas as string) ?? "",
      estado: r.estado as string,
    };
  });

  return (
    <div className="min-h-screen">
      <Cabecera titulo={folioFlete(id)} subtitulo={ped ? `Flete del pedido ${ped.num_pedido}` : oc ? `Retiro de la orden de compra ${oc.num_oc}` : "Cotizacion de flete"} />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasTransportes activa="/transportistas/cotizar" />
        <CotizacionFlete
          id={id}
          estado={c.estado as string}
          documento={ped ? { href: `/pedidos/${ped.id}`, texto: `Pedido ${ped.num_pedido}` } : oc ? { href: `/compras/${oc.id}`, texto: `Orden de compra ${oc.num_oc}` } : null}
          datos={{
            origen: (c.origen as string) ?? "",
            destino: (c.destino as string) ?? "",
            fecha: (c.fecha_requerida as string) ?? "",
            pesoKg: c.peso_kg == null ? null : Number(c.peso_kg),
            volumenM3: c.volumen_m3 == null ? null : Number(c.volumen_m3),
            largoMaxM: c.largo_max_m == null ? null : Number(c.largo_max_m),
            resumen: (c.resumen_carga as string) ?? "",
            notas: (c.notas as string) ?? "",
          }}
          emisor={{ nombre: (emisor?.nombre as string) ?? v.nombre, telefono: v.telefono ?? "", email: v.email ?? "" }}
          moneda={moneda}
          filas={filas}
          otros={transportistas.filter((t) => !filas.some((f) => f.idTransportista === t.id)).map((t) => ({ id: t.id, nombre: t.nombre }))}
          puedeEditar={v.puede_editar || tienePerfilAdmin(v)}
        />
        <Link href="/transportistas/cotizar" className="text-xs text-verde underline">← Todas las cotizaciones de flete</Link>
      </div>
    </div>
  );
}
