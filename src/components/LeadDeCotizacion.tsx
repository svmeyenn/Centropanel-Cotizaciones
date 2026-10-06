import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import { etiquetaDe, type Estado } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import type { LeadDeCotizacion as Lead } from "@/lib/leadsDeCotizacion";
import { QuitarVinculo, VincularLeadACotizacion } from "@/components/VincularLead";

// El lead que gesto la cotizacion, para volver a el sin pasar por la lista. Va
// arriba del detalle: es lo primero que se busca al abrir una cotizacion que
// viene de una conversacion. Si no hay ninguno se dice, para que nadie se
// pregunte donde esta el enlace.
export default async function LeadDeCotizacion({
  leads,
  omitidos,
  idCotizacion,
  puedeVincular = false,
}: {
  leads: Lead[];
  omitidos: number;
  idCotizacion?: number;
  puedeVincular?: boolean;
}) {
  const estados = (await catalogoEstados()).lead;

  if (leads.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-[11px] text-gray-500">
          Sin lead asociado: ninguna oportunidad del CRM menciona este folio y ningun lead es de este cliente.
        </p>
        {puedeVincular && idCotizacion != null && <VincularLeadACotizacion idCot={idCotizacion} estadosLead={estados} />}
      </div>
    );
  }

  const aMano = leads.filter((l) => l.via === "manual");
  const deOportunidad = leads.filter((l) => l.via === "oportunidad");
  const deFicha = leads.filter((l) => l.via === "ficha");

  return (
    <section aria-label="Lead de la cotizacion" className="bg-white border border-gray-200 rounded px-3 py-2 space-y-1.5">
      {aMano.length > 0 && (
        <Grupo
          titulo="Lead vinculado a mano"
          leads={aMano}
          estados={estados}
          quitar={puedeVincular && idCotizacion != null ? <QuitarVinculo idCot={idCotizacion} idLead={aMano[0].id_clientify} /> : undefined}
        />
      )}
      {deOportunidad.length > 0 && <Grupo titulo="Lead de origen" leads={deOportunidad} estados={estados} />}
      {deFicha.length > 0 && (
        <Grupo
          titulo={deOportunidad.length > 0 ? "Otros leads de este cliente" : "Leads de este cliente"}
          leads={deFicha}
          estados={estados}
          omitidos={omitidos}
        />
      )}
      {puedeVincular && idCotizacion != null && (
        <div className="pt-1">
          <VincularLeadACotizacion idCot={idCotizacion} estadosLead={estados} />
        </div>
      )}
    </section>
  );
}

function Grupo({
  titulo,
  leads,
  estados,
  omitidos = 0,
  quitar,
}: {
  titulo: string;
  leads: Lead[];
  estados: Estado[];
  omitidos?: number;
  quitar?: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-[10px] font-semibold text-dorado-osc uppercase tracking-wide flex flex-wrap items-center gap-x-3">
        {titulo}
        {quitar && <span className="normal-case tracking-normal font-normal">{quitar}</span>}
      </h2>
      <ul className="divide-y divide-gray-100">
        {leads.map((l) => (
          <li key={l.id_clientify} className="py-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
            <BanderaDe idPais={l.id_pais} />
            <Link href={`/leads/${l.id_clientify}`} className="font-semibold text-verde underline break-words">
              {l.nombre}
            </Link>
            <span className="text-[10px] border border-gray-300 rounded px-1 text-gray-700">{etiquetaDe(estados, l.estado)}</span>
            {l.propietario && <span className="text-[11px] text-gray-600">· {l.propietario}</span>}
            {l.oportunidad && (
              <span className="text-[11px] text-gray-500 break-words" title="Oportunidad del CRM que nombra esta cotizacion">
                · {l.oportunidad}
              </span>
            )}
            <Link href={`/leads/${l.id_clientify}`} className="ml-auto text-[11px] text-verde underline whitespace-nowrap">
              Ir al lead →
            </Link>
          </li>
        ))}
      </ul>
      {omitidos > 0 && (
        <p className="text-[10px] text-gray-500">
          y {omitidos} lead{omitidos === 1 ? "" : "s"} mas de este cliente, en la lista de leads.
        </p>
      )}
    </div>
  );
}
