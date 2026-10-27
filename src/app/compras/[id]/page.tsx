import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import EditorOC from "@/components/EditorOC";
import EnvioDocumento from "@/components/EnvioDocumento";
import { textosOrden } from "@/lib/textosCompra";
import { enviarOcPorCorreo, registrarWhatsAppOc } from "@/app/necesidades/envios";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { COLOR_ESTADO } from "@/lib/compras";
import { fecha } from "@/lib/formato";
import { uno } from "@/lib/relaciones";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const v = await requerirVendedor();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const supabase = await createClient();

  const { data: o } = await supabase
    .from("ordenes_compra")
    .select("*, proyectos(id_proyecto, nombre, direccion), entidades(razon_social, nombre_referencia, email, telefono, contacto), solicitudes(num_solicitud)")
    .eq("id", id)
    .single();
  if (!o) notFound();

  // Si la orden salio de una solicitud de cotizacion de una necesidad de material, de donde viene.
  const { data: scDb } = o.id_sc
    ? await supabase.from("solicitudes_cotizacion").select("folio, id_necesidad, necesidades_material(folio)").eq("id", o.id_sc).maybeSingle()
    : { data: null };
  const origenSC = scDb
    ? { folio: scDb.folio as string, idNm: Number(scDb.id_necesidad), folioNm: uno<{ folio: string }>(scDb.necesidades_material)?.folio ?? "" }
    : null;

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
  const proy = uno<{ id_proyecto: number; nombre: string; direccion: string | null }>(o.proyectos);
  const prov = uno<{ razon_social: string; nombre_referencia: string | null; email: string | null; telefono: string | null; contacto: string | null }>(o.entidades);
  const puedeEnviar = ["Administrador", "Supervisor", "Comprador"].includes(v.rol);
  const { data: pais } = await supabase.from("paises").select("prefijo_telefono").eq("id", o.id_pais).single();
  const textos = textosOrden({
    numero: o.num_oc,
    contacto: prov?.contacto ?? null,
    proveedor: prov?.razon_social ?? "",
    fechaEntrega: o.fecha_entrega,
    direccion: o.direccion_entrega || proy?.direccion || null,
    emisor: { nombre: v.nombre, cargo: v.cargo, email: v.email, telefono: v.telefono },
  });

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
          {origenSC && (
            <span>
              Origen:{" "}
              <Link href={`/necesidades/${origenSC.idNm}`} className="text-verde underline font-semibold">
                {origenSC.folio} ({origenSC.folioNm})
              </Link>
            </span>
          )}
          {uno<{ num_solicitud: string }>(o.solicitudes) && (
            <span>Origen: {uno<{ num_solicitud: string }>(o.solicitudes)?.num_solicitud}</span>
          )}
        </div>
        {puedeEnviar && (
          <div className="flex flex-wrap items-center gap-2 text-xs bg-white border border-gray-200 rounded px-3 py-2">
            <span className="font-semibold text-verde">Proveedor</span>
            <span>{prov?.razon_social}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <a href={`/compras/${id}/pdf/archivo`} target="_blank" rel="noopener noreferrer" className="border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                PDF de la orden
              </a>
              <EnvioDocumento
                etiqueta="Enviar al proveedor"
                titulo={`Enviar ${o.num_oc}`}
                proveedor={{ nombre: prov?.razon_social ?? "", email: prov?.email ?? null, telefono: prov?.telefono ?? null }}
                prefijoTelefono={(pais?.prefijo_telefono as string | null) ?? "56"}
                pdfUrl={`/compras/${id}/pdf/archivo`}
                nombreArchivo={`${o.num_oc}.pdf`}
                asunto={textos.asunto}
                cuerpo={textos.cuerpo}
                textoWhatsApp={textos.whatsapp}
                bloqueo={["Aprobada", "Enviada", "Recibida parcial", "Recibida", "Facturada", "Pagada"].includes(o.estado) ? null : `La orden esta ${o.estado.toLowerCase()}: se envia una vez aprobada.`}
                enviarCorreo={enviarOcPorCorreo.bind(null, id)}
                registrarWhatsApp={registrarWhatsAppOc.bind(null, id)}
              />
            </span>
          </div>
        )}
        <EditorOC
          oc={{
            id,
            num_oc: o.num_oc,
            estado: o.estado,
            fecha_entrega: o.fecha_entrega,
            direccion_entrega: o.direccion_entrega,
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
