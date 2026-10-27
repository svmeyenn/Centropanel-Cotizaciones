import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import NuevaNecesidad from "@/components/NuevaNecesidad";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nueva necesidad de material" };
export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ proyecto?: string }> }) {
  const v = await requerirVendedor();
  if (!(["Administrador", "Supervisor", "Comprador"].includes(v.rol) || v.puede_crear)) redirect("/necesidades");
  const { proyecto } = await searchParams;
  const supabase = await createClient();

  const [{ data: proyectos }, { data: partidas }, { data: pedidos }] = await Promise.all([
    supabase.from("proyectos").select("id_proyecto, nombre, id_pais").eq("borrado", false).eq("activo", true).order("nombre"),
    supabase.from("proyecto_partidas").select("id, id_proyecto, nombre").order("orden").order("id"),
    supabase.from("pedidos").select("id, num_pedido, id_pais, id_proyecto").order("id", { ascending: false }).limit(300),
  ]);

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Nueva necesidad de material" subtitulo="Que se necesita, para que obra o pedido" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/necesidades" />
        <NuevaNecesidad
          proyectoInicial={proyecto ? Number(proyecto) : null}
          proyectos={(proyectos ?? []).map((p) => ({ id: Number(p.id_proyecto), nombre: p.nombre as string, id_pais: Number(p.id_pais) }))}
          partidas={(partidas ?? []).map((p) => ({ id: Number(p.id), id_proyecto: Number(p.id_proyecto), nombre: p.nombre as string }))}
          pedidos={(pedidos ?? []).map((p) => ({ id: Number(p.id), num: p.num_pedido as string, id_pais: Number(p.id_pais) }))}
        />
      </div>
    </div>
  );
}
