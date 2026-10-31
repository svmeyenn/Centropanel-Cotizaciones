import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { cargarBalance, fecha, fmt, type FilaBalance } from "@/lib/finanzas/contabilidad";

export const dynamic = "force-dynamic";

// Si el saldo de una cuenta queda del lado contrario, se presenta en su cuenta espejo:
// un cliente que pago de mas es un anticipo (pasivo), no un deudor negativo.
const ESPEJO: Record<string, string> = {
  "1.1.02": "2.1.02",
  "1.1.05": "2.1.03",
  "1.1.03": "2.1.01",
  "1.1.06": "2.1.05",
};
const ESPEJO_INVERSO = Object.fromEntries(Object.entries(ESPEJO).map(([a, b]) => [b, a]));

interface Linea {
  codigo: string;
  nombre: string;
  monto: number;
}

function presentar(filas: FilaBalance[], resultado: number) {
  const nombre = (c: string) => filas.find((f) => f.codigo === c)?.nombre ?? c;
  const activo: Record<string, number> = {};
  const pasivo: Record<string, number> = {};
  const patrimonio: Record<string, number> = {};
  const sumar = (m: Record<string, number>, c: string, v: number) => (m[c] = (m[c] ?? 0) + v);

  for (const f of filas) {
    if (f.clase === 1) {
      if (f.saldo >= 0) sumar(activo, f.codigo, f.saldo);
      else sumar(pasivo, ESPEJO[f.codigo] ?? f.codigo, -f.saldo);
    } else if (f.clase === 2) {
      if (f.saldo <= 0) sumar(pasivo, f.codigo, -f.saldo);
      else sumar(activo, ESPEJO_INVERSO[f.codigo] ?? f.codigo, f.saldo);
    } else if (f.codigo !== "3.1.03") {
      sumar(patrimonio, f.codigo, -f.saldo);
    }
  }
  sumar(patrimonio, "3.1.03", resultado);

  const lista = (m: Record<string, number>): Linea[] =>
    Object.entries(m)
      .filter(([, v]) => Math.round(v) !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([codigo, monto]) => ({ codigo, nombre: nombre(codigo), monto }));
  return { activo: lista(activo), pasivo: lista(pasivo), patrimonio: lista(patrimonio) };
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ al?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/balance")) redirect("/");

  const hoy = new Date().toISOString().slice(0, 10);
  const sp = await searchParams;
  const al = sp.al && /^\d{4}-\d{2}-\d{2}$/.test(sp.al) ? sp.al : hoy;

  const ctx = await contextoMercado(v);
  const paises = ctx.activo ? [ctx.activo] : ctx.accesibles;
  const bloques = await Promise.all(
    paises.map(async (p) => ({ pais: p, bal: await cargarBalance(al, p.id) }))
  );

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Balance"
        subtitulo="Estado de situación financiera: lo que la empresa tiene, lo que debe y lo que es de los socios"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-6">
        <BarraNavegacion />
        <form className="flex items-end gap-3 text-xs" method="get">
          <label>
            <span className="block text-dorado-osc font-semibold mb-1">Al</span>
            <input
              id="al"
              type="date"
              name="al"
              defaultValue={al}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            />
          </label>
          <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">Ver</button>
        </form>

        {bloques.map(({ pais, bal }) => {
          const p = presentar(bal.filas, bal.resultado);
          const tA = p.activo.reduce((s, x) => s + x.monto, 0);
          const tP = p.pasivo.reduce((s, x) => s + x.monto, 0);
          const tPat = p.patrimonio.reduce((s, x) => s + x.monto, 0);
          const diferencia = Math.round(tA - tP - tPat);
          return (
            <section key={pais.id} className="space-y-3" aria-label={`Balance de ${pais.nombre}`}>
              <h2 className="text-base font-semibold text-verde">
                {pais.nombre} · {pais.moneda_base} · al {fecha(al)}
              </h2>
              {bal.error ? (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                  {bal.error}
                </div>
              ) : p.activo.length + p.pasivo.length + p.patrimonio.length === 0 ? (
                <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
                  No hay asientos a esa fecha. Contabiliza el mercado en el Libro diario.
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4">
                  <Cuadro titulo="Activos" lineas={p.activo} total={tA} etiquetaTotal="Total activos" />
                  <div className="space-y-4">
                    <Cuadro titulo="Pasivos" lineas={p.pasivo} total={tP} etiquetaTotal="Total pasivos" />
                    <Cuadro titulo="Patrimonio" lineas={p.patrimonio} total={tPat} etiquetaTotal="Total patrimonio" />
                    <div className="bg-white border border-gray-200 rounded px-3 py-2 text-xs flex justify-between font-semibold tabular-nums">
                      <span>Total pasivos y patrimonio</span>
                      <span>{fmt(tP + tPat)}</span>
                    </div>
                  </div>
                </div>
              )}
              {diferencia !== 0 && !bal.error && (
                <p role="alert" className="text-xs text-red-700 font-semibold">
                  El balance no cuadra por {fmt(diferencia)}. Avísalo: algún asiento quedó mal.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Cuadro({
  titulo,
  lineas,
  total,
  etiquetaTotal,
}: {
  titulo: string;
  lineas: Linea[];
  total: number;
  etiquetaTotal: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <table className="w-full text-xs tabular-nums">
        <thead className="bg-verde text-white">
          <tr>
            <th scope="col" className="text-left px-3 py-2">{titulo}</th>
            <th scope="col" className="text-right px-3 py-2 w-36">Monto</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 && (
            <tr>
              <td colSpan={2} className="px-3 py-3 text-gray-500">Sin saldos.</td>
            </tr>
          )}
          {lineas.map((l) => (
            <tr key={l.codigo} className="border-t border-gray-100 hover:bg-crema">
              <td className="px-3 py-1.5">
                <span className="text-gray-500 mr-2">{l.codigo}</span>
                {l.nombre}
              </td>
              <td className="px-3 py-1.5 text-right">{fmt(l.monto)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-verde bg-crema font-semibold">
            <td className="px-3 py-1.5">{etiquetaTotal}</td>
            <td className="px-3 py-1.5 text-right">{fmt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
