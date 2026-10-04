import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import FiltrosDocumentos, { type ValoresFiltro } from "@/components/FiltrosDocumentos";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { ESTADOS_PEDIDO } from "@/lib/estados";
import { nombreImpuesto } from "@/lib/impuesto";
import Bandera, { BanderaDe } from "@/components/Bandera";
import { createClient } from "@/lib/supabase/server";
import { fecha as fmtFecha, importe, monedaDelPais, coincideTelefono } from "@/lib/formato";

export const dynamic = "force-dynamic";

// Listado de pedidos. El pedido nace de una cotizacion aceptada y es el
// documento vivo desde ahi en adelante.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<ValoresFiltro>;
}) {
  const v = await requerirVendedor();
  const f = await searchParams;
  const limpio = (x?: string) => (x ?? "").trim();
  const q = limpio(f.q);
  const desde = limpio(f.desde);
  const hasta = limpio(f.hasta);
  const rut = limpio(f.rut);
  const razon = limpio(f.razon);
  const contacto = limpio(f.contacto);
  const fono = limpio(f.fono);
  const estado = limpio(f.estado);
  const filtraCliente = Boolean(rut || razon || contacto || fono);
  const hayFiltro = Boolean(q || desde || hasta || estado || filtraCliente);

  const supabase = await createClient();
  const { accesibles, idPaisActivo } = await contextoMercado(v);
  // Viendo los dos mercados juntos hace falta saber de cual es cada fila.
  const verPais = idPaisActivo == null && accesibles.length > 1;
  const impuesto = nombreImpuesto(accesibles, idPaisActivo);
  const paisPorId = new Map(accesibles.map((p) => [p.id, p]));
  const etiquetaId =
    [...new Set(accesibles.map((p) => p.etiqueta_id ?? "RUT"))].join(" / ") || "RUT";

  // Los datos del cliente viven en su ficha: primero los clientes que
  // coinciden, despues sus pedidos.
  let idsCliente: number[] = [];
  if (filtraCliente) {
    let cq = conPais(
      supabase.from("clientes").select("id, telefono"),
      idPaisActivo
    );
    if (rut) cq = cq.ilike("rut", `%${rut}%`);
    if (razon) cq = cq.ilike("razon_social", `%${razon}%`);
    if (contacto) cq = cq.ilike("contacto", `%${contacto}%`);
    const { data: clis } = await cq;
    // El telefono no se filtra en la consulta: el mismo numero esta escrito de
    // varias formas en las fichas y un like sobre el texto dejaria fuera al que
    // se busca. Se comparan los digitos sobre la lista de clientes, que es
    // corta, en vez de sobre el historial de documentos, que no lo es.
    const conFono = fono
      ? (clis ?? []).filter((c) => coincideTelefono(c.telefono as string | null, fono))
      : (clis ?? []);
    idsCliente = conFono.map((c) => c.id as number);
  }

  let consulta = conPais(
    supabase
      .from("pedidos")
      .select(
        "id, num_pedido, fecha, estado, id_pais, id_cotizacion, cotizaciones(num_cotizacion), clientes:entidades(razon_social, rut, contacto, comuna), vendedores(nombre)"
      ),
    idPaisActivo
  ).order("id", { ascending: false });

  if (q) consulta = consulta.ilike("num_pedido", `%${q.replace(/[,()"\\]/g, " ")}%`);
  if (desde) consulta = consulta.gte("fecha", desde);
  if (hasta) consulta = consulta.lte("fecha", hasta);
  if (estado) consulta = consulta.eq("estado", estado);
  if (filtraCliente) consulta = consulta.in("id_cliente", idsCliente.length ? idsCliente : [-1]);

  const { data: pedidos } = await consulta;

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

  const { data: sols } = ids.length
    ? await supabase.from("solicitudes").select("id_pedido").in("id_pedido", ids)
    : { data: [] as { id_pedido: number }[] };

  // Un pedido puede llevar varios documentos --anticipo, saldo, nota de
  // credito--, asi que la columna muestra los folios juntos.
  const { data: facturas } = ids.length
    ? await supabase
        .from("facturas")
        .select("id_pedido, numero, tipo")
        .in("id_pedido", ids)
        .order("fecha")
    : { data: [] as { id_pedido: number; numero: string; tipo: string }[] };
  const facturaDe = new Map<number, string>();
  for (const f of facturas ?? []) {
    const k = Number(f.id_pedido);
    const folio =
      (f.tipo as string) === "Nota de credito"
        ? `NC ${f.numero as string}`
        : (f.numero as string);
    facturaDe.set(k, facturaDe.has(k) ? `${facturaDe.get(k)} / ${folio}` : folio);
  }

  const solPorPedido = new Map<number, number>();
  for (const s of sols ?? []) {
    const k = Number(s.id_pedido);
    solPorPedido.set(k, (solPorPedido.get(k) ?? 0) + 1);
  }

  const uno = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);

  // Lo mismo que muestra la tabla, para bajarlo a una planilla.
  const filasExcel = (pedidos ?? []).map((p) => {
    const cot = uno<{ num_cotizacion: string }>(p.cotizaciones);
    const cli = uno<{
      razon_social: string;
      rut: string | null;
      contacto: string | null;
      comuna: string | null;
    }>(p.clientes);
    const ven = uno<{ nombre: string }>(p.vendedores);
    const c = cuentaPorPedido.get(Number(p.id));
    return [
      p.num_pedido as string,
      cot?.num_cotizacion ?? "",
      p.fecha as string,
      cli?.razon_social ?? "",
      cli?.rut ?? "",
      cli?.contacto ?? "",
      cli?.comuna ?? "",
      ven?.nombre ?? "",
      p.estado as string,
      solPorPedido.get(Number(p.id)) ?? 0,
      c?.total ?? 0,
      c?.saldo ?? 0,
      facturaDe.get(Number(p.id)) ?? "",
    ] as (string | number | null)[];
  });

  const columnas = 12 + (verPais ? 1 : 0);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Pedidos"
        subtitulo="Cotizaciones aceptadas y sus solicitudes a proveedores"
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
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

        <FiltrosDocumentos
          base="/pedidos"
          etiquetaFolio="N pedido"
          etiquetaId={etiquetaId}
          estados={ESTADOS_PEDIDO}
          valores={{ q, desde, hasta, rut, razon, contacto, fono, estado }}
          hayFiltro={hayFiltro}
          extra={
            <BotonExportarFilas
              nombre="pedidos"
              titulos={[
                "N pedido",
                "N cotizacion",
                "Fecha",
                "Cliente",
                etiquetaId,
                "Contacto",
                "Comuna",
                "Vendedor",
                "Estado",
                "Solicitudes",
                "Total",
                "Saldo",
                "Factura",
              ]}
              filas={filasExcel}
            />
          }
        />

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">N pedido</th>
                  {verPais && <th className="text-left px-3 py-2">Pais</th>}
                  <th className="text-left px-3 py-2">Cotizacion</th>
                  <th className="text-left px-3 py-2">Razon social</th>
                  <th className="text-left px-3 py-2">Contacto</th>
                  <th className="text-left px-3 py-2">Comuna</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Ejecutivo</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Solicitudes</th>
                  <th className="text-right px-3 py-2">Total con {impuesto}</th>
                  <th className="text-right px-3 py-2">Saldo</th>
                  <th className="text-left px-3 py-2">Factura</th>
                </tr>
              </thead>
              <tbody>
                {(pedidos ?? []).length === 0 && (
                  <tr>
                    <td colSpan={columnas} className="text-center text-gray-400 py-8">
                      {hayFiltro
                        ? "Ningun pedido coincide con el filtro."
                        : "Todavia no hay pedidos. Se generan desde una cotizacion."}
                    </td>
                  </tr>
                )}
                {(pedidos ?? []).map((p) => {
                  const cot = uno<{ num_cotizacion: string }>(p.cotizaciones);
                  const cli = uno<{ razon_social: string; contacto: string | null; comuna: string | null }>(
                    p.clientes
                  );
                  const ven = uno<{ nombre: string }>(p.vendedores);
                  const n = solPorPedido.get(Number(p.id)) ?? 0;
                  return (
                    <tr
                      key={p.id as number}
                      className="border-t border-gray-100 hover:bg-crema"
                    >
                      <td className="px-3 py-2">
                        {!verPais && <BanderaDe idPais={p.id_pais as number} />}
                        <Link
                          href={`/pedidos/${p.id}`}
                          className="text-verde font-semibold underline"
                        >
                          {p.num_pedido}
                        </Link>
                      </td>
                      {verPais && (
                        <td className="px-3 py-2">
                          <CeldaPais pais={paisPorId.get(p.id_pais as number)} />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <Link
                          href={`/cotizaciones/${p.id_cotizacion}`}
                          className="text-gray-600 underline"
                        >
                          {cot?.num_cotizacion ?? ""}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{cli?.razon_social ?? ""}</td>
                      <td className="px-3 py-2 text-gray-600">{cli?.contacto ?? ""}</td>
                      <td className="px-3 py-2 text-gray-600">{cli?.comuna ?? ""}</td>
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
                        {importe(cuentaPorPedido.get(Number(p.id))?.total ?? 0, monedaDelPais(p.id_pais as number))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(() => {
                          const c = cuentaPorPedido.get(Number(p.id));
                          if (!c) return "";
                          return c.saldo === 0 ? (
                            <span className="text-green-700">pagado</span>
                          ) : !c.pie_cubierto ? (
                            <span className="text-amber-700" title="Falta el pie">
                              {importe(c.saldo, monedaDelPais(p.id_pais as number))}
                            </span>
                          ) : (
                            importe(c.saldo, monedaDelPais(p.id_pais as number))
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

function CeldaPais({ pais }: { pais?: { codigo: string; nombre: string } }) {
  if (!pais) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Bandera codigo={pais.codigo} />
      {pais.nombre}
    </span>
  );
}
