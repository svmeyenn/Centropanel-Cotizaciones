import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelMantenedores from "@/components/finanzas/PanelMantenedores";
import {
  cargarCuentasInterlocutores,
  cargarMaestros,
} from "@/lib/finanzas/consultas";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Las listas con que se clasifica cada movimiento: las cuentas por donde entra
// y sale la plata, los proyectos a los que se imputa, las categorias y las
// personas u organizaciones con las que se mueve.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/mantenedores")) redirect("/");

  const { idPaisActivo, accesibles } = await contextoMercado(v);
  const { cuentas, proyectos, categorias, interlocutores } =
    await cargarMaestros(idPaisActivo);
  const cuentasInterlocutores = await cargarCuentasInterlocutores();

  // La moneda que se propone al abrir una cuenta nueva sale del mercado.
  const moneda =
    accesibles.find((p) => p.id === idPaisActivo)?.moneda_base ??
    accesibles[0]?.moneda_base ??
    "CLP";

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Cuentas, proyectos y categorias"
        subtitulo="Las listas con que se clasifica cada movimiento"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />
        <PanelMantenedores
          cuentas={cuentas}
          proyectos={proyectos}
          categorias={categorias}
          interlocutores={interlocutores}
          cuentasInterlocutores={cuentasInterlocutores}
          moneda={moneda}
        />
      </div>
    </div>
  );
}
