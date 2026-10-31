import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasTransportes from "@/components/transportes/PestanasTransportes";
import { dinero, monedaDelPais } from "@/lib/formato";
import { puedeVerRuta } from "@/lib/menu";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reporte de fletes" };
export const dynamic = "force-dynamic";

// Categoria "Transporte y fletes" de egresos: 25 Chile, 26 Peru.
const CATEGORIAS_FLETE = [25, 26];

interface Mov {
  id_mov: number;
  id_pais: number;
  fecha: string;
  monto: number;
  aprobacion: string | null;
  estado_pago: string | null;
  id_interlocutor: number | null;
  id_proyecto: number | null;
  documento: string | null;
}

function Cuadro({ t, v, nota }: { t: string; v: string; nota?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded px-4 py-3">
      <div className="text-xs text-dorado-osc font-semibold">{t}</div>
      <div className="text-lg font-semibold text-gray-900 tabular-nums">{v}</div>
      {nota && <div className="text-[11px] text-gray-600">{nota}</div>}
    </div>
  );
}

export default async function Pagina({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/transportistas")) redirect("/");
  const anio = Number((await searchParams).anio) || new Date().getFullYear();

  const supabase = await createClient();
  const { idPaisActivo } = await contextoMercado(v);
  const moneda = monedaDelPais(idPaisActivo ?? 1);

  const [{ data: movs }, { data: costos }, { data: pedidos }] = await Promise.all([
    conPais(
      supabase
        .from("movimientos")
        .select("id_mov, id_pais, fecha, monto, aprobacion, estado_pago, id_interlocutor, id_proyecto, documento")
        .eq("tipo", "Egreso")
        .in("id_categoria", CATEGORIAS_FLETE)
        .gte("fecha", `${anio}-01-01`)
        .lte("fecha", `${anio}-12-31`),
      idPaisActivo
    ).limit(5000),
    supabase.from("pedido_transporte").select("id, id_pedido, monto, id_mov, pedidos(num_pedido, id_pais, id_proyecto)").limit(5000),
    conPais(
      supabase
        .from("pedidos")
        .select("id, num_pedido, id_pais, id_proyecto, flete_estimado, id_transportista, modalidad_entrega")
        .or("flete_estimado.not.is.null,id_transportista.not.is.null"),
      idPaisActivo
    ).limit(5000),
  ]);

  const filas = ((movs ?? []) as unknown as Mov[]).filter((m) => m.aprobacion !== "Rechazado");
  const ids = [...new Set(filas.map((m) => m.id_interlocutor).filter((x): x is number => x != null))];
  const idsProy = [...new Set(filas.map((m) => m.id_proyecto).filter((x): x is number => x != null))];
  const [{ data: ents }, { data: proys }] = await Promise.all([
    ids.length ? supabase.from("entidades").select("id_entidad, razon_social").in("id_entidad", ids) : Promise.resolve({ data: [] }),
    idsProy.length ? supabase.from("proyectos").select("id_proyecto, nombre").in("id_proyecto", idsProy) : Promise.resolve({ data: [] }),
  ]);
  const nombreEnt = new Map((ents ?? []).map((e) => [Number(e.id_entidad), e.razon_social as string]));
  const nombreProy = new Map((proys ?? []).map((p) => [Number(p.id_proyecto), p.nombre as string]));

  const pagado = (m: Mov) => m.estado_pago === "Pagado";
  const total = filas.reduce((s, m) => s + Number(m.monto), 0);
  const pagadoTotal = filas.filter(pagado).reduce((s, m) => s + Number(m.monto), 0);
  const porPagar = total - pagadoTotal;

  // Costo cargado al pedido que todavia no tiene factura/egreso asociado.
  const sinEgreso = (costos ?? []).filter((c) => c.id_mov == null);
  const estimadoSinFactura = sinEgreso.reduce((s, c) => s + Number(c.monto), 0);
  const fleteEstimadoPedidos = (pedidos ?? []).reduce((s, p) => s + Number(p.flete_estimado ?? 0), 0);

  function agrupar(clave: (m: Mov) => string) {
    const g = new Map<string, { n: number; total: number; pagado: number }>();
    for (const m of filas) {
      const k = clave(m);
      const a = g.get(k) ?? { n: 0, total: 0, pagado: 0 };
      a.n += 1;
      a.total += Number(m.monto);
      if (pagado(m)) a.pagado += Number(m.monto);
      g.set(k, a);
    }
    return [...g.entries()].sort((a, b) => b[1].total - a[1].total);
  }
  const porTransportista = agrupar((m) => (m.id_interlocutor != null ? (nombreEnt.get(m.id_interlocutor) ?? `Entidad ${m.id_interlocutor}`) : "Sin transportista"));
  const porProyecto = agrupar((m) => (m.id_proyecto != null ? (nombreProy.get(m.id_proyecto) ?? `Proyecto ${m.id_proyecto}`) : "Sin proyecto"));
  const porMes = agrupar((m) => m.fecha.slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0]));

  const Tabla = ({ titulo, datos, etiqueta }: { titulo: string; datos: [string, { n: number; total: number; pagado: number }][]; etiqueta: string }) => (
    <section className="space-y-1" aria-label={titulo}>
      <h2 className="text-sm font-semibold text-verde">{titulo}</h2>
      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th scope="col" className="text-left px-3 py-2">{etiqueta}</th>
              <th scope="col" className="text-right px-3 py-2">Egresos</th>
              <th scope="col" className="text-right px-3 py-2">Total</th>
              <th scope="col" className="text-right px-3 py-2">Pagado</th>
              <th scope="col" className="text-right px-3 py-2">Por pagar</th>
            </tr>
          </thead>
          <tbody>
            {datos.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Sin fletes registrados en {anio}.</td></tr>}
            {datos.map(([k, a]) => (
              <tr key={k} className="border-t border-gray-100 hover:bg-crema">
                <th scope="row" className="text-left px-3 py-2 font-normal">{k}</th>
                <td className="px-3 py-2 text-right tabular-nums">{a.n}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dinero(a.total, moneda)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dinero(a.pagado, moneda)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dinero(a.total - a.pagado, moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const anios = [anio - 1, anio, anio + 1];

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Reporte de fletes" subtitulo="Lo gastado en transporte, por transportista, proyecto y mes" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasTransportes activa="/transportistas/reporte" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-600">Año</span>
          {anios.map((a) => (
            <Link key={a} href={`/transportistas/reporte?anio=${a}`} aria-current={a === anio ? "page" : undefined} className={`px-2.5 py-1 rounded border ${a === anio ? "bg-verde text-white border-verde" : "bg-white border-gray-300 text-gray-800"}`}>
              {a}
            </Link>
          ))}
        </div>
        <p className="text-xs text-gray-600 max-w-3xl">
          Sale de los egresos de la categoria <strong>Transporte y fletes</strong> (sin los rechazados), del costo cargado a cada pedido y del flete estimado de los pedidos. Lo que se
          registra en Egresos o en el despacho del pedido aparece aqui solo.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Cuadro t="Gastado en fletes" v={dinero(total, moneda)} nota={`${filas.length} egresos`} />
          <Cuadro t="Pagado" v={dinero(pagadoTotal, moneda)} />
          <Cuadro t="Por pagar" v={dinero(porPagar, moneda)} />
          <Cuadro t="Costo de pedidos sin egreso" v={dinero(estimadoSinFactura, moneda)} nota={`Flete estimado en pedidos: ${dinero(fleteEstimadoPedidos, moneda)}`} />
        </div>
        <Tabla titulo="Por transportista" datos={porTransportista} etiqueta="Transportista" />
        <Tabla titulo="Por proyecto" datos={porProyecto} etiqueta="Proyecto" />
        <Tabla titulo="Por mes" datos={porMes} etiqueta="Mes" />
      </div>
    </div>
  );
}
