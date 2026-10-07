import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorMotivos, { type EstadoConMotivos } from "@/components/GestorMotivos";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { ordenados, type TipoEstado } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";

export const metadata = { title: "Motivos de estado" };
export const dynamic = "force-dynamic";

const TIPOS: Record<TipoEstado, { titulo: string; intro: string }> = {
  lead: {
    titulo: "Leads",
    intro:
      "Al cambiar el estado de un lead a mano, quien lo cambia puede elegir uno de estos motivos y dejar un comentario. " +
      "Cada estado tiene sus propios motivos.",
  },
  cotizacion: {
    titulo: "Cotizaciones",
    intro:
      "Al cambiar el estado de una cotizacion a mano, quien lo cambia puede elegir uno de estos motivos y dejar un comentario. " +
      "Cada estado tiene sus propios motivos. Los cambios que hace el sistema por su cuenta --al enviar la cotizacion, al generar el pedido-- no piden motivo.",
  },
};

// Las listas de motivos de los estados de leads y de cotizaciones. Son las mismas en Chile y
// en Peru, asi que las cambia solo quien administra los dos mercados.
export default async function Pagina({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/motivos")) redirect("/");

  const tipo: TipoEstado = (await searchParams).tipo === "cotizacion" ? "cotizacion" : "lead";
  const estados = ordenados((await catalogoEstados())[tipo]);

  const supabase = await createClient();
  const [{ data: motivos }, { data: oblig }] = await Promise.all([
    supabase.from("motivos_estado").select("id, estado, etiqueta, activo").eq("tipo", tipo).order("orden").order("id"),
    supabase.from("motivos_obligatorios").select("estado").eq("tipo", tipo),
  ]);
  const exigen = new Set((oblig ?? []).map((o) => String(o.estado)));
  const lista: EstadoConMotivos[] = estados.map((e) => ({
    codigo: e.codigo,
    etiqueta: e.etiqueta,
    activo: e.activo,
    obligatorio: exigen.has(e.codigo),
    motivos: ((motivos ?? []) as { id: number; estado: string; etiqueta: string; activo: boolean }[])
      .filter((m) => m.estado === e.codigo)
      .map((m) => ({ id: Number(m.id), estado: m.estado, etiqueta: m.etiqueta, activo: m.activo })),
  }));

  return (
    <div className="min-h-screen">
      <Cabecera titulo="MOTIVOS DE ESTADO" subtitulo="Por que un lead o una cotizacion cambia de estado" />
      <div className="max-w-screen-xl mx-auto p-4 space-y-3">
        <BarraNavegacion />

        <nav aria-label="Que estados" className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(TIPOS) as TipoEstado[]).map((t) => (
            <Link
              key={t}
              href={`/motivos?tipo=${t}`}
              aria-current={t === tipo ? "page" : undefined}
              className={`bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ${t === tipo ? "ring-2 ring-dorado ring-offset-1" : "opacity-70"}`}
            >
              {TIPOS[t].titulo}
            </Link>
          ))}
        </nav>

        <p className="bg-white border border-gray-200 rounded px-3 py-2 text-[12px] text-gray-700">{TIPOS[tipo].intro}</p>

        <GestorMotivos tipo={tipo} estados={lista} />
      </div>
    </div>
  );
}
