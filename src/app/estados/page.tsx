import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorEstados from "@/components/GestorEstados";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { ordenados, type TipoEstado } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";

export const metadata = { title: "Estados" };
export const dynamic = "force-dynamic";

const TIPOS: Record<TipoEstado, { titulo: string; unidad: string; intro: string }> = {
  lead: {
    titulo: "Leads",
    unidad: "leads",
    intro:
      "Los estados de un lead vienen de Clientify: su codigo no cambia, pero el nombre con que se leen aqui si. " +
      "Lo que marque en \"Que significa\" decide en que cuentas entra cada estado --\"Sin seguimiento\", los " +
      "contactados del tablero, la conversion, el embudo--. Los del sistema se renombran y se reordenan; no se eliminan.",
  },
  cotizacion: {
    titulo: "Cotizaciones",
    unidad: "cotizaciones",
    intro:
      "El estado de una cotizacion dice en que va: lo que todavia se puede ganar, lo que espera respuesta, lo que ya " +
      "termino. Lo que marque en \"Que significa\" decide en que cuentas entra cada estado --cotizaciones en juego, " +
      "pendientes de cierre, sin seguimiento--. Los del sistema se renombran y se reordenan; no se eliminan.",
  },
};

// Los estados de leads y de cotizaciones. Son los mismos en Chile y en Peru, asi
// que los cambia solo quien administra los dos mercados.
export default async function Pagina({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/estados")) redirect("/");

  const tipo: TipoEstado = (await searchParams).tipo === "cotizacion" ? "cotizacion" : "lead";
  const cual = TIPOS[tipo];
  const todos = ordenados((await catalogoEstados())[tipo]);

  // Cuantos registros tiene hoy cada estado: es lo que impide eliminar uno en uso.
  const supabase = await createClient();
  const cuentas = await Promise.all(
    todos.map(async (e) => {
      const { count } =
        tipo === "lead"
          ? await supabase.from("v_leads").select("id_clientify", { count: "exact", head: true }).eq("estado_efectivo", e.codigo)
          : await supabase.from("cotizaciones").select("id", { count: "exact", head: true }).eq("estado", e.codigo);
      return [e.codigo, count ?? 0] as const;
    })
  );
  const usos = Object.fromEntries(cuentas);

  return (
    <div className="min-h-screen">
      <Cabecera titulo="ESTADOS" subtitulo="Como se llaman y que significan los estados de leads y de cotizaciones" />
      <div className="max-w-screen-xl mx-auto p-4 space-y-3">
        <BarraNavegacion />

        <nav aria-label="Que estados" className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(TIPOS) as TipoEstado[]).map((t) => (
            <Link
              key={t}
              href={`/estados?tipo=${t}`}
              aria-current={t === tipo ? "page" : undefined}
              className={`bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ${
                t === tipo ? "ring-2 ring-dorado ring-offset-1" : "opacity-70"
              }`}
            >
              {TIPOS[t].titulo}
            </Link>
          ))}
        </nav>

        <p className="bg-white border border-gray-200 rounded px-3 py-2 text-[12px] text-gray-700">{cual.intro}</p>

        <GestorEstados tipo={tipo} estados={todos} usos={usos} unidad={cual.unidad} />
      </div>
    </div>
  );
}
