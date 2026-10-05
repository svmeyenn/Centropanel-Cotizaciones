import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import PildoraLinea from "@/components/PildoraLinea";
import { LINEAS } from "@/lib/leads";
import { antiguedad, diasEntre, type Gestion, type LeadEnBandeja } from "@/components/inicio/tipos";
import { BarraOrden } from "@/components/TituloOrden";
import FiltrosCuadro from "@/components/FiltrosCuadro";
import { NUEVOS } from "@/components/inicio/orden";
import SinSeguimiento from "@/components/inicio/SinSeguimiento";
import type { Orden } from "@/lib/ordenTabla";

// Lo que espera sin fecha, en dos cuadros: los leads nuevos que nadie ha
// contactado, y todo lo vivo que nadie tiene comprometido --leads y
// cotizaciones juntos, porque el seguimiento de una cotizacion equivale al de un
// lead--. Ambos van del mas nuevo al mas antiguo; lo que no cabe en las quince
// filas se busca con los filtros o en las listas completas.
export default function BandejaLeads({
  g,
  verPropietario,
  hrefSinContactar,
  hrefSinSeguimiento,
  qs,
  ordenNuevos,
  ordenSeguimiento,
}: {
  g: Gestion;
  verPropietario: boolean;
  hrefSinContactar: string;
  hrefSinSeguimiento: string;
  qs: string;
  ordenNuevos: Orden;
  ordenSeguimiento: Orden;
}) {
  const lineas = [
    { valor: "paneles", texto: LINEAS.paneles },
    { valor: "casas", texto: LINEAS.casas },
  ];
  const lista = (vs: string[]) => vs.map((v) => ({ valor: v, texto: v }));
  const o = g.opciones;

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <Lista
        titulo="Por contactar"
        explicacion="Leads nuevos que nadie ha contactado todavia."
        total={g.sin_contactar.n_filtrado ?? g.sin_contactar.n}
        filas={g.sin_contactar.lista}
        href={hrefSinContactar}
        barra={<BarraOrden qs={qs} param={NUEVOS.param} actual={ordenNuevos} opciones={NUEVOS.columnas} />}
        filtro={
          <FiltrosCuadro
            selecciones={[
              { param: "f_nuevos_linea", texto: "Linea", opciones: lineas },
              { param: "f_nuevos_origen", texto: "Origen", opciones: lista(o?.nuevos_origen ?? []) },
              { param: "f_nuevos_prop", texto: "Propietario", opciones: lista(o?.nuevos_propietario ?? []) },
            ]}
            rangos={[{ param: "rg_nuevos", texto: "Fecha de entrada", tipo: "fecha" }]}
            nFiltrado={g.sin_contactar.n_filtrado ?? g.sin_contactar.n}
            nTotal={g.sin_contactar.n}
            unidad="leads"
          />
        }
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
      <SinSeguimiento
        g={g}
        verResponsable={verPropietario}
        qs={qs}
        orden={ordenSeguimiento}
        hrefLeads={hrefSinSeguimiento}
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
  barra,
  filtro,
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
  barra: React.ReactNode;
  filtro: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden flex flex-col">
      <div className="bg-verde text-white px-3 py-1.5 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase">
          Leads {titulo.toLowerCase()} · {total.toLocaleString("es-CL")}
        </h2>
      </div>
      {filtro}
      <div className="px-3 pt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[10px] text-gray-500">{explicacion}</p>
        {barra}
      </div>
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
