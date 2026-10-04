import type { CumplimientoFila } from "@/components/inicio/tipos";
import TituloOrden from "@/components/TituloOrden";
import { CUMPLIMIENTO } from "@/components/inicio/orden";
import { ordenar, type Orden } from "@/lib/ordenTabla";

// Lo que cada persona prometio para el mes y lo que cumplio, juntando las
// acciones de cotizaciones y los compromisos con leads. Una accion caduca no es
// un fracaso en si misma --hay clientes que compran en otro lado-- pero muchas
// seguidas si dicen algo.
export default function Cumplimiento({
  cotizaciones,
  leads,
  qs,
  orden,
}: {
  cotizaciones: CumplimientoFila[];
  leads: CumplimientoFila[];
  qs: string;
  orden: Orden;
}) {
  const filas = new Map<number, { vendedor: string; cot: CumplimientoFila | null; lead: CumplimientoFila | null }>();
  for (const c of cotizaciones) filas.set(c.id_vendedor, { vendedor: c.vendedor, cot: c, lead: null });
  for (const l of leads) {
    const f = filas.get(l.id_vendedor);
    if (f) f.lead = l;
    else filas.set(l.id_vendedor, { vendedor: l.vendedor, cot: null, lead: l });
  }
  const suma = (a: CumplimientoFila | null, b: CumplimientoFila | null, k: keyof CumplimientoFila) =>
    Number(a?.[k] ?? 0) + Number(b?.[k] ?? 0);
  const lista = ordenar([...filas.values()], orden, (f, c) => {
    if (c === "quien") return f.vendedor;
    if (c === "cumplimiento") {
      const prom = suma(f.cot, f.lead, "comprometidas");
      return prom > 0 ? suma(f.cot, f.lead, "a_tiempo") / prom : 0;
    }
    return suma(f.cot, f.lead, c as keyof CumplimientoFila);
  });
  const total = lista.reduce((t, f) => t + suma(f.cot, f.lead, "comprometidas"), 0);
  const aTiempo = lista.reduce((t, f) => t + suma(f.cot, f.lead, "a_tiempo"), 0);

  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden">
      <h3 className="bg-verde text-white text-[11px] font-semibold px-2.5 py-1.5 uppercase flex justify-between gap-2">
        <span>Cumplimiento de lo comprometido para el mes</span>
        {total > 0 && <span className="font-normal normal-case">{Math.round((aTiempo / total) * 100)} % a tiempo</span>}
      </h3>
      {lista.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-gray-400">Nadie comprometio acciones para este mes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {CUMPLIMIENTO.columnas.map((c) => (
                  <TituloOrden
                    key={c.campo}
                    qs={qs}
                    param={CUMPLIMIENTO.param}
                    campo={c.campo}
                    actual={orden}
                    inicial={c.inicial}
                    alineacion={c.campo === "quien" || c.campo === "cumplimiento" ? "left" : "right"}
                    ancho={c.campo === "cumplimiento" ? "w-[28%]" : undefined}
                  >
                    {c.texto}
                  </TituloOrden>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => {
                const prom = suma(f.cot, f.lead, "comprometidas");
                const at = suma(f.cot, f.lead, "a_tiempo");
                const pend = suma(f.cot, f.lead, "pendientes");
                const p = prom > 0 ? Math.round((at / prom) * 100) : 0;
                return (
                  <tr key={f.vendedor} className="border-t border-gray-100">
                    <td className="px-2.5 py-1 font-semibold">{f.vendedor}</td>
                    <td className="px-2.5 py-1 text-right tabular-nums">
                      {prom}
                      <span className="block text-[9px] text-gray-500">
                        {f.cot?.comprometidas ?? 0} cot. · {f.lead?.comprometidas ?? 0} leads
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-right tabular-nums text-green-700">{at}</td>
                    <td className="px-2.5 py-1 text-right tabular-nums">{suma(f.cot, f.lead, "tarde")}</td>
                    <td className="px-2.5 py-1 text-right tabular-nums text-gray-500">{suma(f.cot, f.lead, "caducadas")}</td>
                    <td className={`px-2.5 py-1 text-right tabular-nums ${pend > 0 ? "text-red-700 font-semibold" : ""}`}>{pend}</td>
                    <td className="px-2.5 py-1">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 bg-green-700 rounded-sm" style={{ width: `${Math.max(p, 1)}%` }} />
                        <span className="tabular-nums">{p} %</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
