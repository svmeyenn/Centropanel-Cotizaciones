import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelConciliacion from "@/components/finanzas/PanelConciliacion";
import {
  cargarConciliacion,
  cargarFormatoCartola,
  cargarMaestros,
} from "@/lib/finanzas/consultas";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { hoyISO } from "@/lib/formato";

export const dynamic = "force-dynamic";

// Mes corrido por defecto: es el recorte con el que llega la cartola.
function mesActual() {
  // El mes de Chile: el servidor corre en UTC y a fin de mes, de noche, ya
  // estaria en el siguiente.
  const [anio, mes] = hoyISO().split("-").map(Number);
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const ultimo = new Date(Date.UTC(anio, mes, 0));
  return {
    desde: primero.toISOString().slice(0, 10),
    hasta: ultimo.toISOString().slice(0, 10),
  };
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string; desde?: string; hasta?: string }>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/conciliacion")) redirect("/");

  const filtro = await searchParams;
  const { idPaisActivo } = await contextoMercado(v);
  const { cuentas, categorias, proyectos, interlocutores } =
    await cargarMaestros(idPaisActivo);
  const elegibles = cuentas.filter((c) => c.activa);

  const idCuenta =
    Number(filtro.cuenta) || elegibles[0]?.id_cuenta || cuentas[0]?.id_cuenta || 0;

  const mes = mesActual();
  const desde = filtro.desde || mes.desde;
  const hasta = filtro.hasta || mes.hasta;

  const datos = idCuenta
    ? await cargarConciliacion(idCuenta, desde, hasta)
    : {
        lineas: [],
        movimientos: [],
        sinLinea: [],
        sinBanco: [],
        saldoSistema: 0,
      };

  const formato = idCuenta ? await cargarFormatoCartola(idCuenta) : null;

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Conciliacion bancaria"
        subtitulo="Que lo del banco y lo del sistema digan lo mismo"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />

        <PanelConciliacion
          cuentas={cuentas}
          idCuenta={idCuenta}
          desde={desde}
          hasta={hasta}
          lineas={datos.lineas}
          movimientos={datos.movimientos}
          sinLinea={datos.sinLinea}
          sinBanco={datos.sinBanco}
          saldoSistema={datos.saldoSistema}
          categorias={categorias}
          proyectos={proyectos}
          interlocutores={interlocutores}
          puedeConciliar={v.fin_pagar_gastos}
          formato={formato}
        />
      </div>
    </div>
  );
}
