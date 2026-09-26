import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import FiltrosMovimientos from "@/components/finanzas/FiltrosMovimientos";
import TablaEgresos from "@/components/finanzas/TablaEgresos";
import {
  cargarEnlacesRespaldo,
  cargarMaestros,
  cargarMovimientos,
  type Filtro,
} from "@/lib/finanzas/consultas";
import {
  etiquetaInterlocutor,
  fechaCorta,
  fechaDeRegistro,
} from "@/lib/finanzas/tipos";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Lo que se paga. Un egreso nace como solicitud --pendiente, sin fecha y con
// respaldo obligatorio-- y solo quien tiene permiso de pagar le pone fecha, que
// es cuando entra en la cartola.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Filtro>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/egresos")) redirect("/");

  const filtro = await searchParams;
  const hayFiltro = Object.values(filtro).some((x) => x);
  const { idPaisActivo } = await contextoMercado(v);

  const { cuentas, proyectos, categorias, interlocutores } =
    await cargarMaestros(idPaisActivo);
  const movimientos = await cargarMovimientos(
    "Egreso",
    filtro,
    idPaisActivo,
    interlocutores
  );
  const enlaces = await cargarEnlacesRespaldo(movimientos.map((m) => m.id_mov));

  // Para mostrar quien solicito cada gasto con su nombre.
  const supabase = await createClient();
  const { data: gente } = await supabase.from("vendedores").select("id, nombre");
  const vendedores = (gente ?? []) as { id: number; nombre: string }[];

  const filasExcel = movimientos.map((m) => {
    const inter = interlocutores.find(
      (x) => x.id_interlocutor === m.id_interlocutor
    );
    const proyecto = proyectos.find((p) => p.id_proyecto === m.id_proyecto);
    return [
      m.fecha ? fechaCorta(m.fecha) : "Pendiente",
      fechaDeRegistro(m.fecha_registro),
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
      m.comentario ?? "",
      m.documento ?? "",
      m.estado_pago,
      vendedores.find((x) => x.id === m.id_vendedor)?.nombre ?? "",
    ] as (string | number | null)[];
  });

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Egresos"
        subtitulo="Lo que se paga y lo que esta pendiente de pago"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />

        <FiltrosMovimientos
          base="/egresos"
          cuentas={cuentas}
          proyectos={proyectos}
          interlocutores={interlocutores}
          etiquetaEstados={{ pagado: "Pagado", pendiente: "Pendiente" }}
          extra={
            <BotonExportarFilas
              nombre="egresos"
              titulos={[
                "Fecha de pago",
                "Pedido el",
                "Destino",
                "Monto",
                "Cuenta",
                "Proyecto / Cliente",
                "Categoria",
                "Comentario",
                "Documento",
                "Estado",
                "Solicito",
              ]}
              filas={filasExcel}
            />
          }
        />

        <TablaEgresos
          movimientos={movimientos}
          cuentas={cuentas}
          proyectos={proyectos}
          categorias={categorias}
          interlocutores={interlocutores}
          vendedores={vendedores}
          puedeSolicitar={v.fin_solicitar_gastos}
          puedePagar={v.fin_pagar_gastos}
          enlaces={enlaces}
          hayFiltro={hayFiltro}
        />
      </div>
    </div>
  );
}
