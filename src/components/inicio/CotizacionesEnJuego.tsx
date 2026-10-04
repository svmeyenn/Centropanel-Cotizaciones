import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import { dinero, fecha as fmtFecha, importe } from "@/lib/formato";
import { antiguedad, type Gestion } from "@/components/inicio/tipos";

// Montos de varias monedas no se suman: con una sola se escribe como siempre,
// con varias cada una con su simbolo.
function montos(m: Record<string, number>) {
  const e = Object.entries(m ?? {});
  if (e.length === 0) return importe(0, "CLP");
  if (e.length === 1) return importe(e[0][1], e[0][0]);
  return e.map(([mon, v]) => dinero(v, mon)).join(" · ");
}

const ORDEN = ["Borrador", "Emitida", "Enviada"];
const QUE_HACER: Record<string, string> = {
  Borrador: "terminarla y emitirla",
  Emitida: "enviarla al cliente",
  Enviada: "conseguir respuesta",
};

// Las cotizaciones que todavia se pueden ganar, por lo que falta hacer con
// cada una, y las que estan vivas sin que nadie haya quedado de hacer nada.
export default function CotizacionesEnJuego({ g, verEjecutivo }: { g: Gestion; verEjecutivo: boolean }) {
  const c = g.cotizaciones;
  const embudo = ORDEN.map((e) => c.embudo.find((x) => x.estado === e)).filter(Boolean) as Gestion["cotizaciones"]["embudo"];

  return (
    <section id="cotizaciones" aria-labelledby="titulo-cot" className="bg-white border border-gray-200 rounded overflow-hidden scroll-mt-4">
      <div className="bg-verde text-white px-3 py-1.5">
        <h2 id="titulo-cot" className="text-[11px] font-semibold uppercase">
          Cotizaciones en juego
        </h2>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        {ORDEN.map((estado) => {
          const e = embudo.find((x) => x.estado === estado);
          return (
            <Link key={estado} href={`/cotizaciones?estado=${estado}`} className="px-3 py-2 hover:bg-crema">
              <span className="block text-[10px] uppercase tracking-wide text-gray-500">{estado}</span>
              {/* Una linea por moneda: pesos y soles juntos no caben ni se suman. */}
              {e && Object.keys(e.montos ?? {}).length > 1 ? (
                Object.entries(e.montos).map(([mon, v]) => (
                  <span key={mon} className="block font-bold tabular-nums">
                    {dinero(v, mon)}
                  </span>
                ))
              ) : (
                <span className="block font-bold tabular-nums break-words">{e ? montos(e.montos) : importe(0, "CLP")}</span>
              )}
              <span className="block text-[11px] text-gray-600">
                {e?.n ?? 0} cotizacion{(e?.n ?? 0) === 1 ? "" : "es"}
                {e && e.n > 0 && (
                  <>
                    {" "}· espera {antiguedad(e.dias_promedio)}
                    <span className={e.dias_maximo >= 30 ? "text-red-700 font-semibold" : ""}> (max. {antiguedad(e.dias_maximo)})</span>
                  </>
                )}
              </span>
              <span className="block text-[10px] text-dorado-osc">Falta: {QUE_HACER[estado]}</span>
            </Link>
          );
        })}
      </div>

      <div className="px-3 pt-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-dorado-osc uppercase">
          Sin proxima accion · {c.sin_accion_n}
          {c.sin_accion_n > 0 && <span className="font-normal normal-case text-gray-600"> por {montos(c.sin_accion_montos)}</span>}
        </h3>
        <span className="text-[10px] text-gray-500">Vivas y sin nada comprometido: anote que sigue en cada una.</span>
      </div>
      {c.sin_accion.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-gray-500">Todas las cotizaciones en juego tienen una proxima accion.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-gray-600 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-1">Folio</th>
                <th className="text-left px-3 py-1">Cliente</th>
                <th className="text-left px-3 py-1">Estado</th>
                {verEjecutivo && <th className="text-left px-3 py-1">Ejecutivo</th>}
                <th className="text-left px-3 py-1">Fecha</th>
                <th className="text-right px-3 py-1">Sin tocar</th>
                <th className="text-right px-3 py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {c.sin_accion.map((x) => (
                <tr key={x.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-1 whitespace-nowrap">
                    <BanderaDe idPais={x.id_pais} />
                    <Link href={`/cotizaciones/${x.id}`} className="text-verde font-semibold underline">
                      {x.num_cotizacion ?? x.id}
                    </Link>
                  </td>
                  <td className="px-3 py-1 break-words">{x.cliente ?? "(sin cliente)"}</td>
                  <td className="px-3 py-1">{x.estado}</td>
                  {verEjecutivo && <td className="px-3 py-1">{x.vendedor}</td>}
                  <td className="px-3 py-1 whitespace-nowrap">{fmtFecha(x.fecha)}</td>
                  <td className={`px-3 py-1 text-right whitespace-nowrap ${x.dias >= 30 ? "text-red-700 font-semibold" : ""}`}>
                    {antiguedad(x.dias)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums whitespace-nowrap">{importe(x.total, x.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.sin_accion_n > c.sin_accion.length && (
            <p className="px-3 py-1 text-[10px] text-gray-500">
              Se muestran las {c.sin_accion.length} mas recientes de {c.sin_accion_n}. Las demas, en la lista de cotizaciones.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
