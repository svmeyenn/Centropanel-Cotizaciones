import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import { estadoLegible } from "@/lib/leads";
import type { LeadDeCotizacion as Lead } from "@/lib/leadsDeCotizacion";

// El lead que gesto la cotizacion, para volver a el sin pasar por la lista. Va
// arriba del detalle: es lo primero que se busca al abrir una cotizacion que
// viene de una conversacion. Si no hay ninguno se dice, para que nadie se
// pregunte donde esta el enlace.
export default function LeadDeCotizacion({ leads, omitidos }: { leads: Lead[]; omitidos: number }) {
  if (leads.length === 0) {
    return (
      <p className="text-[11px] text-gray-500">
        Sin lead asociado: ninguna oportunidad del CRM menciona este folio y ningun lead es de este cliente.
      </p>
    );
  }

  const deOportunidad = leads.filter((l) => l.via === "oportunidad");
  const deFicha = leads.filter((l) => l.via === "ficha");

  return (
    <section aria-label="Lead de la cotizacion" className="bg-white border border-gray-200 rounded px-3 py-2 space-y-1.5">
      {deOportunidad.length > 0 && <Grupo titulo="Lead de origen" leads={deOportunidad} />}
      {deFicha.length > 0 && (
        <Grupo
          titulo={deOportunidad.length > 0 ? "Otros leads de este cliente" : "Leads de este cliente"}
          leads={deFicha}
          omitidos={omitidos}
        />
      )}
    </section>
  );
}

function Grupo({ titulo, leads, omitidos = 0 }: { titulo: string; leads: Lead[]; omitidos?: number }) {
  return (
    <div>
      <h2 className="text-[10px] font-semibold text-dorado-osc uppercase tracking-wide">{titulo}</h2>
      <ul className="divide-y divide-gray-100">
        {leads.map((l) => (
          <li key={l.id_clientify} className="py-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
            <BanderaDe idPais={l.id_pais} />
            <Link href={`/leads/${l.id_clientify}`} className="font-semibold text-verde underline break-words">
              {l.nombre}
            </Link>
            <span className="text-[10px] border border-gray-300 rounded px-1 text-gray-700">{estadoLegible(l.estado)}</span>
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
