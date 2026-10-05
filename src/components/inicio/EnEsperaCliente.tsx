import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import BotonRetomar from "@/components/inicio/BotonRetomar";
import { importe } from "@/lib/formato";
import { etiquetaDe } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import { antiguedad, type FilaEspera, type Gestion } from "@/components/inicio/tipos";

// Lo que el cliente pidio no seguir molestando y se deja esperando su respuesta.
// Sale de los listados de pendientes --agenda, por contactar, sin seguimiento--
// para que no estorbe, pero no se pierde: aqui se ve cuanto lleva esperando y se
// retoma cuando el cliente responde. Va del mas reciente al mas antiguo, como
// todos los cuadros del inicio.
export default async function EnEsperaCliente({
  g,
  verResponsable,
  puedeEditar,
}: {
  g: Gestion;
  verResponsable: boolean;
  puedeEditar: boolean;
}) {
  const e = g.en_espera;
  if (!e) return null;
  const cat = await catalogoEstados();

  return (
    <section
      id="en-espera"
      aria-labelledby="titulo-espera"
      className="bg-white border border-amber-300 rounded overflow-hidden flex flex-col scroll-mt-4"
    >
      <div className="bg-amber-700 text-white px-3 py-1.5">
        <h2 id="titulo-espera" className="text-[11px] font-semibold uppercase">
          En espera del cliente · {e.n.toLocaleString("es-CL")}
        </h2>
      </div>
      <p className="px-3 pt-1.5 text-[10px] text-gray-500">
        Pidieron que no los molesten y se espera su respuesta. No aparecen en los pendientes ni en la agenda; agendar un
        compromiso nuevo, o &quot;Retomar&quot;, los devuelve.
      </p>

      {e.lista.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-gray-500">Nada en espera.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {e.lista.map((f) => (
            <Fila key={f.id} f={f} verResponsable={verResponsable} puedeEditar={puedeEditar} cat={cat} />
          ))}
        </ul>
      )}
      {e.n > e.lista.length && (
        <p className="px-3 py-1.5 text-[11px] text-gray-500 border-t border-gray-100">
          Se muestran {e.lista.length} de {e.n.toLocaleString("es-CL")}, de la mas reciente a la mas antigua.
        </p>
      )}
    </section>
  );
}

function Fila({
  f,
  verResponsable,
  puedeEditar,
  cat,
}: {
  f: FilaEspera;
  verResponsable: boolean;
  puedeEditar: boolean;
  cat: Awaited<ReturnType<typeof catalogoEstados>>;
}) {
  const esLead = f.tipo === "lead";
  const href = esLead ? `/leads/${f.id_lead}` : `/cotizaciones/${f.id_cot}`;
  return (
    <li className="px-3 py-1.5 text-[11px] flex items-start gap-1.5">
      <BanderaDe idPais={f.id_pais} />
      <span
        className={`shrink-0 text-[9px] font-semibold border rounded px-1 mt-0.5 ${
          esLead ? "text-verde border-verde" : "text-dorado-osc border-dorado-osc"
        }`}
      >
        {esLead ? "Lead" : "Cotizacion"}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={href} className="font-semibold text-verde underline break-words">
          {f.nombre}
        </Link>
        <p className="text-[10px] text-gray-500">
          {esLead ? etiquetaDe(cat.lead, f.estado) : etiquetaDe(cat.cotizacion, f.estado)}
          {!esLead && f.folio && (
            <span className="text-gray-600">
              {" "}
              · {f.folio} · {importe(f.monto ?? 0, f.moneda ?? "CLP")}
            </span>
          )}
          {verResponsable && f.quien && <span className="text-gray-600"> · lo dejo {f.quien}</span>}
        </p>
        {f.motivo && <p className="text-[10px] text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{f.motivo}</p>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-[10px] text-gray-600">{f.dias <= 0 ? "desde hoy" : `hace ${antiguedad(f.dias)}`}</span>
        {puedeEditar && <BotonRetomar id={f.id} idLead={f.id_lead} idCot={f.id_cot} />}
      </div>
    </li>
  );
}
