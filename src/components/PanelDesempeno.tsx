import Link from "next/link";
import { pesos, fecha as fmtFecha, porcentaje } from "@/lib/formato";

// Tablero de la portada. Todo lo calcula panel_desempeno() en la base; aqui
// solo se pinta. El mes en curso se compara siempre con el anterior: un monto
// suelto no dice si el mes va bien o mal.
export interface Desempeno {
  mes: string;
  venta: {
    cotizado: number;
    cotizaciones: number;
    cotizado_anterior: number;
    vendido: number;
    pedidos: number;
    vendido_anterior: number;
    conversion: number | null;
    conversion_anterior: number | null;
    ticket: number;
  };
  margen: { pct: number | null; monto: number; objetivo: number };
  cobranza: {
    por_cobrar: number;
    pedidos_con_saldo: number;
    sin_pie: number;
    falta_pie: number;
    sin_factura: number;
    abonado_mes: number;
  };
  ranking: { nombre: string; cotizado: number; cotizaciones: number; vendido: number }[];
  clientes: { nombre: string; monto: number }[];
  pendientes: { id: number; fecha: string; cliente: string; total: number; dias: number }[];
  serie: { mes: string; cotizado: number; vendido: number }[];
}

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function nombreMes(iso: string) {
  const [a, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
}

// Variacion contra el mes anterior. Sin base de comparacion no se inventa un
// porcentaje: se dice que el mes anterior estaba en cero.
function variacion(actual: number, anterior: number) {
  if (!anterior) return actual > 0 ? { texto: "sin mes anterior", signo: 0 } : null;
  const pct = ((actual - anterior) / anterior) * 100;
  return {
    texto: `${pct >= 0 ? "+" : ""}${porcentaje(pct)} % vs ${pesos(anterior)}`,
    signo: Math.sign(pct),
  };
}

export default function PanelDesempeno({ d }: { d: Desempeno }) {
  const varCotizado = variacion(d.venta.cotizado, d.venta.cotizado_anterior);
  const varVendido = variacion(d.venta.vendido, d.venta.vendido_anterior);
  const tope = Math.max(
    1,
    ...d.serie.map((s) => Math.max(Number(s.cotizado), Number(s.vendido)))
  );
  const bajoObjetivo =
    d.margen.pct != null && d.margen.objetivo > 0 && d.margen.pct < d.margen.objetivo;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta
          titulo="Cotizado del mes"
          valor={pesos(d.venta.cotizado)}
          pie={`${d.venta.cotizaciones} cotizacion${d.venta.cotizaciones === 1 ? "" : "es"} · ticket ${pesos(d.venta.ticket)}`}
          nota={varCotizado?.texto}
          signo={varCotizado?.signo}
        />
        <Tarjeta
          titulo="Vendido del mes"
          valor={pesos(d.venta.vendido)}
          pie={`${d.venta.pedidos} pedido${d.venta.pedidos === 1 ? "" : "s"} generado${d.venta.pedidos === 1 ? "" : "s"}`}
          nota={varVendido?.texto}
          signo={varVendido?.signo}
          destacado
        />
        <Tarjeta
          titulo="Conversion"
          valor={d.venta.conversion == null ? "--" : `${porcentaje(d.venta.conversion)} %`}
          pie="cotizaciones del mes que ya son pedido"
          nota={
            d.venta.conversion_anterior == null
              ? undefined
              : `mes anterior ${porcentaje(d.venta.conversion_anterior)} %`
          }
        />
        <Tarjeta
          titulo="Margen del mes"
          valor={d.margen.pct == null ? "--" : `${porcentaje(d.margen.pct)} %`}
          pie={`${pesos(d.margen.monto)} sobre lo cotizado`}
          nota={d.margen.objetivo > 0 ? `objetivo ${porcentaje(d.margen.objetivo)} %` : undefined}
          signo={bajoObjetivo ? -1 : 0}
        />
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
            COTIZADO Y VENDIDO, ULTIMOS 6 MESES
          </div>
          <div className="p-4">
            <div className="flex items-end justify-between gap-3 h-40">
              {d.serie.map((s) => (
                <div key={s.mes} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-1 h-32 w-full justify-center">
                    <Barra valor={Number(s.cotizado)} tope={tope} clase="bg-dorado" />
                    <Barra valor={Number(s.vendido)} tope={tope} clase="bg-verde" />
                  </div>
                  <span className="text-[11px] text-gray-500">{nombreMes(s.mes)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-[11px] text-gray-600">
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-2 bg-dorado rounded-sm" /> Cotizado
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-2 bg-verde rounded-sm" /> Vendido
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
            COBRANZA
          </div>
          <div className="p-3 grid grid-cols-2 gap-3 text-sm">
            <Dato
              titulo="Por cobrar"
              valor={pesos(d.cobranza.por_cobrar)}
              pie={`${d.cobranza.pedidos_con_saldo} pedido${d.cobranza.pedidos_con_saldo === 1 ? "" : "s"} con saldo`}
            />
            <Dato titulo="Abonado del mes" valor={pesos(d.cobranza.abonado_mes)} />
            <Dato
              titulo="Sin el pie cubierto"
              valor={String(d.cobranza.sin_pie)}
              pie={d.cobranza.falta_pie > 0 ? `faltan ${pesos(d.cobranza.falta_pie)}` : undefined}
              alerta={d.cobranza.sin_pie > 0}
            />
            <Dato
              titulo="Sin factura emitida"
              valor={String(d.cobranza.sin_factura)}
              alerta={d.cobranza.sin_factura > 0}
            />
            <div className="col-span-2 flex gap-3 text-xs">
              <Link href="/cobranza" className="text-verde font-semibold underline">
                Estado de pago
              </Link>
              <Link href="/facturas" className="text-verde font-semibold underline">
                Facturas emitidas
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
            EQUIPO, ESTE MES
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Vendedor</th>
                  <th className="text-right px-3 py-2 w-16">Cot.</th>
                  <th className="text-right px-3 py-2 w-32">Cotizado</th>
                  <th className="text-right px-3 py-2 w-32">Vendido</th>
                </tr>
              </thead>
              <tbody>
                {d.ranking.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-6">
                      Todavia no hay movimiento este mes.
                    </td>
                  </tr>
                )}
                {d.ranking.map((r) => (
                  <tr key={r.nombre} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-semibold text-verde">{r.nombre}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.cotizaciones}</td>
                    <td className="px-3 py-2 text-right">{pesos(r.cotizado)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{pesos(r.vendido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
            CLIENTES CON MAS MONTO, 6 MESES
          </div>
          <ul className="p-3 space-y-2 text-sm">
            {d.clientes.length === 0 && (
              <li className="text-gray-400 text-center py-3">Sin cotizaciones en el periodo.</li>
            )}
            {d.clientes.map((c) => (
              <li key={c.nombre} className="flex justify-between gap-3">
                <span className="text-gray-700 truncate" title={c.nombre}>
                  {c.nombre}
                </span>
                <span className="font-semibold shrink-0">{pesos(c.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {d.pendientes.length > 0 && (
        <div className="bg-white border border-dorado rounded overflow-hidden">
          <div className="bg-crema text-dorado-osc text-xs font-semibold px-3 py-2">
            COTIZACIONES SIN RESPUESTA HACE MAS DE UNA SEMANA
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {d.pendientes.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <Link
                        href={`/cotizaciones/${p.id}`}
                        className="text-verde font-semibold underline"
                      >
                        {p.cliente || "(sin cliente)"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{fmtFecha(p.fecha)}</td>
                    <td className="px-3 py-2 text-right">{pesos(p.total)}</td>
                    <td className="px-3 py-2 text-right text-dorado-osc font-semibold">
                      {p.dias} dias
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Barra({ valor, tope, clase }: { valor: number; tope: number; clase: string }) {
  // Una barra en cero igual deja una linea de un pixel: se ve que el mes existe
  // y que no hubo movimiento.
  const alto = Math.max(1, Math.round((valor / tope) * 100));
  return (
    <div
      className={`${clase} w-1/2 rounded-t-sm`}
      style={{ height: `${alto}%` }}
      title={pesos(valor)}
    />
  );
}

function Tarjeta({
  titulo,
  valor,
  pie,
  nota,
  signo = 0,
  destacado,
}: {
  titulo: string;
  valor: string;
  pie?: string;
  nota?: string;
  signo?: number;
  destacado?: boolean;
}) {
  const color =
    signo > 0 ? "text-green-700" : signo < 0 ? "text-amber-700" : "text-gray-500";
  return (
    <div
      className={`rounded border p-3 ${
        destacado ? "bg-verde text-white border-verde" : "bg-white border-gray-200"
      }`}
    >
      <div
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          destacado ? "text-white/80" : "text-dorado-osc"
        }`}
      >
        {titulo}
      </div>
      <div className="text-xl font-bold mt-0.5">{valor}</div>
      {pie && (
        <div className={`text-[11px] mt-0.5 ${destacado ? "text-white/80" : "text-gray-500"}`}>
          {pie}
        </div>
      )}
      {nota && (
        <div className={`text-[11px] mt-1 ${destacado ? "text-white/90" : color}`}>{nota}</div>
      )}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  pie,
  alerta,
}: {
  titulo: string;
  valor: string;
  pie?: string;
  alerta?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-dorado-osc">
        {titulo}
      </div>
      <div className={`text-lg font-bold ${alerta ? "text-amber-700" : ""}`}>{valor}</div>
      {pie && <div className="text-[11px] text-gray-500">{pie}</div>}
    </div>
  );
}
