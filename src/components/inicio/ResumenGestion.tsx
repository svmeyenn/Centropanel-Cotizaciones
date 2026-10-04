import Link from "next/link";
import type { Gestion } from "@/components/inicio/tipos";

// La primera mirada del dia, en dos grupos: lo comprometido con fecha (agenda)
// y lo que espera sin fecha (leads y cotizaciones que nadie esta moviendo).
// Cada cifra lleva a la lista donde se resuelve.
export default function ResumenGestion({
  g,
  hrefLeads,
}: {
  g: Gestion;
  hrefLeads: (gestion: "sin_contactar" | "sin_seguimiento" | "sin_propietario") => string;
}) {
  const c = g.conteos;
  return (
    <div className="grid gap-2 lg:grid-cols-[1fr_1.25fr]">
      <section aria-labelledby="res-agenda" className="bg-white border border-gray-200 rounded p-2">
        <h2 id="res-agenda" className="text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-1.5">
          Comprometido
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <Cifra href="#agenda" ancla="atrasado" titulo="Atrasado" n={c.atrasado} tono={c.atrasado > 0 ? "critico" : "neutro"} pie="vencido, sin hacer" />
          <Cifra href="#agenda" ancla="hoy" titulo="Hoy" n={c.hoy} tono={c.hoy > 0 ? "acento" : "neutro"} pie="para hoy" />
          <Cifra href="#agenda" ancla="semana" titulo="Esta semana" n={c.semana} pie="de manana al domingo" />
          <Cifra href="#agenda" ancla="proxima" titulo="Proxima semana" n={c.proxima} pie="para planificar" />
        </div>
      </section>

      <section aria-labelledby="res-espera" className="bg-white border border-gray-200 rounded p-2">
        <h2 id="res-espera" className="text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-1.5">
          Esperando que alguien lo mueva
        </h2>
        <div className={`grid grid-cols-2 gap-1.5 ${g.sin_propietario != null ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Cifra
            href={hrefLeads("sin_contactar")}
            titulo="Leads sin contactar"
            n={g.sin_contactar.n}
            tono={g.sin_contactar.n7 > 0 ? "acento" : "neutro"}
            pie={`${g.sin_contactar.n7.toLocaleString("es-CL")} llegaron esta semana`}
          />
          <Cifra
            href={hrefLeads("sin_seguimiento")}
            titulo="Leads sin seguimiento"
            n={g.sin_seguimiento.n}
            tono={g.sin_seguimiento.n > 0 ? "aviso" : "neutro"}
            pie="vivos, sin nada comprometido"
          />
          <Cifra
            href="#cotizaciones"
            titulo="Cotizaciones sin accion"
            n={g.cotizaciones.sin_accion_n}
            tono={g.cotizaciones.sin_accion_n > 0 ? "aviso" : "neutro"}
            pie="en juego, sin proxima accion"
          />
          {g.sin_propietario != null && (
            <Cifra
              href={hrefLeads("sin_propietario")}
              titulo="Leads sin propietario"
              n={g.sin_propietario}
              tono={g.sin_propietario > 0 ? "aviso" : "neutro"}
              pie="hay que asignarlos"
            />
          )}
        </div>
      </section>
    </div>
  );
}

const TONOS = {
  critico: "border-red-300 bg-red-50 text-red-800",
  acento: "border-verde/40 bg-verde/5 text-verde",
  aviso: "border-dorado bg-crema text-dorado-osc",
  neutro: "border-gray-200 bg-white text-negro",
} as const;

function Cifra({
  href,
  ancla,
  titulo,
  n,
  pie,
  tono = "neutro",
}: {
  href: string;
  ancla?: string;
  titulo: string;
  n: number;
  pie: string;
  tono?: keyof typeof TONOS;
}) {
  return (
    <Link
      href={ancla ? `${href}-${ancla}` : href}
      className={`block rounded border px-2 py-1.5 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-verde ${TONOS[tono]}`}
    >
      <span className="block text-[10px] uppercase tracking-wide opacity-80">{titulo}</span>
      <span className="block text-lg font-bold leading-tight tabular-nums">{n.toLocaleString("es-CL")}</span>
      <span className="block text-[10px] text-gray-600">{pie}</span>
    </Link>
  );
}
