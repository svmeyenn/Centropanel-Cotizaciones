import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import DetalleRendicion from "@/components/finanzas/DetalleRendicion";
import {
  cargarAnticiposDeRendicion,
  cargarAnticiposDisponibles,
  cargarBoletas,
  cargarEnlacesBoletas,
  cargarMaestros,
  cargarRendicion,
} from "@/lib/finanzas/consultas";
import { LECTURA_CONFIGURADA } from "@/lib/finanzas/lectura-boleta";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Una rendicion con sus boletas y sus anticipos. Si no aparece puede ser que
// no exista o que no sea suya: la base no distingue, y esta bien que no lo
// haga.
export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/rendiciones")) redirect("/");

  const { id } = await params;
  const idRendicion = Number(id);
  if (!Number.isInteger(idRendicion)) notFound();

  const rendicion = await cargarRendicion(idRendicion);
  if (!rendicion) notFound();

  const { idPaisActivo } = await contextoMercado(v);
  const [{ cuentas, proyectos, categorias }, boletas, anticipos] =
    await Promise.all([
      cargarMaestros(idPaisActivo),
      cargarBoletas(idRendicion),
      cargarAnticiposDeRendicion(idRendicion),
    ]);

  const enlaces = await cargarEnlacesBoletas(boletas.map((b) => b.id_gasto));
  const anticiposDisponibles = v.fin_pagar_gastos
    ? await cargarAnticiposDisponibles(rendicion.id_interlocutor)
    : [];

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Rendicion de gastos"
        subtitulo="Las boletas del periodo y como termina la cuenta"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />

        <Link
          href="/rendiciones"
          className="inline-block text-xs text-gray-600 underline"
        >
          Volver a rendiciones
        </Link>

        <DetalleRendicion
          rendicion={rendicion}
          boletas={boletas}
          anticipos={anticipos}
          anticiposDisponibles={anticiposDisponibles}
          categorias={categorias}
          proyectos={proyectos}
          cuentas={cuentas}
          puedePagar={v.fin_pagar_gastos}
          enlaces={enlaces}
          lecturaDisponible={LECTURA_CONFIGURADA}
        />
      </div>
    </div>
  );
}
