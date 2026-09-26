import { redirect } from "next/navigation";
import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import TablaResumenProyecto from "@/components/finanzas/TablaResumenProyecto";
import { cargarResumenProyecto } from "@/lib/finanzas/consultas";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Cuanto entro y cuanto salio en cada obra. Un anticipo entregado no cuenta
// como gasto: entra cuando se rinde, y por eso aqui suman los gastos rendidos
// que ya fueron aceptados.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/resumen-proyecto")) redirect("/");

  const { desde, hasta } = await searchParams;
  const hayFiltro = Boolean(desde || hasta);
  const { idPaisActivo } = await contextoMercado(v);

  const filas = await cargarResumenProyecto(
    desde ?? null,
    hasta ?? null,
    idPaisActivo
  );

  const filasExcel = filas.map((f) => [
    f.proyecto,
    f.cliente ?? "",
    Number(f.movimientos),
    Number(f.ingresos),
    Number(f.egresos),
    Number(f.resultado),
    Number(f.pendiente),
  ]) as (string | number | null)[][];

  const campo =
    "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Resumen por proyecto"
        subtitulo="Ingresos, egresos y resultado de cada obra"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />

        <form
          className="bg-white border border-gray-200 rounded p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          action="/resumen-proyecto"
        >
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Desde
            </span>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className={campo}
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Hasta
            </span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className={campo}
            />
          </label>

          <div className="flex items-end gap-2">
            <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">
              Filtrar
            </button>
            {hayFiltro && (
              <Link
                href="/resumen-proyecto"
                className="text-xs text-gray-600 underline self-center pb-1.5"
              >
                limpiar
              </Link>
            )}
            <BotonExportarFilas
              nombre="resumen-por-proyecto"
              titulos={[
                "Proyecto",
                "Cliente",
                "Movimientos",
                "Ingresos",
                "Egresos",
                "Resultado",
                "Pendiente",
              ]}
              filas={filasExcel}
            />
          </div>

          <p className="text-[11px] text-gray-500 self-end pb-1.5">
            {hayFiltro
              ? "Solo los movimientos del periodo elegido."
              : "Sin fechas: se suma todo el historial."}
          </p>
        </form>

        <TablaResumenProyecto filas={filas} />
      </div>
    </div>
  );
}
