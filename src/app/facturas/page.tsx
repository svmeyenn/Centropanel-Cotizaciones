import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { pesos, fecha as fmtFecha } from "@/lib/formato";

export const dynamic = "force-dynamic";

// Facturas emitidas. El estado de pago mira la caja pedido por pedido; esta
// mira lo facturado: que se emitio, por cuanto y contra que pedido, que es lo
// que se cuadra con el contador a fin de mes.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string }>;
}) {
  await requerirVendedor();
  const { q, desde, hasta } = await searchParams;
  const supabase = await createClient();

  let consulta = supabase
    .from("facturas")
    .select(
      "id, numero, fecha, neto, iva, total, archivo, pedidos(id, num_pedido, clientes(razon_social)), vendedores(nombre)"
    )
    .order("fecha", { ascending: false })
    .order("id", { ascending: false });

  if (desde) consulta = consulta.gte("fecha", desde);
  if (hasta) consulta = consulta.lte("fecha", hasta);

  const { data } = await consulta;

  const uno = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);

  type Ped = { id: number; num_pedido: string; clientes: unknown };

  const filas = (data ?? []).map((f) => {
    const ped = uno<Ped>(f.pedidos);
    const cli = uno<{ razon_social: string }>(ped?.clientes);
    return {
      id: Number(f.id),
      numero: f.numero as string,
      fecha: f.fecha as string,
      neto: Number(f.neto),
      iva: Number(f.iva),
      total: Number(f.total),
      tieneArchivo: Boolean(f.archivo),
      idPedido: ped ? Number(ped.id) : null,
      numPedido: ped?.num_pedido ?? "",
      cliente: cli?.razon_social ?? "",
    };
  });

  // El filtro por texto se resuelve aqui y no en la consulta: el cliente y el
  // numero de pedido vienen de tablas relacionadas, y filtrarlos en Postgres
  // obligaria a crear una vista solo para esto.
  const texto = (q ?? "").trim().toLowerCase();
  const visibles = texto
    ? filas.filter(
        (f) =>
          f.numero.toLowerCase().includes(texto) ||
          f.cliente.toLowerCase().includes(texto) ||
          f.numPedido.toLowerCase().includes(texto)
      )
    : filas;

  const totalNeto = visibles.reduce((s, f) => s + f.neto, 0);
  const totalIva = visibles.reduce((s, f) => s + f.iva, 0);
  const total = visibles.reduce((s, f) => s + f.total, 0);
  const sinArchivo = visibles.filter((f) => !f.tieneArchivo).length;

  const campo = "border border-gray-300 rounded px-2 py-1 text-sm";

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Facturas emitidas"
        subtitulo="Lo facturado, por cuanto y contra que pedido"
      />
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <BarraNavegacion />

        <form className="bg-white border border-gray-200 rounded p-3 flex flex-wrap gap-2 items-end">
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Buscar
            </span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="N de factura, cliente o pedido"
              className={`${campo} w-64`}
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Desde
            </span>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className={campo}
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Hasta
            </span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className={campo}
            />
          </label>
          <button
            type="submit"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Filtrar
          </button>
          <Link
            href="/facturas"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Limpiar
          </Link>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tarjeta titulo="Facturas" valor={String(visibles.length)} />
          <Tarjeta titulo="Neto" valor={pesos(totalNeto)} />
          <Tarjeta titulo="IVA" valor={pesos(totalIva)} />
          <Tarjeta titulo="Total facturado" valor={pesos(total)} destacado />
        </div>

        {sinArchivo > 0 && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded p-3">
            {sinArchivo === 1
              ? "Hay 1 factura sin el documento adjunto."
              : `Hay ${sinArchivo} facturas sin el documento adjunto.`}{" "}
            Se sube desde el pedido, en el bloque de facturacion.
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2 w-28">N factura</th>
                  <th className="text-left px-3 py-2 w-28">Fecha</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2 w-28">Pedido</th>
                  <th className="text-right px-3 py-2 w-28">Neto</th>
                  <th className="text-right px-3 py-2 w-28">IVA</th>
                  <th className="text-right px-3 py-2 w-32">Total</th>
                  <th className="text-left px-3 py-2 w-24">Documento</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No hay facturas que cumplan el filtro.
                    </td>
                  </tr>
                ) : (
                  visibles.map((f) => (
                    <tr
                      key={f.id}
                      className="border-t border-gray-100 hover:bg-crema"
                    >
                      <td className="px-3 py-2 font-semibold text-verde">
                        {f.numero}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {fmtFecha(f.fecha)}
                      </td>
                      <td className="px-3 py-2">{f.cliente}</td>
                      <td className="px-3 py-2">
                        {f.idPedido ? (
                          <Link
                            href={`/pedidos/${f.idPedido}`}
                            className="text-verde underline"
                          >
                            {f.numPedido}
                          </Link>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{pesos(f.neto)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {pesos(f.iva)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {pesos(f.total)}
                      </td>
                      <td className="px-3 py-2">
                        {f.tieneArchivo ? (
                          <span className="text-green-700">adjunto</span>
                        ) : (
                          <span className="text-amber-700">falta</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded p-3 border ${
        destacado ? "bg-crema border-dorado" : "bg-white border-gray-200"
      }`}
    >
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className={`font-bold ${destacado ? "text-verde" : "text-gray-800"}`}>
        {valor}
      </div>
    </div>
  );
}
