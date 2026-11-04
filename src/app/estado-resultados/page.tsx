import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import {
  NOMBRE_UNIDAD,
  UNIDADES,
  cargarEstadoResultados,
  asegurarContabilidad,
  cargarPlan,
  fecha,
  fmt,
  type CuentaPlan,
  type FilaResultado,
  type Unidad,
} from "@/lib/finanzas/contabilidad";

export const dynamic = "force-dynamic";

// Secciones del estado por funcion (NIC 1) con las cuentas que entran en cada una.
const SECCIONES: { titulo: string; cuentas: string[]; total: string; margen?: string }[] = [
  { titulo: "Ingresos de actividades ordinarias", cuentas: ["4.1.01", "4.1.02", "4.1.03"], total: "Ingresos netos" },
  { titulo: "Costo de venta", cuentas: ["5.1.01", "5.1.02", "5.1.03"], total: "Costo de venta total", margen: "Margen bruto" },
  { titulo: "Gastos operacionales", cuentas: ["6.1.01", "6.1.02", "6.1.03"], total: "Gastos operacionales total", margen: "Resultado operacional (EBIT)" },
  { titulo: "Resultado financiero", cuentas: ["6.2.01", "6.2.02", "6.2.03"], total: "Resultado financiero total", margen: "Resultado antes de impuestos" },
  { titulo: "Impuesto a la renta", cuentas: ["6.3.01"], total: "Impuesto total", margen: "Resultado del ejercicio" },
];

type Valores = Record<Unidad, number>;
const vacio = (): Valores => ({ OBR: 0, VTA: 0, ADM: 0, SIN: 0 });
const total = (v: Valores) => v.OBR + v.VTA + v.ADM + v.SIN;
const suma = (a: Valores, b: Valores): Valores => ({
  OBR: a.OBR + b.OBR,
  VTA: a.VTA + b.VTA,
  ADM: a.ADM + b.ADM,
  SIN: a.SIN + b.SIN,
});

