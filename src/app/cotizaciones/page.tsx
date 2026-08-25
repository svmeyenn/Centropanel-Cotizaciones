import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { pesos, fecha as fmtFecha } from "@/lib/formato";

// Listado de cotizaciones, equivalente a frmCotizaciones. La busqueda se
// resuelve en el servidor (query string) y no filtrando en el navegador, para
// no traerse toda la tabla cuando el historial crezca.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requerirVendedor();
  const { q } = await searchParams;
  const busca = (q ?? "").trim();

  const supabase = await createClient();

  let consulta = supabase
    .from("cotizaciones")
    .select(
      "id, num_cotizacion, fecha, estado, clientes(razon_social), vendedores(nombre)"
    )
    .order("id", { ascending: false })
    .limit(200);

  if (busca) {
    consulta = consulta.ilike("num_cotizacion", `%${busca}%`);
  }

  const { data: cots, error } = await consulta;

  // Los totales viven en la vista, que ya aplica descuento e IVA con la misma
  // formula del informe. Se piden aparte y se cruzan por id.
  const { data: totales } = await supabase
    .from("v_cotizacion_totales")
    .select("id, total");
  const totalPorId = new Map<number, number>(
    (totales ?? []).map((t) => [t.id as number, Number(t.total)])
  );

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Cotizaciones" subtitulo="Historial completo con busqueda" />
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar por folio (ej: COT00001)"
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
            />
            <button className="bg-verde text-white text-sm font-semibold px-3 py-1.5 rounded">
              Buscar
            </button>
            {busca && (
              <Link
                href="/cotizaciones"
                className="text-sm text-gray-600 underline self-center"
              >
                limpiar
              </Link>
            )}
          </form>
          <BarraNavegacion>
            <Link
              href="/cotizaciones/nueva"
              className="bg-verde text-white text-sm font-semibold px-3 py-1.5 rounded"
            >
              Nueva cotizacion
            </Link>
          </BarraNavegacion>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
            {error.message}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">N cotizacion</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2 w-28">Fecha</th>
                  <th className="text-left px-3 py-2">Ejecutivo</th>
                  <th className="text-left px-3 py-2 w-28">Estado</th>
                  <th className="text-right px-3 py-2 w-32">Total</th>
                </tr>
              </thead>
              <tbody>
                {(cots ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8">
                      {busca
                        ? "Ninguna cotizacion coincide con la busqueda."
                        : "Todavia no hay cotizaciones."}
                    </td>
                  </tr>
                )}
                {(cots ?? []).map((c) => {
                  // El join de PostgREST llega como objeto o arreglo segun la
                  // cardinalidad que infiera; se normaliza para no romper.
                  const cli = Array.isArray(c.clientes) ? c.clientes[0] : c.clientes;
                  const ven = Array.isArray(c.vendedores)
                    ? c.vendedores[0]
                    : c.vendedores;
                  return (
                    <tr
                      key={c.id as number}
                      className="border-t border-gray-100 hover:bg-crema"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/cotizaciones/${c.id}`}
                          className="text-verde font-semibold underline"
                        >
                          {c.num_cotizacion}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{cli?.razon_social ?? ""}</td>
                      <td className="px-3 py-2">{fmtFecha(c.fecha as string)}</td>
                      <td className="px-3 py-2">{ven?.nombre ?? ""}</td>
                      <td className="px-3 py-2">{c.estado}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {pesos(totalPorId.get(c.id as number) ?? 0)}
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
