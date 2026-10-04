import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import PildoraLinea from "@/components/PildoraLinea";
import { estadoLegible } from "@/lib/leads";
import { antiguedad, diasEntre, type Gestion, type LeadEnBandeja } from "@/components/inicio/tipos";

// Los leads que esperan sin fecha: los nuevos que nadie ha contactado (los mas
// recientes primero: un lead fresco se gana mas facil) y los vivos que se estan
// enfriando sin nada comprometido (los mas olvidados primero).
export default function BandejaLeads({
  g,
  verPropietario,
  hrefSinContactar,
  hrefSinSeguimiento,
}: {
  g: Gestion;
  verPropietario: boolean;
  hrefSinContactar: string;
  hrefSinSeguimiento: string;
}) {
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <Lista
        titulo="Por contactar"
        explicacion="Leads nuevos que nadie ha contactado todavia. Los mas recientes arriba."
        total={g.sin_contactar.n}
        filas={g.sin_contactar.lista}
        href={hrefSinContactar}
        vacio="No hay leads esperando el primer contacto."
        verPropietario={verPropietario}
        hoy={g.hoy}
        dato={(l) => {
          const d = l.creado_clientify ? diasEntre(l.creado_clientify.slice(0, 10), g.hoy) : null;
          return {
            texto: d == null ? "" : d <= 0 ? "llego hoy" : `espera hace ${antiguedad(d)}`,
            alerta: d != null && d > 2,
          };
        }}
        detalle={(l) => [l.origen, l.campana].filter(Boolean).join(" · ")}
      />
      <Lista
        titulo="Sin seguimiento"
        explicacion="Leads vivos (contactados, calientes u oportunidades) sin ningun compromiso por delante. Los mas olvidados arriba."
        total={g.sin_seguimiento.n}
        filas={g.sin_seguimiento.lista}
        href={hrefSinSeguimiento}
        vacio="Todos los leads vivos tienen algo comprometido."
        verPropietario={verPropietario}
        hoy={g.hoy}
        dato={(l) => {
          const ref = l.ultimo_toque ?? null;
          const d = ref ? diasEntre(ref.slice(0, 10), g.hoy) : null;
          return {
            texto: d == null ? "sin contacto registrado" : `ultimo contacto hace ${antiguedad(d)}`,
            alerta: d == null || d > 14,
          };
        }}
        detalle={(l) => estadoLegible(l.estado_efectivo)}
      />
    </div>
  );
}

function Lista({
  titulo,
  explicacion,
  total,
  filas,
  href,
  vacio,
  verPropietario,
  dato,
  detalle,
}: {
  titulo: string;
  explicacion: string;
  total: number;
  filas: LeadEnBandeja[];
  href: string;
  vacio: string;
  verPropietario: boolean;
  hoy: string;
  dato: (l: LeadEnBandeja) => { texto: string; alerta: boolean };
  detalle: (l: LeadEnBandeja) => string;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden flex flex-col">
      <div className="bg-verde text-white px-3 py-1.5 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase">
          Leads {titulo.toLowerCase()} · {total.toLocaleString("es-CL")}
        </h2>
      </div>
      <p className="px-3 pt-1.5 text-[10px] text-gray-500">{explicacion}</p>
      {filas.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-gray-500">{vacio}</p>
      ) : (
        <ul className="divide-y divide-gray-100 flex-1">
          {filas.map((l) => {
            const x = dato(l);
            const det = detalle(l);
            return (
              <li key={l.id_clientify} className="px-3 py-1.5 text-[11px] flex items-start gap-1.5">
                <BanderaDe idPais={l.id_pais} />
                <PildoraLinea linea={l.linea} />
                <div className="min-w-0 flex-1">
                  <Link href={`/leads/${l.id_clientify}`} className="font-semibold text-verde underline break-words">
                    {l.nombre_completo || "(sin nombre)"}
                  </Link>
                  <p className="text-[10px] text-gray-500 truncate" title={det}>
                    {det}
                    {verPropietario && <span className="text-gray-600"> · {l.propietario ?? "sin propietario"}</span>}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] ${x.alerta ? "text-red-700 font-semibold" : "text-gray-600"}`}>{x.texto}</span>
              </li>
            );
          })}
        </ul>
      )}
      {total > filas.length && (
        <Link href={href} className="block px-3 py-1.5 text-[11px] text-verde underline border-t border-gray-100 hover:bg-crema">
          Ver los {total.toLocaleString("es-CL")} en la lista de leads →
        </Link>
      )}
    </section>
  );
}
