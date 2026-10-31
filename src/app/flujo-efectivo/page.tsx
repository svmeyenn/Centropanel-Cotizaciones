import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import TablaConceptosFlujo from "@/components/finanzas/TablaConceptosFlujo";
import {
  cargarFlujoEfectivo,
  cargarFlujoProyectado,
  cargarMovimientosFlujo,
  type LineaFlujo,
  type PartidaProyectada,
} from "@/lib/finanzas/flujo";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTIVIDADES = ["Operacion", "Inversion", "Financiamiento", "Sin clasificar"] as const;
const TEXTO_ACTIVIDAD: Record<string, string> = {
  Operacion: "Actividades de operación",
  Inversion: "Actividades de inversión",
  Financiamiento: "Actividades de financiamiento",
  "Sin clasificar": "Sin clasificar",
};

const fmt = (n: number) =>
  n === 0 ? "—" : n.toLocaleString("es-CL", { maximumFractionDigits: 0 }).replace("-", "−");

const dia = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}-${m}-${a}`;
};

function sumarDias(iso: string, n: number) {
  const f = new Date(`${iso}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}

// Estado de flujos de efectivo por el metodo directo (NIC 7) y la proyeccion a 13 semanas.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/flujo-efectivo")) redirect("/");

  const hoy = new Date().toISOString().slice(0, 10);
  const sp = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  const desde = sp.desde && fecha.test(sp.desde) ? sp.desde : `${hoy.slice(0, 4)}-01-01`;
  const hasta = sp.hasta && fecha.test(sp.hasta) ? sp.hasta : hoy;

  const ctx = await contextoMercado(v);
  const paises = ctx.activo ? [ctx.activo] : ctx.accesibles;

  const supabase = await createClient();
  const { data: conceptos } = await supabase
    .from("conceptos_flujo")
    .select("codigo, actividad, nombre")
    .order("orden");

  const bloques = await Promise.all(
    paises.map(async (p) => {
      const [real, proy, movs] = await Promise.all([
        cargarFlujoEfectivo(desde, hasta, p.id),
        cargarFlujoProyectado(p.id, hoy),
        cargarMovimientosFlujo(desde, hasta, p.id),
      ]);
      return { pais: p, real, proy, movs };
    })
  );

  const campo = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Flujo de efectivo"
        subtitulo="Lo que entró y salió por el banco, y lo que se espera para las próximas 13 semanas"
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
          <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">
            Ver
          </button>
          {!ctx.activo && ctx.accesibles.length > 1 && (
            <span className="text-gray-500">
              Cada mercado va en su moneda; el consolidado en pesos chilenos llega con el tipo de cambio.
            </span>
          )}
        </form>

        {bloques.map(({ pais, real, proy, movs }) => (
          <section key={pais.id} className="space-y-4" aria-label={`Flujo de ${pais.nombre}`}>
            <h2 className="text-base font-semibold text-verde">
              {pais.nombre} · {pais.moneda_base}
            </h2>

            {real.error ? (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {real.error}
              </div>
            ) : (
              <EstadoReal real={real} desde={desde} hasta={hasta} />
            )}

            {!proy.error && <Proyeccion partidas={proy.partidas} inicio={hoy} efectivoHoy={real.final} />}

            {!real.error && (
              <TablaConceptosFlujo
                movimientos={movs}
                conceptos={(conceptos ?? []) as { codigo: string; actividad: string; nombre: string }[]}
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function EstadoReal({
  real,
  desde,
  hasta,
}: {
  real: { lineas: LineaFlujo[]; inicial: number; final: number };
  desde: string;
  hasta: string;
}) {
  const variacion = real.lineas.reduce((s, l) => s + l.cobros - l.pagos, 0);
  const sinClasificar = real.lineas.find((l) => l.codigo === "SIN");

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="px-3 py-2 bg-crema border-b border-gray-200 text-xs text-dorado-osc font-semibold">
        Estado de flujos de efectivo · método directo · {dia(desde)} al {dia(hasta)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-verde text-white">
            <tr>
              <th scope="col" className="text-left px-3 py-2">Concepto</th>
              <th scope="col" className="text-right px-3 py-2 w-36">Cobros</th>
              <th scope="col" className="text-right px-3 py-2 w-36">Pagos</th>
              <th scope="col" className="text-right px-3 py-2 w-36">Flujo neto</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 font-semibold">
              <td className="px-3 py-2">Efectivo al inicio</td>
              <td />
              <td />
              <td className="px-3 py-2 text-right">{fmt(real.inicial)}</td>
            </tr>
            {ACTIVIDADES.map((act) => {
              const filas = real.lineas.filter((l) => l.actividad === act);
              if (filas.length === 0) return null;
              const neto = filas.reduce((s, l) => s + l.cobros - l.pagos, 0);
              return (
                <ActividadFilas key={act} titulo={TEXTO_ACTIVIDAD[act]} filas={filas} neto={neto} />
              );
            })}
            <tr className="border-t-2 border-verde font-semibold bg-crema">
              <td className="px-3 py-2">Variación neta del efectivo</td>
              <td />
              <td />
              <td className="px-3 py-2 text-right">{fmt(variacion)}</td>
            </tr>
            <tr className="border-t border-gray-100 font-semibold">
              <td className="px-3 py-2">Efectivo al cierre</td>
              <td />
              <td />
              <td className={`px-3 py-2 text-right ${real.final < 0 ? "text-red-700" : ""}`}>
                {fmt(real.final)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {sinClasificar && (
        <p className="px-3 py-2 text-xs text-dorado-osc bg-crema border-t border-dorado">
          {sinClasificar.movimientos} movimientos no tienen concepto de flujo. Asígnalos abajo o en
          Plan de cuentas, mapeando su categoría.
        </p>
      )}
      {real.final < 0 && (
        <p className="px-3 py-2 text-xs text-red-700 border-t border-gray-100">
          El efectivo al cierre da negativo: probablemente falta cargar el saldo inicial de las
          cuentas bancarias, porque el estado solo conoce lo registrado en el sistema.
        </p>
      )}
    </div>
  );
}

function ActividadFilas({
  titulo,
  filas,
  neto,
}: {
  titulo: string;
  filas: LineaFlujo[];
  neto: number;
}) {
  return (
    <>
      <tr className="border-t border-gray-200 bg-gray-50">
        <th scope="rowgroup" colSpan={3} className="text-left px-3 py-1.5 text-verde font-semibold">
          {titulo}
        </th>
        <td className="px-3 py-1.5 text-right font-semibold">{fmt(neto)}</td>
      </tr>
      {filas.map((l) => (
        <tr key={l.codigo} className="border-t border-gray-100 hover:bg-crema">
          <td className="px-3 py-1.5 pl-6">
            <span className="text-gray-500 mr-2">{l.codigo === "SIN" ? "" : l.codigo}</span>
            {l.nombre}
            <span className="text-gray-400 ml-2">({l.movimientos})</span>
          </td>
          <td className="px-3 py-1.5 text-right">{fmt(l.cobros)}</td>
          <td className="px-3 py-1.5 text-right">{fmt(-l.pagos)}</td>
          <td className="px-3 py-1.5 text-right">{fmt(l.cobros - l.pagos)}</td>
        </tr>
      ))}
    </>
  );
}

function Proyeccion({
  partidas,
  inicio,
  efectivoHoy,
}: {
  partidas: PartidaProyectada[];
  inicio: string;
  efectivoHoy: number;
}) {
  // 0 vencido, 1..13 semanas, 15 posterior, 14 sin fecha: se muestran en ese orden.
  const orden = [0, ...Array.from({ length: 13 }, (_, i) => i + 1), 15, 14];
  const etiqueta = (s: number) =>
    s === 0
      ? "Vencido"
      : s === 14
        ? "Sin fecha"
        : s === 15
          ? "Después de 13 semanas"
          : `Sem. ${s} · ${dia(sumarDias(inicio, (s - 1) * 7)).slice(0, 5)}`;

  const por = (s: number, sentido: string) =>
    partidas.filter((p) => p.semana === s && p.sentido === sentido).reduce((t, p) => t + p.monto, 0);

  let acumulado = efectivoHoy;
  const filas = orden.map((s) => {
    const cobros = por(s, "Cobro");
    const pagos = por(s, "Pago");
    // Lo que no tiene fecha no mueve el saldo semana a semana: se muestra aparte.
    const cuenta = s !== 14 && s !== 15;
    if (cuenta) acumulado += cobros - pagos;
    return { s, cobros, pagos, acumulado: cuenta ? acumulado : null };
  });
  const visibles = filas.filter((f) => f.cobros !== 0 || f.pagos !== 0 || (f.s >= 1 && f.s <= 13));

  const fuentes = [...new Set(partidas.map((p) => `${p.sentido}|${p.fuente}`))];

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="px-3 py-2 bg-crema border-b border-gray-200 text-xs text-dorado-osc font-semibold">
        Flujo proyectado a 13 semanas desde hoy · parte con el efectivo de hoy ({fmt(efectivoHoy)})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-verde text-white">
            <tr>
              <th scope="col" className="text-left px-3 py-2">Semana</th>
              <th scope="col" className="text-right px-3 py-2 w-36">Por cobrar</th>
              <th scope="col" className="text-right px-3 py-2 w-36">Por pagar</th>
              <th scope="col" className="text-right px-3 py-2 w-36">Saldo proyectado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.s} className="border-t border-gray-100 hover:bg-crema">
                <th scope="row" className="text-left px-3 py-1.5 font-normal">{etiqueta(f.s)}</th>
                <td className="px-3 py-1.5 text-right">{fmt(f.cobros)}</td>
                <td className="px-3 py-1.5 text-right">{fmt(-f.pagos)}</td>
                <td className={`px-3 py-1.5 text-right ${f.acumulado != null && f.acumulado < 0 ? "text-red-700" : ""}`}>
                  {f.acumulado == null ? "no suma" : fmt(f.acumulado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-gray-600 border-t border-gray-100">
        Se alimenta de {fuentes.length ? fuentes.map((f) => f.split("|")[1].toLowerCase()).join(", ") : "nada por ahora"}.
        Los pedidos usan la fecha de entrega esperada y las órdenes de compra su fecha de entrega;
        lo que no tiene fecha queda aparte y no entra al saldo. «Vencido» es lo que ya pasó su fecha y sigue pendiente.
      </p>
    </div>
  );
}
