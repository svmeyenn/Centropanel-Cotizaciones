import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import PildoraLinea from "@/components/PildoraLinea";
import IconoTrabajoPrevio from "@/components/IconoTrabajoPrevio";
import { etiquetaDe } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import { antiguedad, diasEntre, type ListasLeadsDatos, type LeadDeLista } from "@/components/inicio/tipos";

// Dos listas de leads que piden mover algo:
//  - Sin seguimiento asignado en los ultimos 15 dias: leads que entraron de hoy a quince dias atras y
//    nadie tiene comprometidos. Va justo antes de la lista de siete dias, que es la que se enfria despues.
//  - Con trabajo previo: leads marcados porque hay que desarrollar, investigar o calcular antes de
//    responder; del mas antiguo al mas reciente, para que ninguno se quede esperando.

function Fila({ l, hoy, verPropietario, estado, dato }: { l: LeadDeLista; hoy: string; verPropietario: boolean; estado: string; dato: { texto: string; alerta: boolean } }) {
  return (
    <li className="px-3 py-1.5 text-[11px] flex items-start gap-1.5">
      <BanderaDe idPais={l.id_pais} />
      <PildoraLinea linea={l.linea} />
      <div className="min-w-0 flex-1">
        <Link href={`/leads/${l.id_clientify}`} className="font-semibold text-verde underline break-words">
          {l.nombre_completo || "(sin nombre)"}
        </Link>
        <p className="text-[10px] text-gray-500">
          {estado}
          {verPropietario && <span className="text-gray-600"> · {l.propietario ?? "sin propietario"}</span>}
          {l.origen && <span> · {l.origen}</span>}
        </p>
        {l.nota && <p className="text-[10px] text-gray-700 mt-0.5 break-words">{l.nota}</p>}
      </div>
      <span className={`shrink-0 text-[10px] text-right ${dato.alerta ? "text-red-700 font-semibold" : "text-gray-600"}`}>{dato.texto}</span>
    </li>
  );
}

function Cuadro({
  id,
  titulo,
  icono,
  n,
  explicacion,
  vacio,
  children,
  mostradas,
}: {
  id: string;
  titulo: string;
  icono?: React.ReactNode;
  n: number;
  explicacion: string;
  vacio: string;
  children: React.ReactNode;
  mostradas: number;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="bg-white border border-gray-200 rounded overflow-hidden flex flex-col scroll-mt-4">
      <div className="bg-verde text-white px-3 py-1.5 flex items-center gap-1.5">
        {icono}
        <h2 id={`${id}-t`} className="text-[11px] font-semibold uppercase">
          {titulo} · {n.toLocaleString("es-CL")}
        </h2>
      </div>
      <p className="px-3 pt-1.5 text-[10px] text-gray-500">{explicacion}</p>
      {mostradas === 0 ? <p className="px-3 py-5 text-center text-xs text-gray-500">{vacio}</p> : <ul className="divide-y divide-gray-100 flex-1">{children}</ul>}
      {n > mostradas && (
        <p className="px-3 py-1.5 text-[11px] text-gray-500 border-t border-gray-100">
          Se muestran {mostradas} de {n.toLocaleString("es-CL")}.
        </p>
      )}
    </section>
  );
}

export async function SinSeguimientoReciente({ d, hoy, verPropietario }: { d: ListasLeadsDatos["sin_seguimiento_15d"]; hoy: string; verPropietario: boolean }) {
  const cat = await catalogoEstados();
  return (
    <Cuadro
      id="sin-seguimiento-15"
      titulo="Leads sin seguimiento asignado · ultimos 15 dias"
      n={d.n}
      mostradas={d.lista.length}
      explicacion="Leads que entraron de hoy a 15 dias atras y nadie tiene comprometidos. Del mas nuevo al mas antiguo."
      vacio="Todos los leads de los ultimos 15 dias tienen algo comprometido."
    >
      {d.lista.map((l) => {
        const dias = l.creado_clientify ? diasEntre(l.creado_clientify.slice(0, 10), hoy) : null;
        return (
          <Fila
            key={l.id_clientify}
            l={l}
            hoy={hoy}
            verPropietario={verPropietario}
            estado={etiquetaDe(cat.lead, l.estado_efectivo ?? "")}
            dato={{ texto: dias == null ? "" : dias <= 0 ? "llego hoy" : `llego hace ${antiguedad(dias)}`, alerta: dias != null && dias > 7 }}
          />
        );
      })}
    </Cuadro>
  );
}

export async function ConTrabajoPrevio({ d, hoy, verPropietario }: { d: ListasLeadsDatos["trabajo_previo"]; hoy: string; verPropietario: boolean }) {
  const cat = await catalogoEstados();
  return (
    <Cuadro
      id="trabajo-previo"
      titulo="Leads con trabajo previo"
      icono={<IconoTrabajoPrevio className="h-4 w-4 text-white" />}
      n={d.n}
      mostradas={d.lista.length}
      explicacion="Leads que necesitan desarrollo, investigacion o calculos mas sofisticados antes de responder. Del mas antiguo al mas reciente."
      vacio="No hay leads marcados con trabajo previo."
    >
      {d.lista.map((l) => {
        const dias = l.marcado_en ? diasEntre(l.marcado_en.slice(0, 10), hoy) : null;
        return (
          <Fila
            key={l.id_clientify}
            l={l}
            hoy={hoy}
            verPropietario={verPropietario}
            estado={etiquetaDe(cat.lead, l.estado_efectivo ?? "")}
            dato={{ texto: dias == null ? "" : dias <= 0 ? "marcado hoy" : `marcado hace ${antiguedad(dias)}`, alerta: dias != null && dias > 7 }}
          />
        );
      })}
    </Cuadro>
  );
}
