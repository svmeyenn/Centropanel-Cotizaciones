import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { LOGO_PDF } from "@/lib/logo";
import { dinero, fecha, unidades as fmtUnid } from "@/lib/formato";
import BotonImprimir from "@/app/cotizaciones/[id]/pdf/BotonImprimir";
import { uno } from "@/lib/relaciones";
import { impuestoDelPais, porcentajeImpuesto, rotuloDescuento } from "@/lib/factura";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orden de compra" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  await requerirVendedor();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("ordenes_compra")
    .select("*, entidades(razon_social, rut, contacto, email, telefono, direccion)")
    .eq("id", id)
    .single();
  if (!o) notFound();
  const { data: lineas } = await supabase.from("oc_detalle").select("*").eq("id_oc", id).order("orden").order("id");
  const prov = uno<{ razon_social: string; rut: string | null; contacto: string | null; email: string | null; telefono: string | null; direccion: string | null }>(o.entidades);
  const sinAprobar = !["Aprobada", "Enviada", "Recibida parcial", "Recibida", "Facturada", "Pagada"].includes(o.estado);

  return (
    <div className="bg-white min-h-screen">
      <BotonImprimir />
      <div className="max-w-3xl mx-auto p-8 text-sm text-gray-900">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_PDF} alt="Centro Panel" className="h-14" />
          <div className="text-right">
            <div className="text-xl font-bold">ORDEN DE COMPRA</div>
            <div className="text-lg">{o.num_oc}</div>
            <div className="text-xs text-gray-600">Fecha {fecha(o.fecha)}</div>
          </div>
        </div>
        {sinAprobar && (
          <div className="mt-3 border border-amber-400 text-amber-800 text-xs p-2 text-center font-semibold">
            DOCUMENTO NO VALIDO: la orden aun no esta aprobada ({o.estado}).
          </div>
        )}
        <div className="grid grid-cols-2 gap-6 mt-6 text-xs">
          <div>
            <div className="font-bold uppercase text-gray-500 mb-1">Proveedor</div>
            <div className="font-semibold">{prov?.razon_social}</div>
            {prov?.rut && <div>{prov.rut}</div>}
            {prov?.contacto && <div>{prov.contacto}</div>}
            {prov?.email && <div>{prov.email}</div>}
            {prov?.telefono && <div>{prov.telefono}</div>}
            {prov?.direccion && <div>{prov.direccion}</div>}
          </div>
          <div>
            <div className="font-bold uppercase text-gray-500 mb-1">Entrega</div>
            {/* Todo pedido de materia prima se despacha a la bodega de Centro Panel o se retira en el proveedor: el documento
                que sale al proveedor no lleva el nombre de la obra ni del cliente. */}
            <div className="font-semibold">{o.modalidad_entrega === "Retiro" ? "Retiro en sus instalaciones" : "Despacho a bodega Centro Panel"}</div>
            {o.modalidad_entrega === "Retiro" ? (
              <div>Retira Centro Panel en: {prov?.direccion ?? "por informar"}</div>
            ) : (
              <>
                <div>Direccion de destino: {o.direccion_entrega ?? "por informar"}</div>
                <div className="text-gray-600">Si no puede despachar, indiquelo para coordinar el retiro en sus instalaciones.</div>
              </>
            )}
            {o.fecha_entrega && <div>Fecha de entrega: {fecha(o.fecha_entrega)}</div>}
            {o.modalidad_entrega !== "Retiro" && o.contacto_entrega && <div>Recibe: {o.contacto_entrega}</div>}
            {o.modalidad_entrega !== "Retiro" && o.telefono_entrega && <div>Telefono: {o.telefono_entrega}</div>}
            {o.modalidad_entrega !== "Retiro" && o.email_entrega && <div>Correo: {o.email_entrega}</div>}
            {o.condiciones_pago && <div>Pago: {o.condiciones_pago}</div>}
          </div>
        </div>
        <table className="w-full mt-6 text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left">
              <th className="py-1">SKU</th>
              <th className="py-1">Descripcion</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">Precio unit.</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(lineas ?? []).map((l) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="py-1 font-mono">{l.sku}</td>
                <td className="py-1">{l.descripcion}</td>
                <td className="py-1 text-right">{fmtUnid(Number(l.unidades))}</td>
                <td className="py-1 text-right">{dinero(Number(l.costo_unitario), o.moneda)}</td>
                <td className="py-1 text-right">{dinero(Number(l.unidades) * Number(l.costo_unitario), o.moneda)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right">Subtotal</td>
              <td className="pt-3 text-right">{dinero(Number(o.subtotal), o.moneda)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right">{rotuloDescuento({ tipo: o.descuento_tipo, valor: Number(o.descuento_valor) })}</td>
              <td className="text-right">{Number(o.descuento_monto) > 0 ? `- ${dinero(Number(o.descuento_monto), o.moneda)}` : dinero(0, o.moneda)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right">Subtotal despues del descuento</td>
              <td className="text-right">{dinero(Number(o.subtotal_neto), o.moneda)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right">{impuestoDelPais(Number(o.id_pais))} {porcentajeImpuesto(Number(o.iva_pct))}</td>
              <td className="text-right">{dinero(Number(o.iva_monto), o.moneda)}</td>
            </tr>
            <tr className="border-t-2 border-gray-800">
              <td colSpan={4} className="py-2 text-right font-bold">TOTAL A PAGAR</td>
              <td className="py-2 text-right font-bold">{dinero(Number(o.total), o.moneda)}</td>
            </tr>
          </tfoot>
        </table>
        {o.notas && (
          <div className="mt-4 text-xs">
            <div className="font-bold uppercase text-gray-500 mb-1">Notas</div>
            {o.notas}
          </div>
        )}
      </div>
    </div>
  );
}
