import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelMeta from "@/components/PanelMeta";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { puedeCargarLeads } from "@/lib/leads";
import type { FilaMeta } from "@/lib/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeCargarLeads(v)) redirect("/leads");

  const supabase = await createClient();
  const { data } = await supabase.rpc("meta_comparar", { p_id: null });
  const filas = (data ?? []) as FilaMeta[];

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Leads de Meta"
        subtitulo="Comparar el archivo descargado de Meta con los leads del sistema"
      />
      <div className="max-w-screen-xl mx-auto p-4 space-y-3 text-[11px]">
        <BarraNavegacion volverA="/leads">
          <Link
            href="/leads"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Lista de leads
          </Link>
        </BarraNavegacion>
        <PanelMeta filas={filas} />
      </div>
    </div>
  );
}
