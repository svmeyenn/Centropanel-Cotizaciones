import Link from "next/link";
import { dinero, importe } from "@/lib/formato";
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

// Las cotizaciones que todavia se pueden ganar, por lo que falta hacer con cada
// una. Las que ademas no tienen a nadie a cargo van en el listado unico de
// seguimiento, no aqui.
export default function CotizacionesEnJuego({ g }: { g: Gestion }) {
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

      <p className="px-3 py-1.5 text-[10px] text-gray-500">
        Las cotizaciones que nadie tiene comprometidas salen en{" "}
        <a href="#seguimiento" className="text-verde underline">
          Sin seguimiento
        </a>
        , junto con los leads.
      </p>
    </section>
  );
}
