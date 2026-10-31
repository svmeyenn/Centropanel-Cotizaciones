import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelPeriodos from "@/components/finanzas/PanelPeriodos";
import { puedeVerRuta } from "@/lib/menu";
import { esSuperAdmin } from "@/lib/permisos";
import { contextoMercado, paisAdministrado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string; anio?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/periodos")) redirect("/");

  const sp = await searchParams;
  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, sp.pais);
  if (!pais) redirect("/");

  const anioActual = new Date().getFullYear();
  const anio = /^\d{4}$/.test(sp.anio ?? "") ? Number(sp.anio) : anioActual;

  const supabase = await createClient();
  const [periodos, historial, puede, vendedores] = await Promise.all([
    supabase.from("periodos").select("mes, estado, cerrado_por, cerrado_en").eq("id_pais", pais.id).eq("anio", anio),
    supabase
      .from("periodos_historial")
      .select("id, anio, mes, accion, motivo, id_vendedor, en")
      .eq("id_pais", pais.id)
      .order("en", { ascending: false })
      .limit(30),
    supabase.rpc("puede_cerrar_periodo"),
    supabase.from("vendedores").select("id, nombre"),
  ]);
  const nombre = new Map((vendedores.data ?? []).map((x) => [Number(x.id), x.nombre as string]));

  return (
    <div className="min-h-screen vista-fin">
      <Cabecera
        titulo="Cierre de períodos"
        subtitulo="El contador cierra cada mes al terminar su proceso; desde ahí nada con esa fecha se puede crear ni cambiar"
      />
      <div className="max-w-[90rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelPeriodos
          pais={{ id: pais.id, nombre: pais.nombre, codigo: pais.codigo }}
          paises={ctx.activo ? [] : ctx.accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
          anio={anio}
          anios={[anioActual - 2, anioActual - 1, anioActual, anioActual + 1]}
          hoyMes={anio === anioActual ? new Date().getMonth() + 1 : anio < anioActual ? 13 : 0}
          estados={Object.fromEntries(
            (periodos.data ?? []).map((p) => [
              Number(p.mes),
              {
                estado: p.estado as string,
                por: p.cerrado_por == null ? null : (nombre.get(Number(p.cerrado_por)) ?? null),
                en: (p.cerrado_en as string | null) ?? null,
              },
            ])
          )}
          historial={(historial.data ?? []).map((h) => ({
            id: Number(h.id),
            anio: Number(h.anio),
            mes: Number(h.mes),
            accion: h.accion as string,
            motivo: (h.motivo as string | null) ?? null,
            por: nombre.get(Number(h.id_vendedor)) ?? "—",
            en: h.en as string,
          }))}
          puedeCerrar={puede.data === true}
          puedeReabrir={esSuperAdmin(v)}
        />
      </div>
    </div>
  );
}
