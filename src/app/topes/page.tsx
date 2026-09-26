import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelTopes from "@/components/finanzas/PanelTopes";
import { cargarMaestros, cargarPoliticas } from "@/lib/finanzas/consultas";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Cuanto se puede gastar por boleta antes de que la rendicion quede marcada.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/topes")) redirect("/");

  const { idPaisActivo } = await contextoMercado(v);
  const { categorias } = await cargarMaestros(idPaisActivo);
  const politicas = await cargarPoliticas(idPaisActivo);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Topes de gasto"
        subtitulo="Hasta cuanto se rinde sin que quede marcado"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />
        <PanelTopes
          politicas={politicas}
          categorias={categorias}
          puedeEditar={v.fin_mantenedores}
        />
      </div>
    </div>
  );
}
