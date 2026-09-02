import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { fecha as fmtFecha, pesos } from "@/lib/formato";

export const dynamic = "force-dynamic";

// Listado de pedidos. El pedido nace de una cotizacion aceptada y es el
// documento vivo desde ahi en adelante.
export default async function Pagina() {
  await requerirVendedor();
  const supabase = await createClient();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select(
      "id, num_pedido, fecha, estado, id_cotizacion, cotizaciones(num_cotizacion), clientes(razon_social), vendedores(nombre)"
    )
    .order("id", { ascending: false });

  const ids = (pedidos ?? []).map((p) => Number(p.id));

  // El saldo y si el pie esta cubierto salen de la vista de cuenta corriente:
  // ahi ya estan aplicados descuento e IVA.
  const { data: cuentas } = ids.length
    ? await supabase
        .from("v_pedido_cuenta")
        .select("id, total, saldo, pie_cubierto")
        .in("id", ids)
    : { data: [] as { id: number; total: number; saldo: number; pie_cubierto: boolean }[] };

  const cuentaPorPedido = new Map(
    (cuentas ?? []).map((c) => [
      Number(c.id),
      {
        total: Number(c.total),
        saldo: Number(c.saldo),
        pie_cubierto: Boolean(c.pie_cubierto),
      },
    ])
  );
  const [{ data: lineas }, { data: sols }] = await Promise.all([
    ids.length
      ? supabase
          .from("pedido_detalle")
          .select("id_pedido, unidades, valor_unitario")
          .in("id_pedido", ids)
      : Promise.resolve({ data: [] as { id_pedido: number; unidades: number; valor_unitario: number }[] }),
    ids.length
      ? supabase.from("solicitudes").select("id_pedido").in("id_pedido", ids)
      : Promise.resolve({ data: [] as { id_pedido: number }[] }),
  ]);

  const totalPorPedido = new Map<number, number>();
  for (const l of lineas ?? []) {
    const k = Number(l.id_pedido);
    totalPorPedido.set(
      k,
      (totalPorPedido.get(k) ?? 0) + Number(l.unidades) * Number(l.valor_unitario)
    );
  }
  const { data: facturas } = ids.length
    ? await supabase.from("facturas").select("id_pedido, numero").in("id_pedido", ids)
    : { data: [] as { id_pedido: number; numero: string }[] };
  const facturaDe = new Map(
    (facturas ?? []).map((f) => [Number(f.id_pedido), f.numero as string])
  );

  const solPorPedido = new Map<number, number>();
  for (const s of sols ?? []) {
    const k = Number(s.id_pedido);
    solPorPedido.set(k, (solPorPedido.get(k) ?? 0) + 1);
  }

  const uno = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Pedidos"
        subtitulo="Cotizaciones aceptadas y sus solicitudes a proveedores"
      />
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <BarraNavegacion>
          <Link
            href="/cobranza"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Estado de pago
          </Link>
          <Link
            href="/cotizaciones"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Cotizaciones
          </Link>
        </BarraNavegacion>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">N pedido</th>
                  <th className="text-left px-3 py-2">Cotizacion</th>
                  <th className="text-left px-3 py-2">Razon social</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Ejecutivo</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Solicitudes</th>
                  <th className="text-right px-3 py-2">Total con IVA</th>
                  <th className="text-right px-3 py-2">Saldo</th>
                  <th className="text-left px-3 py-2">Factura</th>
                </tr>
              </thead>
              <tbody>
                {(pedidos ?? []).length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-gray-400 py-8">
                      Todavia no hay pedidos. Se generan desde una cotizacion.
                    </td>
                  </tr>
                )}
                {(pedidos ?? []).map((p) => {
                  const cot = uno<{ num_cotizacion: string }>(p.cotizaciones);
                  const cli = uno<{ razon_social: string }>(p.clientes);
                  const ven = uno<{ nombre: string }>(p.vendedores);
                  const n = solPorPedido.get(Number(p.id)) ?? 0;
                  return (
                    <tr
                      key={p.id as number}
                      className="border-t border-gray-100 hover:bg-crema"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/pedidos/${p.id}`}
                          className="text-verde font-semibold underline"
                        >
                          {p.num_pedido}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/cotizaciones/${p.id_cotizacion}`}
                          className="text-gray-600 underline"
                        >
                          {cot?.num_cotizacion ?? ""}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{cli?.razon_social ?? ""}</td>
                      <td className="px-3 py-2">{fmtFecha(p.fecha as string)}</td>
                      <td className="px-3 py-2">{ven?.nombre ?? ""}</td>
                      <td className="px-3 py-2">{p.estado}</td>
                      <td className="px-3 py-2 text-right">
                        {n === 0 ? (
                          <span className="text-amber-700" title="Sin pedir">
                            0
                          </span>
                        ) : (
                          n
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {pesos(cuentaPorPedido.get(Number(p.id))?.total ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(() => {
                          const c = cuentaPorPedido.get(Number(p.id));
                          if (!c) return "";
                          return c.saldo === 0 ? (
                            <span className="text-green-700">pagado</span>
                          ) : !c.pie_cubierto ? (
                            <span className="text-amber-700" title="Falta el pie">
                              {pesos(c.saldo)}
                            </span>
                          ) : (
                            pesos(c.saldo)
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {facturaDe.get(Number(p.id)) ?? ""}
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
