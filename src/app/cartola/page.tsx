import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import { pesos } from "@/lib/formato";
import FiltrosMovimientos from "@/components/finanzas/FiltrosMovimientos";
import TablaCartola from "@/components/finanzas/TablaCartola";
import {
  cargarCartola,
  cargarMaestros,
  type Filtro,
} from "@/lib/finanzas/consultas";
import { agruparPorMes, fechaCorta } from "@/lib/finanzas/tipos";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// El movimiento de todas las cuentas en una sola linea de tiempo. Solo entra
// lo pagado: es lo unico que mueve plata de verdad.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Filtro>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/cartola")) redirect("/");

  const filtro = await searchParams;
  const hayFiltro = Object.values(filtro).some((x) => x);
  const { idPaisActivo } = await contextoMercado(v);

  const { cuentas, proyectos } = await cargarMaestros(idPaisActivo);
  const filas = await cargarCartola(filtro, idPaisActivo);

  // El saldo de cada cuenta sale del historial completo, no de lo que muestre
  // el filtro: un saldo que cambia al filtrar un mes no es un saldo.
  const todas = hayFiltro ? await cargarCartola({}, idPaisActivo) : filas;
  const saldos = cuentas
    .filter((c) => c.activa)
    .map((c) => ({
      cuenta: c.alias ?? c.banco,
      // Las filas vienen de la mas nueva a la mas vieja: la primera de cada
      // cuenta es la que deja el saldo de hoy.
      saldo:
        todas.find((f) => f.id_cuenta === c.id_cuenta)?.saldo ??
        Number(c.saldo_inicial ?? 0),
    }));

  const abonos = filas.reduce((t, f) => t + Number(f.abono), 0);
  const cargos = filas.reduce((t, f) => t + Number(f.cargo), 0);
  const grupos = agruparPorMes(filas);

  const filasExcel = filas.map((f) => [
    fechaCorta(f.fecha),
    f.origen_destino ?? "",
    f.cuenta ?? "",
    f.proyecto ? (f.cliente ? `${f.proyecto} - ${f.cliente}` : f.proyecto) : "",
    f.categoria ?? "",
    f.documento ?? "",
    f.comentario ?? "",
    Number(f.abono),
    Number(f.cargo),
    Number(f.saldo),
  ]) as (string | number | null)[][];

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Cartola consolidada"
        subtitulo="El movimiento de todas las cuentas en una sola linea"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />

        <FiltrosMovimientos
          base="/cartola"
          cuentas={cuentas}
          proyectos={proyectos}
          mostrarEstado={false}
          etiquetaEstados={{ pagado: "Pagado", pendiente: "Pendiente" }}
          extra={
            <BotonExportarFilas
              nombre="cartola"
              titulos={[
                "Fecha",
                "Origen / Destino",
                "Cuenta",
                "Proyecto / Cliente",
                "Categoria",
                "Documento",
                "Comentario",
                "Abono",
                "Cargo",
                "Saldo",
              ]}
              filas={filasExcel}
            />
          }
        />

        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span>
            <strong className="text-negro">{filas.length}</strong> movimientos
          </span>
          <span>
            Abonos:{" "}
            <strong className="text-negro tabular-nums">
              {pesos(abonos)}
            </strong>
          </span>
          <span>
            Cargos:{" "}
            <strong className="text-negro tabular-nums">
              {pesos(cargos)}
            </strong>
          </span>
          <span className="text-gray-500">
            Solo movimientos pagados, partiendo del saldo inicial de cada cuenta
          </span>
        </div>

        <TablaCartola grupos={grupos} saldos={saldos} hayFiltro={hayFiltro} />
      </div>
    </div>
  );
}
