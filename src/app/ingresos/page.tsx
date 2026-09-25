import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import FiltrosMovimientos from "@/components/finanzas/FiltrosMovimientos";
import TablaIngresos from "@/components/finanzas/TablaIngresos";
import {
  cargarMaestros,
  cargarMovimientos,
  type Filtro,
} from "@/lib/finanzas/consultas";
import {
  etiquetaEstado,
  etiquetaInterlocutor,
  fechaCorta,
} from "@/lib/finanzas/tipos";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// La plata que entra: cobros, aportes y devoluciones. Un ingreso sin fecha es
// una proyeccion --todavia no llega-- y no mueve el saldo de ninguna cuenta
// hasta que se confirma.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Filtro>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/ingresos")) redirect("/");

  const filtro = await searchParams;
  const hayFiltro = Object.values(filtro).some((x) => x);
  const { idPaisActivo } = await contextoMercado(v);

  const { cuentas, proyectos, categorias, interlocutores } =
    await cargarMaestros(idPaisActivo);
  const movimientos = await cargarMovimientos(
    "Ingreso",
    filtro,
    idPaisActivo,
    interlocutores
  );

  // Lo mismo que muestra la tabla, para bajarlo a una planilla.
  const filasExcel = movimientos.map((m) => {
    const inter = interlocutores.find(
      (x) => x.id_interlocutor === m.id_interlocutor
    );
    const proyecto = proyectos.find((p) => p.id_proyecto === m.id_proyecto);
    return [
      fechaCorta(m.fecha),
      inter
        ? etiquetaInterlocutor(inter.razon_social, inter.nombre_referencia)
        : (m.origen_destino ?? ""),
      Number(m.monto),
      cuentas.find((c) => c.id_cuenta === m.id_cuenta)?.alias ?? "",
      proyecto
        ? proyecto.cliente
          ? `${proyecto.nombre} - ${proyecto.cliente}`
          : proyecto.nombre
        : "",
      categorias.find((c) => c.id_categoria === m.id_categoria)?.nombre ?? "",
      etiquetaEstado("Ingreso", m.estado_pago),
      m.comentario ?? "",
    ] as (string | number | null)[];
  });

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Ingresos" subtitulo="La plata que entra y en que cuenta queda" />

      <div className="p-6 space-y-4">
        <BarraNavegacion />

        <FiltrosMovimientos
          base="/ingresos"
          cuentas={cuentas}
          proyectos={proyectos}
          interlocutores={interlocutores}
          etiquetaEstados={{ pagado: "Recibido", pendiente: "Proyectado" }}
          extra={
            <BotonExportarFilas
              nombre="ingresos"
              titulos={[
                "Fecha",
                "Origen",
                "Monto",
                "Cuenta",
                "Proyecto / Cliente",
                "Categoria",
                "Estado",
                "Comentario",
              ]}
              filas={filasExcel}
            />
          }
        />

        <TablaIngresos
          movimientos={movimientos}
          cuentas={cuentas}
          proyectos={proyectos}
          categorias={categorias}
          interlocutores={interlocutores}
          puedeEditar={v.fin_editar}
          hayFiltro={hayFiltro}
        />
      </div>
    </div>
  );
}
