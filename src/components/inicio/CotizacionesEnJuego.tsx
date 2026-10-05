import Link from "next/link";
import { dinero, importe } from "@/lib/formato";
import { antiguedad, type Gestion } from "@/components/inicio/tipos";
import { ordenados } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";

// Montos de varias monedas no se suman: con una sola se escribe como siempre,
// con varias cada una con su simbolo.
function montos(m: Record<string, number>) {
  const e = Object.entries(m ?? {});
  if (e.length === 0) return importe(0, "CLP");
  if (e.length === 1) return importe(e[0][1], e[0][0]);
  return e.map(([mon, v]) => dinero(v, mon)).join(" \u00b7 ");
}

// Lo que falta hacer con una cotizacion segun el papel que cumple su estado. Un
// estado que se agrego y esta en juego no tiene una tarea propia: se le da
// seguimiento.
const QUE_HACER: Record<string, string> = {
  borrador: "terminarla y emitirla",
  emitida: "enviarla al cliente",
  enviada: "conseguir respuesta",
};

// Las cotizaciones que todavia se pueden ganar, por lo que falta hacer con cada
// una. Las que ademas no tienen a nadie a cargo van en el listado unico de
// seguimiento, no aqui.
export default async function CotizacionesEnJuego({ g }: { g: Gestion }) {
  const c = g.cotizaciones;
  const cat = await catalogoEstados();
  const enJuego = ordenados(cat.cotizacion).filter((x) => x.marcas.includes("en_juego"));

  return (
    <section id="cotizaciones" aria-labelledby="titulo-cot" className="bg-white border border-gray-200 rounded overflow-hidden scroll-mt-4">
      <div className="bg-verde text-white px-3 py-1.5">
        <h2 id="titulo-cot" className="text-[11px] font-semibold uppercase">
          Cotizaciones en juego
        </h2>
      </div>
      <div
        className="grid divide-x divide-gray-100 border-b border-gray-100"
        style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(enJuego.length, 1), 4)}, minmax(0, 1fr))` }}
      >
        {enJuego.map((estado) => {
          const e = c.embudo.find((x) => x.estado === estado.codigo);
          return (
            <Link
              key={estado.codigo}
              href={`/cotizaciones?estado=${encodeURIComponent(estado.codigo)}`}
              className="px-3 py-2 hover:bg-crema"
            >
              <span className="block text-[10px] uppercase tracking-wide text-gray-500">{estado.etiqueta}</span>
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
              <span className="block text-[10px] text-dorado-osc">
                Falta: {(estado.rol && QUE_HACER[estado.rol]) || "darle seguimiento"}
              </span>
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
