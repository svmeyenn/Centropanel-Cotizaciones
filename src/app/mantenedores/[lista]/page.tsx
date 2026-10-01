import { notFound, redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelMantenedores, {
  type Pestana,
} from "@/components/finanzas/PanelMantenedores";
import {
  cargarCuentasInterlocutores,
  cargarMaestros,
} from "@/lib/finanzas/consultas";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Cada lista tiene su propia direccion y su propia entrada en el menu: antes
// las cuatro vivian detras de una sola pantalla y habia que entrar y despues
// elegir la pestana.
const LISTAS: Record<
  string,
  { pestana: Pestana; titulo: string; subtitulo: string }
> = {
  cuentas: {
    pestana: "Cuentas",
    titulo: "Cuentas bancarias",
    subtitulo: "Por donde entra y sale la plata",
  },
  proyectos: {
    pestana: "Proyectos",
    titulo: "Proyectos y clientes",
    subtitulo: "Las obras a las que se imputa cada movimiento",
  },
  categorias: {
    pestana: "Categorias",
    titulo: "Categorias",
    subtitulo: "Con que se clasifica cada ingreso y cada egreso",
  },
};

export default async function Pagina({
  params,
}: {
  params: Promise<{ lista: string }>;
}) {
  const { lista } = await params;
  // Los interlocutores se unieron con los clientes en una sola lista. Quien
  // tenga la direccion vieja guardada llega igual a donde estan ahora.
  if (lista === "interlocutores") redirect("/clientes?tipo=proveedor");
  const cual = LISTAS[lista];
  if (!cual) notFound();

  const v = await requerirVendedor();
  if (!puedeVerRuta(v, `/mantenedores/${lista}`)) redirect("/");

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
      <Cabecera titulo={cual.titulo} subtitulo={cual.subtitulo} />

      <div className="p-6 space-y-4">
        <BarraNavegacion />
        <PanelMantenedores
          pestana={cual.pestana}
          cuentas={cuentas}
          proyectos={proyectos}
          categorias={categorias}
          interlocutores={interlocutores}
          cuentasInterlocutores={cuentasInterlocutores}
          moneda={moneda}
          mercados={accesibles.map((p) => ({ id: p.id, codigo: p.codigo }))}
          mercadoActivo={idPaisActivo}
        />
      </div>
    </div>
  );
}
