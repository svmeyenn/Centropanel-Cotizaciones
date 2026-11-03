import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { dinero, fecha, monedaDelPais } from "@/lib/formato";
import { COLOR_ESTADO, ESTADOS_OC } from "@/lib/compras";
import { uno } from "@/lib/relaciones";

export const dynamic = "force-dynamic";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const v = await requerirVendedor();
  const { estado } = await searchParams;
  const supabase = await createClient();
  const { idPaisActivo } = await contextoMercado(v);

  let q = supabase
    .from("ordenes_compra")
    .select("id, num_oc, id_pais, estado, fecha, total, id_proyecto, proyectos(nombre), entidades!ordenes_compra_id_proveedor_fkey(razon_social)");
  if (estado) q = q.eq("estado", estado);
  const { data } = await conPais(q, idPaisActivo).order("id", { ascending: false });

  const porAprobar = (data ?? []).filter((o) => o.estado === "Pendiente aprobacion").length;

  // Anticipos ya pagados a proveedores cuya factura aun no llega: el riesgo de pagar por adelantado.
  const { data: anticiposDb } = await conPais(
    supabase
      .from("movimientos")
      .select("id_mov, id_pais, monto, fecha_pago, id_oc, ordenes_compra(num_oc, factura_fecha, estado), entidades:id_interlocutor(razon_social)")
      .eq("anticipo_oc", true)
      .eq("estado_pago", "Pagado"),
    idPaisActivo
  ).order("fecha_pago");
  const hoy = Date.now();
  const anticipos = (anticiposDb ?? [])
    .map((m) => {
      const oc = uno<{ num_oc: string; factura_fecha: string | null; estado: string }>(m.ordenes_compra);
      return {
        id: Number(m.id_mov),
        idOc: Number(m.id_oc),
        numOc: oc?.num_oc ?? "",
        facturada: oc?.factura_fecha != null,
        proveedor: uno<{ razon_social: string }>(m.entidades)?.razon_social ?? "",
        monto: Number(m.monto),
        pais: Number(m.id_pais),
        fechaPago: m.fecha_pago as string | null,
        dias: m.fecha_pago ? Math.floor((hoy - new Date(`${m.fecha_pago}T00:00:00`).getTime()) / 86400000) : 0,
      };
    })
    .filter((a) => !a.facturada);

  return (
    <div className="min-h-screen">
      <Cabecera proceso={{ tipo: "compras", etapa: "oc" }} titulo="Ordenes de compra" subtitulo="Compras a proveedores por proyecto, con aprobacion" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/compras" className={`px-2 py-1 rounded ${!estado ? "bg-verde text-white" : "bg-gray-100"}`}>
              Todas
            </Link>
            {ESTADOS_OC.map((e) => (
              <Link
                key={e}
                href={`/compras?estado=${encodeURIComponent(e)}`}
                className={`px-2 py-1 rounded ${estado === e ? "bg-verde text-white" : "bg-gray-100"}`}
              >
                {e}
              </Link>
            ))}
          </div>
          <Link href="/compras/nueva" className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
            Nueva orden de compra
          </Link>
        </div>
        {!estado && porAprobar > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3">
            {porAprobar} orden{porAprobar > 1 ? "es" : ""} esperando aprobacion.{" "}
            <Link href="/compras?estado=Pendiente%20aprobacion" className="underline font-semibold">
              Ver
            </Link>
          </div>
        )}
        {!estado && anticipos.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs space-y-1">
            <div className="font-semibold text-amber-900">
              {anticipos.length} anticipo{anticipos.length > 1 ? "s" : ""} pagado{anticipos.length > 1 ? "s" : ""} a proveedores sin factura
            </div>
            <ul className="space-y-0.5">
              {anticipos.map((a) => (
                <li key={a.id}>
                  <Link href={`/compras/${a.idOc}`} className="text-verde font-semibold hover:underline">{a.numOc}</Link>{" "}
                  {a.proveedor}: {dinero(a.monto, monedaDelPais(a.pais))}, pagado el {fecha(a.fechaPago)} ({a.dias} dias)
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">OC</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Proyecto</th>
                  <th className="text-left px-3 py-2">Proveedor</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold">
                      <Link href={`/compras/${o.id}`} className="text-verde hover:underline">
                        {o.num_oc}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{fecha(o.fecha)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/proyectos/${o.id_proyecto}`} className="hover:underline">
                        {uno<{ nombre: string }>(o.proyectos)?.nombre}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{uno<{ razon_social: string }>(o.entidades)?.razon_social}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${COLOR_ESTADO[o.estado] ?? ""}`}>
                        {o.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{dinero(Number(o.total), monedaDelPais(Number(o.id_pais)))}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <a href={`/compras/${o.id}/pdf/archivo`} target="_blank" rel="noopener noreferrer" className="text-verde underline mr-2">PDF</a>
                      <Link href={`/compras/${o.id}`} className="text-verde underline">Enviar</Link>
                    </td>
                  </tr>
                ))}
                {(data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                      Sin ordenes de compra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