// Aporte de una cuenta al resultado: lo que suma es positivo y lo que resta, negativo.
function aporte(plan: CuentaPlan[], filas: FilaResultado[], codigo: string): Valores {
  const cuenta = plan.find((c) => c.codigo === codigo);
  const signo = cuenta?.naturaleza === "Acreedora" ? 1 : -1;
  const v = vacio();
  for (const f of filas) if (f.codigo === codigo) v[f.unidad as Unidad] += signo * f.monto;
  return v;
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/estado-resultados")) redirect("/");

  const hoy = new Date().toISOString().slice(0, 10);
  const sp = await searchParams;
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  const desde = sp.desde && ok.test(sp.desde) ? sp.desde : `${hoy.slice(0, 4)}-01-01`;
  const hasta = sp.hasta && ok.test(sp.hasta) ? sp.hasta : hoy;

  const ctx = await contextoMercado(v);
  const paises = ctx.activo ? [ctx.activo] : ctx.accesibles;
  await asegurarContabilidad();
  const plan = await cargarPlan();
  const bloques = await Promise.all(
    paises.map(async (p) => ({ pais: p, er: await cargarEstadoResultados(desde, hasta, p.id) }))
  );

  const campo = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";

  return (
    <div className="min-h-screen vista-fin">
      <Cabecera
        titulo="Estado de resultados"
        subtitulo="Por función, abierto por unidad de negocio, con la administración central aparte y prorrateada"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-6">
        <BarraNavegacion />
        <form className="flex flex-wrap items-end gap-3 text-xs" method="get">
          <label>
            <span className="block text-dorado-osc font-semibold mb-1">Desde</span>
            <input id="desde" type="date" name="desde" defaultValue={desde} className={campo} />
          </label>
          <label>
            <span className="block text-dorado-osc font-semibold mb-1">Hasta</span>
            <input id="hasta" type="date" name="hasta" defaultValue={hasta} className={campo} />
          </label>
          <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">Ver</button>
        </form>

        {bloques.map(({ pais, er }) => (
          <section key={pais.id} className="space-y-4" aria-label={`Resultados de ${pais.nombre}`}>
            <h2 className="text-base font-semibold text-verde">
              {pais.nombre} · {pais.moneda_base} · {fecha(desde)} al {fecha(hasta)}
            </h2>
            {er.error ? (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {er.error}
              </div>
            ) : er.filas.length === 0 ? (
              <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
                No hay asientos en el período. Contabiliza el mercado en el Libro diario.
              </div>
            ) : (
              <Estado plan={plan} filas={er.filas} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Estado({ plan, filas }: { plan: CuentaPlan[]; filas: FilaResultado[] }) {
  let acumulado = vacio();
  const lineas: React.ReactNode[] = [];
  const subtotales: Record<string, Valores> = {};

  for (const sec of SECCIONES) {
    const cuentas = sec.cuentas
      .map((c) => ({ c, v: aporte(plan, filas, c) }))
      .filter((x) => total(x.v) !== 0);
    const sub = cuentas.reduce((s, x) => suma(s, x.v), vacio());
    subtotales[sec.titulo] = sub;
    acumulado = suma(acumulado, sub);

    lineas.push(
      <tr key={`h-${sec.titulo}`} className="border-t border-gray-200 bg-gray-50">
        <th scope="rowgroup" colSpan={6} className="text-left px-3 py-1.5 text-verde font-semibold">
          {sec.titulo}
        </th>
      </tr>
    );
    for (const x of cuentas) {
      lineas.push(
        <Fila key={x.c} etiqueta={`${x.c} · ${plan.find((p) => p.codigo === x.c)?.nombre ?? ""}`} v={x.v} sangria />
      );
    }
    if (cuentas.length > 1 || sec.margen) {
      lineas.push(<Fila key={`t-${sec.titulo}`} etiqueta={sec.total} v={sub} fuerte />);
    }
    if (sec.margen) {
      lineas.push(<Fila key={`m-${sec.titulo}`} etiqueta={sec.margen} v={acumulado} destacada />);
    }
  }

  // Administracion central: no vende, asi que su gasto se reparte entre Obras y Venta de productos por venta.
  const ingresos = subtotales[SECCIONES[0].titulo];
  const resultadoUnidad = (u: Unidad) =>
    SECCIONES.reduce((s, sec) => s + subtotales[sec.titulo][u], 0);
  const admin = resultadoUnidad("ADM");
  const baseVenta = Math.max(ingresos.OBR, 0) + Math.max(ingresos.VTA, 0);
  const parte = (u: "OBR" | "VTA") =>
    baseVenta > 0 ? (admin * Math.max(ingresos[u], 0)) / baseVenta : 0;
  const margenBruto = (u: Unidad) =>
    subtotales[SECCIONES[0].titulo][u] + subtotales[SECCIONES[1].titulo][u];

  return (
    <>
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Línea</th>
                {UNIDADES.map((u) => (
                  <th key={u} scope="col" className="text-right px-3 py-2 w-32">{NOMBRE_UNIDAD[u]}</th>
                ))}
                <th scope="col" className="text-right px-3 py-2 w-32">Total</th>
              </tr>
            </thead>
            <tbody>{lineas}</tbody>
          </table>
        </div>
        {Math.round(resultadoUnidad("SIN")) !== 0 && (
          <p className="px-3 py-2 text-xs text-dorado-osc bg-crema border-t border-dorado">
            Hay movimientos sin centro de costo; no se pueden asignar a una unidad. Se asignan en
            Unidades y centros de costo.
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="px-3 py-2 bg-crema border-b border-gray-200 text-xs text-dorado-osc font-semibold">
          Resultado por unidad con la administración central prorrateada por venta
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Unidad</th>
                <th scope="col" className="text-right px-3 py-2">Ingresos</th>
                <th scope="col" className="text-right px-3 py-2">Margen bruto</th>
                <th scope="col" className="text-right px-3 py-2">Resultado propio</th>
                <th scope="col" className="text-right px-3 py-2">Administración prorrateada</th>
                <th scope="col" className="text-right px-3 py-2">Resultado final</th>
              </tr>
            </thead>
            <tbody>
              {(["OBR", "VTA"] as const).map((u) => (
                <tr key={u} className="border-t border-gray-100">
                  <th scope="row" className="text-left px-3 py-1.5 font-semibold">{NOMBRE_UNIDAD[u]}</th>
                  <td className="px-3 py-1.5 text-right">{fmt(ingresos[u])}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(margenBruto(u))}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(resultadoUnidad(u))}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(parte(u))}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{fmt(resultadoUnidad(u) + parte(u))}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-100 text-gray-600">
                <th scope="row" className="text-left px-3 py-1.5 font-normal">Administración central (a repartir)</th>
                <td /><td />
                <td className="px-3 py-1.5 text-right">{fmt(admin)}</td>
                <td className="px-3 py-1.5 text-right">{fmt(-admin)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {baseVenta <= 0 && (
          <p className="px-3 py-2 text-xs text-gray-600 border-t border-gray-100">
            Sin ventas en el período no hay base para prorratear la administración central.
          </p>
        )}
      </div>
    </>
  );
}

function Fila({
  etiqueta,
  v,
  sangria,
  fuerte,
  destacada,
}: {
  etiqueta: string;
  v: Valores;
  sangria?: boolean;
  fuerte?: boolean;
  destacada?: boolean;
}) {
  const clase = destacada
    ? "border-t-2 border-verde bg-crema font-semibold"
    : fuerte
      ? "border-t border-gray-200 font-semibold"
      : "border-t border-gray-100 hover:bg-crema";
  return (
    <tr className={clase}>
      <td className={`px-3 py-1.5 ${sangria ? "pl-6" : ""}`}>{etiqueta}</td>
      {UNIDADES.map((u) => (
        <td key={u} className="px-3 py-1.5 text-right">{fmt(v[u])}</td>
      ))}
      <td className="px-3 py-1.5 text-right">{fmt(total(v))}</td>
    </tr>
  );
}
