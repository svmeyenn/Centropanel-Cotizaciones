import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasTransportes from "@/components/transportes/PestanasTransportes";
import { folioFlete } from "@/lib/carga";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/lib/relaciones";

export const metadata = { title: "Cotizar flete" };
export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = {
  Abierta: "bg-dorado/25 text-dorado-osc",
  Adjudicada: "bg-verde text-white",
  Cancelada: "bg-gray-100 text-gray-700",
};

export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/transportistas")) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase
    .from("flete_cotizaciones")
    .select("id, estado, origen, destino, fecha_requerida, peso_kg, creado_en, pedidos(num_pedido), ordenes_compra(num_oc), flete_cotizacion_respuestas(estado, monto, id_transportista, entidades(razon_social))")
    .order("id", { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Cotizar flete" subtitulo="El mismo viaje, cotizado con varios transportistas" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasTransportes activa="/transportistas/cotizar" />
        <p className="text-xs text-gray-600 max-w-3xl">
          Una cotizacion de flete se abre desde el pedido (su despacho) o desde la orden de compra con retiro: lleva la carga calculada de los catalogos.
        </p>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2">Cotizacion</th>
                  <th scope="col" className="text-left px-3 py-2">Documento</th>
                  <th scope="col" className="text-left px-3 py-2">Ruta</th>
                  <th scope="col" className="text-right px-3 py-2">Peso (kg)</th>
                  <th scope="col" className="text-left px-3 py-2">Respuestas</th>
                  <th scope="col" className="text-left px-3 py-2">Mejor oferta</th>
                  <th scope="col" className="text-left px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">Todavia no hay cotizaciones de flete.</td></tr>
                )}
                {(data ?? []).map((c) => {
                  const resp = (Array.isArray(c.flete_cotizacion_respuestas) ? c.flete_cotizacion_respuestas : []) as { estado: string; monto: number | null; entidades: unknown }[];
                  const recibidas = resp.filter((r) => r.monto != null && r.estado !== "Rechazada" || r.estado === "Adjudicada");
                  const mejor = recibidas.length ? recibidas.reduce((a, b) => (Number(a.monto) <= Number(b.monto) ? a : b)) : null;
                  const ped = uno<{ num_pedido: string }>(c.pedidos);
                  const oc = uno<{ num_oc: string }>(c.ordenes_compra);
                  return (
                    <tr key={c.id} className="border-t border-gray-100 hover:bg-crema">
                      <th scope="row" className="text-left px-3 py-2">
                        <Link href={`/transportistas/cotizar/${c.id}`} className="text-verde font-semibold underline">{folioFlete(Number(c.id))}</Link>
                        <div className="font-normal text-gray-500">{String(c.creado_en).slice(0, 10)}</div>
                      </th>
                      <td className="px-3 py-2">{ped ? `Pedido ${ped.num_pedido}` : oc ? `OC ${oc.num_oc}` : "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{[c.origen, c.destino].filter(Boolean).join(" → ") || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.peso_kg == null ? "—" : Number(c.peso_kg).toLocaleString("es-CL")}</td>
                      <td className="px-3 py-2">{resp.filter((r) => r.monto != null).length} de {resp.length}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {mejor ? `${Number(mejor.monto).toLocaleString("es-CL")} · ${uno<{ razon_social: string }>(mejor.entidades)?.razon_social ?? ""}` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${COLOR[c.estado as string] ?? ""}`}>{c.estado}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
