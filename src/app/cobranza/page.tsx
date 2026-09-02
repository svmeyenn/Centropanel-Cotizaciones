import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { pesos, porcentaje, fecha as fmtFecha } from "@/lib/formato";

export const dynamic = "force-dynamic";

type Estado = "Pagado" | "Falta el pie" | "Con saldo";

const FILTROS: { clave: string; texto: string }[] = [
  { clave: "", texto: "Todos" },
  { clave: "pie", texto: "Falta el pie" },
  { clave: "saldo", texto: "Con saldo" },
  { clave: "pagado", texto: "Pagados" },
  { clave: "sinfactura", texto: "Sin facturar" },
];

// Estado de pago de cada pedido, en una sola pantalla. El listado de pedidos
// mira la produccion; esta mira la caja: quien debe, cuanto y desde cuando.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  await requerirVendedor();
  const { f: filtro = "" } = await searchParams;
  const supabase = await createClient();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select(
      "id, num_pedido, fecha, estado, clientes(razon_social), vendedores(nombre), formas_pago(descripcion), medios_pago(nombre)"
    )
    .order("id", { ascending: false });

  const ids = (pedidos ?? []).map((p) => Number(p.id));

  const [{ data: cuentas }, { data: pagos }, { data: facturas }] = await Promise.all([
    ids.length
      ? supabase.from("v_pedido_cuenta").select("*").in("id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabase
          .from("pagos_pedido")
          .select("id_pedido, fecha, monto")
          .in("id_pedido", ids)
          .order("fecha", { ascending: false })
      : Promise.resolve({ data: [] as { id_pedido: number; fecha: string }[] }),
    ids.length
      ? supabase
          .from("facturas")
          .select("id_pedido, numero, fecha")
          .in("id_pedido", ids)
      : Promise.resolve({
          data: [] as { id_pedido: number; numero: string; fecha: string }[],
        }),
  ]);

  const cuentaDe = new Map(
    (cuentas ?? []).map((c) => [Number(c.id), c as Record<string, unknown>])
  );
  // Fecha del ultimo abono: dice si la cobranza esta viva o quedo detenida.
  const ultimoPago = new Map<number, string>();
  for (const g of pagos ?? []) {
    const k = Number(g.id_pedido);
    if (!ultimoPago.has(k)) ultimoPago.set(k, g.fecha as string);
  }

  // Facturado es lo que tiene factura emitida, no lo vendido: un pedido sin
  // factura esta pendiente de facturar, por mucho que ya este pagado.
  const facturaDe = new Map(
    (facturas ?? []).map((f) => [
      Number(f.id_pedido),
      { numero: f.numero as string, fecha: f.fecha as string },
    ])
  );

  const uno = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);

  const filas = (pedidos ?? []).map((p) => {
    const c = cuentaDe.get(Number(p.id));
    const total = Number(c?.total ?? 0);
    const abonado = Number(c?.abonado ?? 0);
    const saldo = Number(c?.saldo ?? 0);
    const pieCubierto = Boolean(c?.pie_cubierto);
    const estado: Estado =
      saldo <= 0 ? "Pagado" : !pieCubierto ? "Falta el pie" : "Con saldo";
    return {
      id: Number(p.id),
      num: p.num_pedido as string,
      fecha: p.fecha as string,
      cliente: uno<{ razon_social: string }>(p.clientes)?.razon_social ?? "",
      vendedor: uno<{ nombre: string }>(p.vendedores)?.nombre ?? "",
      forma: uno<{ descripcion: string }>(p.formas_pago)?.descripcion ?? "",
      medio: uno<{ nombre: string }>(p.medios_pago)?.nombre ?? "",
      total,
      pie: Number(c?.pie_monto ?? 0),
      abonado,
      saldo,
      avance: total > 0 ? (abonado / total) * 100 : 0,
      estado,
      ultimo: ultimoPago.get(Number(p.id)) ?? null,
      factura: facturaDe.get(Number(p.id)) ?? null,
    };
  });

  const visibles = filas.filter((r) =>
    filtro === "pie"
      ? r.estado === "Falta el pie"
      : filtro === "saldo"
        ? r.estado === "Con saldo"
        : filtro === "pagado"
          ? r.estado === "Pagado"
          : filtro === "sinfactura"
            ? r.factura == null
            : true
  );

  const sum = (f: (r: (typeof filas)[number]) => number) =>
    visibles.reduce((s, r) => s + f(r), 0);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Estado de pago"
        subtitulo="Cuanto se cobro y cuanto falta en cada pedido"
      />
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <BarraNavegacion>
          <Link
            href="/pedidos"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Pedidos
          </Link>
        </BarraNavegacion>

        {/* Las seis cifras en una linea: se leen de un vistazo y en el orden
            en que se miran, de lo vendido a lo facturado. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <Tarjeta titulo="Pedidos" valor={String(visibles.length)} />
          <Tarjeta titulo="Total pedidos" valor={pesos(sum((r) => r.total))} />
          <Tarjeta
            titulo="Por cobrar"
            valor={pesos(sum((r) => Math.max(r.saldo, 0)))}
            destacado
          />
          <Tarjeta
            titulo="Pendiente de factura"
            valor={pesos(sum((r) => (r.factura ? 0 : r.total)))}
          />
          <Tarjeta titulo="Abonado" valor={pesos(sum((r) => r.abonado))} />
          <Tarjeta
            titulo="Facturado"
            valor={pesos(sum((r) => (r.factura ? r.total : 0)))}
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {FILTROS.map((x) => (
            <Link
              key={x.clave || "todos"}
              href={x.clave ? `/cobranza?f=${x.clave}` : "/cobranza"}
              className={
                (filtro === x.clave
                  ? "bg-verde text-white "
                  : "border border-gray-300 text-gray-700 hover:bg-white ") +
                "text-xs font-semibold px-2.5 py-1 rounded"
              }
            >
              {x.texto}
            </Link>
          ))}
          <span className="text-xs text-gray-500 ml-auto">
            {visibles.length} de {filas.length}
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">N pedido</th>
                  <th className="text-left px-3 py-2">Razon social</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Condicion</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Pie</th>
                  <th className="text-right px-3 py-2">Abonado</th>
                  <th className="text-right px-3 py-2">Saldo</th>
                  <th className="text-left px-3 py-2 w-32">Avance</th>
                  <th className="text-left px-3 py-2">Ultimo abono</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Factura</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center text-gray-400 py-8">
                      {filas.length === 0
                        ? "Todavia no hay pedidos."
                        : "Ningun pedido en ese estado."}
                    </td>
                  </tr>
                )}
                {visibles.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-crema"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/pedidos/${r.id}`}
                        className="text-verde font-semibold underline"
                      >
                        {r.num}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.cliente}</td>
                    <td className="px-3 py-2">{fmtFecha(r.fecha)}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.forma}
                      {r.medio ? ` · ${r.medio}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {pesos(r.total)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {r.pie > 0 ? pesos(r.pie) : "--"}
                    </td>
                    <td className="px-3 py-2 text-right">{pesos(r.abonado)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {pesos(Math.max(r.saldo, 0))}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-200 rounded overflow-hidden">
                          <div
                            className={
                              r.estado === "Pagado"
                                ? "h-full bg-green-600"
                                : r.estado === "Falta el pie"
                                  ? "h-full bg-amber-500"
                                  : "h-full bg-verde"
                            }
                            style={{
                              width: `${Math.min(Math.max(r.avance, 0), 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-gray-500">
                          {porcentaje(r.avance)} %
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.ultimo ? fmtFecha(r.ultimo) : "sin abonos"}
                    </td>
                    <td className="px-3 py-2">
                      {r.estado === "Pagado" ? (
                        <span className="text-green-700 font-semibold">
                          Pagado
                        </span>
                      ) : r.estado === "Falta el pie" ? (
                        <span className="text-amber-700 font-semibold">
                          Falta el pie
                        </span>
                      ) : (
                        <span className="text-gray-700">Con saldo</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.factura ? (
                        <span className="text-gray-700">{r.factura.numero}</span>
                      ) : (
                        <span className="text-amber-700">pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          El total incluye IVA y el recargo del medio de pago, que es lo que el
          cliente tiene que transferir. Facturado es lo que ya tiene factura
          emitida: un pedido pagado sigue pendiente de factura hasta que se
          registre. Un pedido con el pie pendiente no puede pedir insumos a los
          proveedores.
        </p>
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
    <div className={`rounded p-2.5 ${destacado ? "bg-crema" : "bg-gray-50"}`}>
      <div className="text-[11px] leading-tight text-gray-500">{titulo}</div>
      <div
        className={`font-bold text-sm whitespace-nowrap ${destacado ? "text-verde" : "text-gray-800"}`}
      >
        {valor}
      </div>
    </div>
  );
}
