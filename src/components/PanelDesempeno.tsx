import Link from "next/link";
import { pesos, pesosCorto, fecha as fmtFecha, porcentaje } from "@/lib/formato";
import SelectorMes from "@/components/SelectorMes";
import TituloOrden, { BarraOrden } from "@/components/TituloOrden";
import { CLIENTES, EQUIPO } from "@/components/inicio/orden";
import { ordenar, type Orden } from "@/lib/ordenTabla";
import { conMarca, etiquetaDe } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";

// Tablero de la portada. Todo lo calcula panel_desempeno() en la base; aqui
// solo se pinta. Dos reglas: el mes en curso se compara siempre con el
// anterior, y ninguna tasa va sola --cada porcentaje lleva el monto o el
// conteo del que sale, y cada monto lleva su tasa.
export interface Desempeno {
  mes: string;
  meses: string[];
  venta: {
    cotizado: number;
    cotizaciones: number;
    cotizado_anterior: number;
    cotizaciones_anterior: number;
    vendido: number;
    pedidos: number;
    vendido_anterior: number;
    pedidos_anterior: number;
    convertidas: number;
    monto_convertido: number;
    conversion: number | null;
    conversion_anterior: number | null;
    ticket: number;
  };
  margen: {
    pct: number | null;
    monto: number;
    neto: number;
    costo: number;
    objetivo: number;
  };
  cobranza: {
    comprometido: number;
    pedidos: number;
    por_cobrar: number;
    por_cobrar_pct: number;
    pedidos_con_saldo: number;
    sin_pie: number;
    falta_pie: number;
    sin_factura: number;
    monto_sin_factura: number;
    abonado_mes: number;
    pagos_mes: number;
    abonado_pct: number | null;
  };
  ranking: {
    nombre: string;
    cotizado: number;
    cotizaciones: number;
    vendido: number;
    pedidos: number;
    conversion: number | null;
    parte: number;
  }[];
  clientes: { nombre: string; monto: number; cotizaciones: number; parte: number }[];
  pendientes: { id: number; fecha: string; cliente: string; total: number; dias: number }[];
  pendientes_n: number;
  pendientes_monto: number;
  // Lo que hay que entregar: lo atrasado y las dos semanas que vienen.
  entregas: {
    id: number;
    num: string;
    entrega: string;
    cliente: string;
    total: number;
    dias: number;
  }[];
  entregas_atrasadas: number;
  entregas_proximas: number;
  // Lo emitido en el mes, que no es lo mismo que lo vendido.
  facturado_mes: number;
  facturas_mes: number;
  // Lo que todavia esta en juego, por estado.
  embudo: { estado: string; n: number; monto: number }[];
  // Cada mes de la serie: lo cotizado, lo vendido y lo facturado, con los
  // conteos para poder mostrar la conversion mes a mes.
  serie: {
    mes: string;
    cotizado: number;
    vendido: number;
    facturado: number;
    cotizaciones: number;
    convertidas: number;
    pedidos: number;
  }[];
}

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function nombreMes(iso: string) {
  const [a, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
}

// Variacion contra el mes anterior, en tasa y en monto. Sin base de
// comparacion no se inventa un porcentaje.
function variacion(actual: number, anterior: number) {
  if (!anterior) return actual > 0 ? { texto: "sin mes anterior", signo: 0 } : null;
  const pct = ((actual - anterior) / anterior) * 100;
  const dif = actual - anterior;
  return {
    texto: `${pct >= 0 ? "+" : ""}${porcentaje(pct)} % (${dif >= 0 ? "+" : "-"}${pesos(Math.abs(dif))}) vs ${pesos(anterior)}`,
    signo: Math.sign(pct),
  };
}

// El ancho de cada columna del equipo, que antes estaba en cada <th>.
const ANCHO: Record<string, string | undefined> = {
  cotizado: "w-28",
  parte: "w-20",
  vendido: "w-28",
  conversion: "w-24",
};

export default async function PanelDesempeno({
  d,
  qs,
  ordenEquipo,
  ordenClientes,
}: {
  d: Desempeno;
  qs: string;
  ordenEquipo: Orden;
  ordenClientes: Orden;
}) {
  // Los estados de una cotizacion que todavia se puede ganar, en el orden en que
  // avanza: los que tengan esa marca, sean cuales sean.
  const cat = await catalogoEstados();
  const ENJUEGO = conMarca(cat.cotizacion, "en_juego");
  // Las dos llegan completas: se ordenan aqui, en el servidor, con el criterio
  // que dice la direccion web.
  const ranking = ordenar(d.ranking, ordenEquipo, (r, c) =>
    c === "vendedor" ? r.nombre : Number(r[c as keyof typeof r] ?? 0)
  );
  const clientes = ordenar(d.clientes, ordenClientes, (x, c) =>
    c === "cliente" ? x.nombre : Number(x[c as keyof typeof x] ?? 0)
  );
  const varCotizado = variacion(d.venta.cotizado, d.venta.cotizado_anterior);
  const varVendido = variacion(d.venta.vendido, d.venta.vendido_anterior);
  const tope = Math.max(
    1,
    ...d.serie.map((s) => Math.max(Number(s.cotizado), Number(s.vendido), Number(s.facturado ?? 0)))
  );
  const topeEmbudo = Math.max(1, ...(d.embudo ?? []).map((e) => Number(e.monto)));
  const bajoObjetivo =
    d.margen.pct != null && d.margen.objetivo > 0 && d.margen.pct < d.margen.objetivo;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-600">
          Cotizado, vendido, facturado y cobrado en el mes que elija.
        </p>
        <SelectorMes mes={d.mes} meses={d.meses} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Tarjeta
          titulo="Cotizado del mes"
          valor={pesos(d.venta.cotizado)}
          pie={`${d.venta.cotizaciones} cot. · ticket ${pesos(d.venta.ticket)}`}
          nota={varCotizado?.texto}
          signo={varCotizado?.signo}
        />
        <Tarjeta
          titulo="Vendido del mes"
          valor={pesos(d.venta.vendido)}
          pie={`${d.venta.pedidos} pedido${d.venta.pedidos === 1 ? "" : "s"} · ${
            d.venta.cotizado > 0
              ? `${porcentaje((d.venta.vendido / d.venta.cotizado) * 100)} % de lo cotizado`
              : "sin cotizaciones"
          }`}
          nota={varVendido?.texto}
          signo={varVendido?.signo}
          destacado
        />
        {/* Vender y facturar no son lo mismo: lo que falta entre las dos
            cifras es lo que hay que ir a emitir. */}
        <Tarjeta
          titulo="Facturado del mes"
          valor={pesos(d.facturado_mes ?? 0)}
          pie={`${d.facturas_mes ?? 0} documento${
            (d.facturas_mes ?? 0) === 1 ? "" : "s"
          } · ${
            d.venta.vendido > 0
              ? `${porcentaje(((d.facturado_mes ?? 0) / d.venta.vendido) * 100)} % de lo vendido`
              : "sin pedidos del mes"
          }`}
        />
        <Tarjeta
          titulo="Conversion"
          valor={d.venta.conversion == null ? "--" : `${porcentaje(d.venta.conversion)} %`}
          pie={`${d.venta.convertidas} de ${d.venta.cotizaciones} cot. · ${pesos(d.venta.monto_convertido)}`}
          nota={
            d.venta.conversion_anterior == null
              ? undefined
              : `mes anterior ${porcentaje(d.venta.conversion_anterior)} % (${d.venta.cotizaciones_anterior} cot.)`
          }
        />
        <Tarjeta
          titulo="Margen del mes"
          valor={d.margen.pct == null ? "--" : `${porcentaje(d.margen.pct)} %`}
          pie={`${pesos(d.margen.monto)} sobre neto ${pesos(d.margen.neto)}`}
          nota={
            d.margen.objetivo > 0
              ? `objetivo ${porcentaje(d.margen.objetivo)} %${
                  bajoObjetivo && d.margen.pct != null
                    ? ` · faltan ${pesos(Math.round((d.margen.objetivo / 100) * d.margen.neto - d.margen.monto))}`
                    : ""
                }`
              : undefined
          }
          signo={bajoObjetivo ? -1 : 0}
        />
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-2.5">
        <Caja titulo={`Cotizado, vendido y facturado, 6 meses hasta ${nombreMes(d.mes)}`}>
          <div className="p-3">
            <div className="flex items-end justify-between gap-2 h-28 mt-3">
              {d.serie.map((s) => (
                <div key={s.mes} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                    <Barra valor={Number(s.cotizado)} tope={tope} clase="bg-dorado" />
                    <Barra valor={Number(s.vendido)} tope={tope} clase="bg-verde" />
                    <Barra valor={Number(s.facturado ?? 0)} tope={tope} clase="bg-[#2F5D8A]" />
                  </div>
                  <span
                    className={`text-[10px] ${
                      s.mes === d.mes ? "text-verde font-semibold" : "text-gray-500"
                    }`}
                  >
                    {nombreMes(s.mes)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-600">
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-2 bg-dorado rounded-sm" /> Cotizado
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-2 bg-verde rounded-sm" /> Vendido
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block w-3 h-2 bg-[#2F5D8A] rounded-sm" /> Facturado
              </span>
              <span className="text-gray-400">
                mayor del periodo {pesos(tope)}
              </span>
            </div>
          </div>
        </Caja>

        <Caja titulo="Cobranza, todos los pedidos">
          <div className="p-2.5 grid grid-cols-2 gap-2.5">
            <Dato
              titulo="Por cobrar"
              valor={pesos(d.cobranza.por_cobrar)}
              pie={`${porcentaje(d.cobranza.por_cobrar_pct)} % de ${pesos(d.cobranza.comprometido)} · ${d.cobranza.pedidos_con_saldo} de ${d.cobranza.pedidos} pedidos`}
            />
            <Dato
              titulo="Abonado del mes"
              valor={pesos(d.cobranza.abonado_mes)}
              pie={`${d.cobranza.pagos_mes} pago${d.cobranza.pagos_mes === 1 ? "" : "s"}${
                d.cobranza.abonado_pct != null
                  ? ` · ${porcentaje(d.cobranza.abonado_pct)} % de lo vendido`
                  : ""
              }`}
            />
            <Dato
              titulo="Sin el pie cubierto"
              valor={`${d.cobranza.sin_pie} de ${d.cobranza.pedidos}`}
              pie={d.cobranza.falta_pie > 0 ? `faltan ${pesos(d.cobranza.falta_pie)}` : "al dia"}
              alerta={d.cobranza.sin_pie > 0}
            />
            <Dato
              titulo="Por facturar"
              valor={`${d.cobranza.sin_factura} de ${d.cobranza.pedidos}`}
              pie={
                d.cobranza.sin_factura > 0
                  ? `${pesos(d.cobranza.monto_sin_factura)} por facturar`
                  : "todo facturado"
              }
              alerta={d.cobranza.sin_factura > 0}
            />
            <div className="col-span-2 flex gap-3 text-[11px]">
              <Link href="/cobranza" className="text-verde font-semibold underline">
                Estado de pago
              </Link>
              <Link href="/facturas" className="text-verde font-semibold underline">
                Facturas y notas de credito
              </Link>
            </div>
          </div>
        </Caja>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-2.5">
        <Caja titulo="Cuanto de lo cotizado se vendio, mes a mes">
          <div className="p-3">
            <div className="flex items-end justify-between gap-2 h-24 mt-3">
              {d.serie.map((s) => {
                const pct =
                  s.cotizaciones > 0 ? Math.round((s.convertidas / s.cotizaciones) * 100) : null;
                return (
                  <div key={s.mes} className="flex-1 flex flex-col items-center gap-1 h-full">
                    <div className="relative w-full flex-1">
                      <span
                        className="absolute inset-x-0 text-center text-[9px] leading-none tabular-nums text-gray-700"
                        style={{ bottom: `calc(${pct ?? 0}% + 2px)` }}
                      >
                        {pct == null ? "--" : `${pct} %`}
                      </span>
                      <div
                        className="absolute bottom-0 inset-x-[22%] bg-verde rounded-t-sm"
                        style={{ height: `${pct ?? 0}%` }}
                        title={`${s.convertidas} de ${s.cotizaciones} cotizaciones`}
                      />
                    </div>
                    <span
                      className={`text-[10px] ${
                        s.mes === d.mes ? "text-verde font-semibold" : "text-gray-500"
                      }`}
                    >
                      {nombreMes(s.mes)}
                    </span>
                    <span className="text-[9px] text-gray-400 leading-none">
                      {s.convertidas}/{s.cotizaciones}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              Cotizaciones que terminaron en pedido, sobre las emitidas en ese mes. La escala va de
              0 a 100 %.
            </p>
          </div>
        </Caja>

        <Caja titulo="Cotizaciones en juego, por estado">
          <div className="p-3 space-y-2 text-[11px]">
            {ENJUEGO.map((estado) => {
              const e = (d.embudo ?? []).find((x) => x.estado === estado);
              const monto = Number(e?.monto ?? 0);
              const ancho = Math.max(monto > 0 ? 2 : 0, Math.round((monto / topeEmbudo) * 100));
              return (
                <Link
                  key={estado}
                  href={`/cotizaciones?estado=${encodeURIComponent(estado)}`}
                  className="block hover:bg-crema rounded px-1 py-0.5"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{etiquetaDe(cat.cotizacion, estado)}</span>
                    <span className="tabular-nums">
                      {pesos(monto)}
                      <span className="text-gray-500"> · {e?.n ?? 0} cot.</span>
                    </span>
                  </span>
                  <span className="mt-0.5 block h-3 bg-gray-100 rounded-sm overflow-hidden">
                    <span className="block h-full bg-dorado" style={{ width: `${ancho}%` }} />
                  </span>
                </Link>
              );
            })}
            <p className="text-[10px] text-gray-500">
              Lo que todavia se puede ganar, al dia de hoy. Pulse un estado para ver esas
              cotizaciones.
            </p>
          </div>
        </Caja>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-2.5">
        <Caja titulo="Equipo, en el mes">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {EQUIPO.columnas.map((c) => (
                    <TituloOrden
                      key={c.campo}
                      qs={qs}
                      param={EQUIPO.param}
                      campo={c.campo}
                      actual={ordenEquipo}
                      inicial={c.inicial}
                      alineacion={c.campo === "vendedor" ? "left" : "right"}
                      ancho={ANCHO[c.campo]}
                    >
                      {c.texto}
                    </TituloOrden>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-5">
                      Sin movimiento en el mes.
                    </td>
                  </tr>
                )}
                {ranking.map((r) => (
                  <tr key={r.nombre} className="border-t border-gray-100">
                    <td className="px-2.5 py-1.5 font-semibold text-verde">{r.nombre}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      {pesos(r.cotizado)}
                      <span className="text-gray-400"> · {r.cotizaciones} cot.</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-gray-600">
                      <span className="flex items-center justify-end gap-1.5">
                        <span className="h-2 bg-dorado rounded-sm" style={{ width: `${Math.max(Number(r.parte), 1)}%` }} />
                        <span className="tabular-nums w-10">{porcentaje(r.parte)} %</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-semibold">
                      {pesos(r.vendido)}
                      <span className="font-normal text-gray-400"> · {r.pedidos}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-gray-600">
                      {r.conversion == null ? "--" : `${porcentaje(r.conversion)} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Caja>

        <Caja titulo="Clientes con mas monto, 6 meses">
          <div className="px-2.5 pt-2">
            <BarraOrden qs={qs} param={CLIENTES.param} actual={ordenClientes} opciones={CLIENTES.columnas} />
          </div>
          <ul className="p-2.5 space-y-1.5 text-[11px]">
            {clientes.length === 0 && (
              <li className="text-gray-400 text-center py-3">Sin cotizaciones en el periodo.</li>
            )}
            {clientes.map((c) => (
              <li key={c.nombre}>
                <span className="flex justify-between gap-3">
                  <span className="text-gray-700 truncate" title={c.nombre}>
                    {c.nombre}
                    <span className="text-gray-400"> · {c.cotizaciones} cot.</span>
                  </span>
                  <span className="shrink-0">
                    <b>{pesos(c.monto)}</b>
                    <span className="text-gray-500"> · {porcentaje(c.parte)} %</span>
                  </span>
                </span>
                <span className="mt-0.5 block h-1.5 bg-gray-100 rounded-sm overflow-hidden">
                  <span
                    className="block h-full bg-verde"
                    style={{ width: `${Math.max(Number(c.parte), 1)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Caja>
      </div>
    </div>
  );
}

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-verde text-white text-[11px] font-semibold px-2.5 py-1.5 uppercase">
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Barra({ valor, tope, clase }: { valor: number; tope: number; clase: string }) {
  // Una barra en cero igual deja una linea de un pixel: se ve que el mes existe
  // y que no hubo movimiento.
  const alto = Math.max(1, Math.round((valor / tope) * 100));
  return (
    <div className="relative flex-1 h-full" title={pesos(valor)}>
      <span
        className="absolute inset-x-0 text-center text-[8px] sm:text-[9px] leading-none tabular-nums text-gray-700 whitespace-nowrap"
        style={{ bottom: `calc(${alto}% + 2px)` }}
      >
        {pesosCorto(valor)}
      </span>
      <div className={`${clase} absolute bottom-0 inset-x-px rounded-t-sm`} style={{ height: `${alto}%` }} />
    </div>
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
      className={`rounded border px-2.5 py-2 ${
        destacado ? "bg-verde text-white border-verde" : "bg-white border-gray-200"
      }`}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          destacado ? "text-white/80" : "text-dorado-osc"
        }`}
      >
        {titulo}
      </div>
      <div className="text-base font-bold leading-tight mt-0.5">{valor}</div>
      {pie && (
        <div className={`text-[10px] leading-tight mt-0.5 ${destacado ? "text-white/80" : "text-gray-500"}`}>
          {pie}
        </div>
      )}
      {nota && (
        <div className={`text-[10px] leading-tight mt-0.5 ${destacado ? "text-white/90" : color}`}>
          {nota}
        </div>
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
      <div className="text-[10px] font-semibold uppercase tracking-wide text-dorado-osc">
        {titulo}
      </div>
      <div className={`text-sm font-bold ${alerta ? "text-amber-700" : ""}`}>{valor}</div>
      {pie && <div className="text-[10px] leading-tight text-gray-500">{pie}</div>}
    </div>
  );
}
