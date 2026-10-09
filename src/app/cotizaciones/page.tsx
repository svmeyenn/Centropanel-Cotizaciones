import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import FiltrosDocumentos, { type ValoresFiltro } from "@/components/FiltrosDocumentos";
import BotonEliminarFila from "@/components/BotonEliminarFila";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { etiquetaDe, ordenados } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import Bandera, { BanderaDe } from "@/components/Bandera";
import { createClient } from "@/lib/supabase/server";
import { importe, monedaDelPais, fecha as fmtFecha, coincideTelefono } from "@/lib/formato";

// Listado de cotizaciones, equivalente a frmCotizaciones. Los filtros se
// resuelven en el servidor (query string) y no filtrando en el navegador, para
// no traerse toda la tabla cuando el historial crezca.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<ValoresFiltro>;
}) {
  const v = await requerirVendedor();
  const cat = await catalogoEstados();
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
  const paisPorId = new Map(accesibles.map((p) => [p.id, p]));
  const etiquetaId =
    [...new Set(accesibles.map((p) => p.etiqueta_id ?? "RUT"))].join(" / ") || "RUT";
  const puedeBorrar = tienePerfilAdmin(v);

  // Los datos del cliente viven en su ficha: se buscan primero los que
  // coinciden y despues sus cotizaciones. Un or() sobre la tabla embebida
  // obligaria a join interno y dejaria fuera las cotizaciones sin cliente.
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
      .from("cotizaciones")
      .select(
        "id, num_cotizacion, fecha, estado, id_pais, clientes:entidades(razon_social, rut, contacto, comuna), vendedores(nombre)"
      ),
    idPaisActivo
  )
    .order("id", { ascending: false })
    .limit(200);

  if (q) {
    // En el filtro la coma, los parentesis y las comillas son sintaxis de
    // PostgREST y romperian la consulta.
    consulta = consulta.ilike("num_cotizacion", `%${q.replace(/[,()"\\]/g, " ")}%`);
  }
  if (desde) consulta = consulta.gte("fecha", desde);
  if (hasta) consulta = consulta.lte("fecha", hasta);
  if (estado) consulta = consulta.eq("estado", estado);
  // Sin clientes que coincidan no hay cotizaciones que mostrar; el in() vacio
  // de PostgREST no filtra nada, asi que se fuerza el vacio.
  if (filtraCliente) consulta = consulta.in("id_cliente", idsCliente.length ? idsCliente : [-1]);

  const { data: cots, error } = await consulta;

  // Los totales viven en la vista, que ya aplica descuento e IVA con la misma
  // formula del informe. Se piden aparte y se cruzan por id.
  const { data: totales } = await supabase
    .from("v_cotizacion_totales")
    .select("id, total");
  const totalPorId = new Map<number, number>(
    (totales ?? []).map((t) => [t.id as number, Number(t.total)])
  );

  // De que lead viene cada cotizacion de la lista: la base entrega solo los que esta persona puede ver.
  const { data: vinculos } =
    (cots ?? []).length > 0
      ? await supabase.rpc("cotizaciones_lead", { p_ids: (cots ?? []).map((c) => Number(c.id)) })
      : { data: [] };
  const leadDe = new Map(
    ((vinculos ?? []) as { id_cotizacion: number; id_clientify: number }[]).map((x) => [Number(x.id_cotizacion), Number(x.id_clientify)])
  );

  const columnas = 9 + (verPais ? 1 : 0) + (puedeBorrar ? 1 : 0);

  // Lo mismo que muestra la tabla, para bajarlo a una planilla.
  const uno2 = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);
  type CliFila = {
    razon_social: string;
    rut: string | null;
    contacto: string | null;
    comuna: string | null;
  };
  const filasExcel = (cots ?? []).map((c) => {
    const cli = uno2<CliFila>(c.clientes);
    const ven = uno2<{ nombre: string }>(c.vendedores);
    return [
      c.num_cotizacion as string,
      c.fecha as string,
      cli?.razon_social ?? "",
      cli?.rut ?? "",
      cli?.contacto ?? "",
      cli?.comuna ?? "",
      ven?.nombre ?? "",
      etiquetaDe(cat.cotizacion, c.estado as string),
      totalPorId.get(c.id as number) ?? 0,
    ] as (string | number | null)[];
  });

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Cotizaciones" subtitulo="Historial completo con busqueda" />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion>
          <Link
            href="/cotizaciones/nueva"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Nueva cotizacion
          </Link>
        </BarraNavegacion>

        <FiltrosDocumentos
          base="/cotizaciones"
          etiquetaFolio="N cotizacion"
          etiquetaId={etiquetaId}
          // Todos, tambien los que ya no se ofrecen: hay cotizaciones viejas en ellos.
          estados={ordenados(cat.cotizacion).map((x) => ({ valor: x.codigo, texto: x.etiqueta }))}
          valores={{ q, desde, hasta, rut, razon, contacto, fono, estado }}
          hayFiltro={hayFiltro}
          extra={
            <BotonExportarFilas
              nombre="cotizaciones"
              titulos={[
                "N cotizacion",
                "Fecha",
                "Cliente",
                etiquetaId,
                "Contacto",
                "Comuna",
                "Vendedor",
                "Estado",
                "Total",
              ]}
              filas={filasExcel}
            />
          }
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
            {error.message}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">N cotizacion</th>
                  {verPais && <th className="text-left px-2 py-1.5 whitespace-nowrap">Pais</th>}
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Razon social</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Contacto</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Comuna</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Fecha</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Ejecutivo</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Estado</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Total</th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Lead</th>
                  {puedeBorrar && <th className="px-2 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {(cots ?? []).length === 0 && (
                  <tr>
                    <td colSpan={columnas} className="text-center text-gray-400 py-8">
                      {hayFiltro
                        ? "Ninguna cotizacion coincide con el filtro."
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
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {!verPais && <BanderaDe idPais={c.id_pais as number} />}
                        <Link
                          href={`/cotizaciones/${c.id}`}
                          className="text-verde font-semibold underline"
                        >
                          {c.num_cotizacion}
                        </Link>
                      </td>
                      {verPais && (
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <CeldaPais pais={paisPorId.get(c.id_pais as number)} />
                        </td>
                      )}
                      <td className="px-2 py-1.5 w-full">{cli?.razon_social ?? ""}</td>
                      <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{cli?.contacto ?? ""}</td>
                      <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{cli?.comuna ?? ""}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtFecha(c.fecha as string)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{ven?.nombre ?? ""}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {etiquetaDe(cat.cotizacion, c.estado as string)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                        {importe(totalPorId.get(c.id as number) ?? 0, monedaDelPais(c.id_pais as number))}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {leadDe.has(Number(c.id)) && (
                          <Link href={`/leads/${leadDe.get(Number(c.id))}`} className="text-verde font-semibold underline">
                            Ver lead
                          </Link>
                        )}
                      </td>
                      {puedeBorrar && (
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <BotonEliminarFila
                            tipo="cotizacion"
                            id={Number(c.id)}
                            num={(c.num_cotizacion as string) ?? ""}
                          />
                        </td>
                      )}
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
