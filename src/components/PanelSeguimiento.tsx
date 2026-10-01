import Link from "next/link";
import { pesos } from "@/lib/formato";

// Si el seguimiento se esta haciendo. Es otra pregunta que la del tablero de
// ventas, que mide cuanto se vendio: aqui se mira si lo que se promete se
// cumple, y que cotizaciones estan vivas sin que nadie quede a cargo de nada.

export type Seguimiento = {
  mes: string;
  embudo: {
    estado: string;
    n: number;
    monto: number;
    dias_promedio: number;
    dias_maximo: number;
  }[];
  cumplimiento: {
    id_vendedor: number;
    vendedor: string;
    comprometidas: number;
    a_tiempo: number;
    tarde: number;
    caducadas: number;
    pendientes: number;
  }[];
  sin_proxima: {
    id: number;
    num_cotizacion: string | null;
    estado: string;
    fecha: string;
    total: number;
    dias: number;
    cliente: string | null;
    vendedor: string | null;
  }[];
  sin_proxima_n: number;
  sin_proxima_monto: number;
};

const dia = (f: string) => f.slice(0, 10).split("-").reverse().join("-");

// Un numero de dias suelto obliga a hacer la cuenta. Dicho en semanas o meses
// se entiende de una mirada cuando ya es mucho.
function antiguedad(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "1 dia";
  if (dias < 14) return `${dias} dias`;
  if (dias < 60) return `${Math.round(dias / 7)} semanas`;
  return `${Math.round(dias / 30)} meses`;
}

export default function PanelSeguimiento({ s }: { s: Seguimiento }) {
  const totalComprometidas = s.cumplimiento.reduce((a, x) => a + x.comprometidas, 0);
  const totalATiempo = s.cumplimiento.reduce((a, x) => a + x.a_tiempo, 0);
  const cumple = totalComprometidas > 0
    ? Math.round((totalATiempo / totalComprometidas) * 100)
    : null;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* El embudo, pero con cuanto lleva esperando cada cotizacion. Un
          "enviada" de dos meses y uno de dos dias no son lo mismo, y contados
          juntos dan la misma cifra. */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white text-[11px] font-semibold px-3 py-1">
          COTIZACIONES EN JUEGO, Y CUANTO LLEVAN ESPERANDO
        </div>
        {s.embudo.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-400">
            No hay cotizaciones abiertas.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-crema text-dorado-osc">
              <tr>
                <th className="text-left px-3 py-1">Estado</th>
                <th className="text-right px-3 py-1 w-16">Cuantas</th>
                <th className="text-right px-3 py-1">Monto</th>
                <th className="text-right px-3 py-1 w-24">Espera media</th>
                <th className="text-right px-3 py-1 w-24">La mas vieja</th>
              </tr>
            </thead>
            <tbody>
              {s.embudo.map((e) => (
                <tr key={e.estado} className="border-t border-gray-100">
                  <td className="px-3 py-1 font-semibold">
                    <Link
                      href={`/cotizaciones?estado=${e.estado}`}
                      className="text-verde underline"
                    >
                      {e.estado}
                    </Link>
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{e.n}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{pesos(e.monto)}</td>
                  <td className="px-3 py-1 text-right">{antiguedad(e.dias_promedio)}</td>
                  <td
                    className={`px-3 py-1 text-right ${
                      e.dias_maximo >= 30 ? "text-red-700 font-semibold" : ""
                    }`}
                  >
                    {antiguedad(e.dias_maximo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Lo que se promete y lo que se cumple. Una accion caduca no es un
          fracaso en si misma --hay clientes que compran en otro lado-- pero
          muchas seguidas si dicen algo. */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex justify-between">
          <span>CUMPLIMIENTO DEL SEGUIMIENTO, ESTE MES</span>
          {cumple !== null && (
            <span className="font-normal">{cumple} % a tiempo</span>
          )}
        </div>
        {s.cumplimiento.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-400">
            Nadie comprometio acciones para este mes.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-crema text-dorado-osc">
              <tr>
                <th className="text-left px-3 py-1">Quien</th>
                <th className="text-right px-3 py-1 w-20">Prometio</th>
                <th className="text-right px-3 py-1 w-20">A tiempo</th>
                <th className="text-right px-3 py-1 w-16">Tarde</th>
                <th className="text-right px-3 py-1 w-20">Caducas</th>
                <th className="text-right px-3 py-1 w-20">Sin hacer</th>
              </tr>
            </thead>
            <tbody>
              {s.cumplimiento.map((c) => (
                <tr key={c.id_vendedor} className="border-t border-gray-100">
                  <td className="px-3 py-1 font-semibold">{c.vendedor}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{c.comprometidas}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-green-700">
                    {c.a_tiempo}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{c.tarde}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-gray-500">
                    {c.caducadas}
                  </td>
                  <td
                    className={`px-3 py-1 text-right tabular-nums ${
                      c.pendientes > 0 ? "text-red-700 font-semibold" : ""
                    }`}
                  >
                    {c.pendientes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Las que se caen solas: estan vivas y nadie quedo de hacer nada. */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden lg:col-span-2">
        <div className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex justify-between">
          <span>COTIZACIONES VIVAS SIN NINGUNA ACCION PENDIENTE</span>
          <span className="font-normal">
            {s.sin_proxima_n} por {pesos(s.sin_proxima_monto)}
          </span>
        </div>
        {s.sin_proxima.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-400">
            Todas las cotizaciones abiertas tienen a alguien a cargo de algo.
          </p>
        ) : (
          <div className="overflow-y-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-crema text-dorado-osc sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1 w-24">Folio</th>
                  <th className="text-left px-3 py-1">Cliente</th>
                  <th className="text-left px-3 py-1 w-24">Estado</th>
                  <th className="text-left px-3 py-1">Ejecutivo</th>
                  <th className="text-left px-3 py-1 w-24">Emitida</th>
                  <th className="text-right px-3 py-1 w-24">Sin tocar</th>
                  <th className="text-right px-3 py-1 w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {s.sin_proxima.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-1 font-semibold">
                      <Link href={`/cotizaciones/${c.id}`} className="text-verde underline">
                        {c.num_cotizacion ?? c.id}
                      </Link>
                    </td>
                    <td className="px-3 py-1">{c.cliente}</td>
                    <td className="px-3 py-1">{c.estado}</td>
                    <td className="px-3 py-1">{c.vendedor}</td>
                    <td className="px-3 py-1">{dia(c.fecha)}</td>
                    <td
                      className={`px-3 py-1 text-right ${
                        c.dias >= 30 ? "text-red-700 font-semibold" : ""
                      }`}
                    >
                      {antiguedad(c.dias)}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">{pesos(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
