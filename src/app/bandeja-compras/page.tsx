import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { dinero, fecha, monedaDelPais } from "@/lib/formato";
import { COLOR_ESTADO, COLOR_NM } from "@/lib/compras";
import { uno } from "@/lib/relaciones";

export const metadata = { title: "Bandeja de compras" };
export const dynamic = "force-dynamic";

// Una sola lista para todo lo que espera un paso en compras: la necesidad que falta cotizar o adjudicar y la
// orden que falta aprobar, recibir o pagar. Cada fila dice cual es el siguiente paso y lleva directo a el.
type Etapa = "cotizar" | "adjudicar" | "aprobar" | "recibir" | "pagar";
type Fila = {
  clave: string;
  etapa: Etapa;
  tipo: "Necesidad" | "Orden";
  documento: string;
  href: string;
  cliente: string | null;
  proyecto: string | null;
  contraparte: string;
  estado: string;
  colorEstado: string;
  monto: string | null;
  desde: string | null;
  paso: string;
};

const ETAPAS: { clave: Etapa; titulo: string; ayuda: string }[] = [
  { clave: "cotizar", titulo: "Por cotizar", ayuda: "Necesidades que aun no tienen cotizacion de ningun proveedor" },
  { clave: "adjudicar", titulo: "Por adjudicar", ayuda: "Ya hay cotizaciones: comparar y elegir proveedor por producto" },
  { clave: "aprobar", titulo: "Por aprobar", ayuda: "Ordenes de compra en borrador o esperando aprobacion" },
  { clave: "recibir", titulo: "Por recibir", ayuda: "Ordenes aprobadas o enviadas que aun no llegan completas" },
  { clave: "pagar", titulo: "Por pagar", ayuda: "Ordenes recibidas o facturadas que aun no se pagan" },
];

const ETAPA_OC: Record<string, Etapa> = {
  Borrador: "aprobar",
  "Pendiente aprobacion": "aprobar",
  Aprobada: "recibir",
  Enviada: "recibir",
  "Recibida parcial": "recibir",
  Recibida: "pagar",
  Facturada: "pagar",
};
const PASO_OC: Record<string, string> = {
  Borrador: "Completar y enviar a aprobacion",
  "Pendiente aprobacion": "Aprobar",
  Aprobada: "Enviar al proveedor",
  Enviada: "Registrar recepcion",
  "Recibida parcial": "Registrar recepcion",
  Recibida: "Registrar factura y pago",
  Facturada: "Pagar",
};

type NmFila = {
  id: number;
  folio: string;
  estado: string;
  proyecto: string | null;
  num_pedido: string | null;
  creado: string;
  n_items: number;
  cliente: string | null;
};

export default async function Pagina({ searchParams }: { searchParams: Promise<{ etapa?: string; q?: string }> }) {
  const v = await requerirVendedor();
  const { etapa: etapaSel, q } = await searchParams;
  const supabase = await createClient();
  const { idPaisActivo } = await contextoMercado(v);

  const [{ data: nmDb }, { data: ocDb }] = await Promise.all([
    supabase.rpc("nm_listado", { p_estado: null, p_buscar: null, p_limite: 200, p_desde: 0 }),
    conPais(
      supabase
        .from("ordenes_compra")
        .select("id, num_oc, id_pais, estado, fecha, total, id_proyecto, proyectos(nombre), entidades!ordenes_compra_id_proveedor_fkey(razon_social)")
        .in("estado", Object.keys(ETAPA_OC)),
      idPaisActivo
    ).order("id", { ascending: false }),
  ]);

  const nms = ((nmDb ?? []) as NmFila[]).filter((n) => n.estado === "Borrador" || n.estado === "En cotizacion" || n.estado === "Adjudicada parcial");
  const ocs = ocDb ?? [];

  // Necesidades que ya recibieron al menos una cotizacion.
  const { data: respondieron } = nms.length
    ? await supabase.from("nm_proveedores").select("id_necesidad").eq("estado", "Respondio").in("id_necesidad", nms.map((n) => Number(n.id)))
    : { data: [] as { id_necesidad: number }[] };
  const conCotizacion = new Set((respondieron ?? []).map((r) => Number(r.id_necesidad)));

  const { data: clientesDb } = ocs.length ? await supabase.rpc("oc_clientes", { p_ids: ocs.map((o) => Number(o.id)) }) : { data: [] };
  const clienteDe = new Map(((clientesDb ?? []) as { id: number; cliente: string | null }[]).map((c) => [Number(c.id), c.cliente]));

  const filas: Fila[] = [
    ...nms.map((n): Fila => {
      const adjudicar = n.estado === "Adjudicada parcial" || conCotizacion.has(Number(n.id));
      return {
        clave: `nm-${n.id}`,
        etapa: adjudicar ? "adjudicar" : "cotizar",
        tipo: "Necesidad",
        documento: n.folio,
        href: `/necesidades/${n.id}`,
        cliente: n.cliente,
        proyecto: n.proyecto,
        contraparte: `${Number(n.n_items)} producto${Number(n.n_items) === 1 ? "" : "s"}`,
        estado: n.estado,
        colorEstado: COLOR_NM[n.estado] ?? "",
        monto: null,
        desde: n.creado?.slice(0, 10) ?? null,
        paso: adjudicar ? "Comparar y adjudicar" : n.estado === "Borrador" ? "Invitar proveedores y pedir cotizacion" : "Registrar cotizaciones",
      };
    }),
    ...ocs.map((o): Fila => ({
      clave: `oc-${o.id}`,
      etapa: ETAPA_OC[o.estado as string],
      tipo: "Orden",
      documento: o.num_oc as string,
      href: `/compras/${o.id}`,
      cliente: clienteDe.get(Number(o.id)) ?? null,
      proyecto: uno<{ nombre: string }>(o.proyectos)?.nombre ?? null,
      contraparte: uno<{ razon_social: string }>(o.entidades)?.razon_social ?? "",
      estado: o.estado as string,
      colorEstado: COLOR_ESTADO[o.estado as string] ?? "",
      monto: dinero(Number(o.total), monedaDelPais(Number(o.id_pais))),
      desde: (o.fecha as string | null) ?? null,
      paso: PASO_OC[o.estado as string] ?? "Abrir",
    })),
  ];

  const buscar = (q ?? "").trim().toLowerCase();
  const visibles = filas
    .filter((f) => !etapaSel || f.etapa === etapaSel)
    .filter((f) => !buscar || [f.documento, f.cliente, f.proyecto, f.contraparte].some((t) => (t ?? "").toLowerCase().includes(buscar)))
    // Lo que lleva mas tiempo esperando, primero.
    .sort((a, b) => (a.desde ?? "").localeCompare(b.desde ?? ""));

  const cuenta = (e: Etapa) => filas.filter((f) => f.etapa === e).length;
  const href = (e?: string) => {
    const s = new URLSearchParams();
    if (e) s.set("etapa", e);
    if (q) s.set("q", q);
    const t = s.toString();
    return `/bandeja-compras${t ? `?${t}` : ""}`;
  };
  const hoy = Date.now();
  const dias = (d: string | null) => (d ? Math.max(0, Math.floor((hoy - new Date(`${d}T00:00:00`).getTime()) / 86400000)) : null);

  return (
    <div className="min-h-screen">
      <Cabecera proceso={{ tipo: "compras", etapa: "necesidad" }} titulo="Bandeja de compras" subtitulo="Todo lo que espera un paso, del requerimiento al pago" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Etapas de compra" className="flex flex-wrap gap-2 text-xs">
            <Link href={href()} className={`px-2 py-1 rounded ${!etapaSel ? "bg-verde text-white" : "bg-gray-100"}`}>
              Todo pendiente <span className="tabular-nums">({filas.length})</span>
            </Link>
            {ETAPAS.map((e) => (
              <Link key={e.clave} href={href(e.clave)} title={e.ayuda} className={`px-2 py-1 rounded ${etapaSel === e.clave ? "bg-verde text-white" : "bg-gray-100"}`}>
                {e.titulo} <span className="tabular-nums">({cuenta(e.clave)})</span>
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/bandeja-compras" className="flex gap-1">
              {etapaSel && <input type="hidden" name="etapa" value={etapaSel} />}
              <input id="q" name="q" defaultValue={q ?? ""} placeholder="Folio, cliente, obra o proveedor" aria-label="Buscar" className="border border-gray-300 rounded px-2 py-1 text-xs w-56" />
              <button className="bg-gray-100 text-xs px-2 rounded">Buscar</button>
            </form>
            <Link href="/necesidades/nueva" className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
              Nueva necesidad
            </Link>
          </div>
        </div>
        {etapaSel && <p className="text-xs text-gray-600">{ETAPAS.find((e) => e.clave === etapaSel)?.ayuda}.</p>}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Documento</th>
                  <th className="text-left px-3 py-2">Proyecto</th>
                  <th className="text-left px-3 py-2">Proveedor / productos</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Espera</th>
                  <th className="text-left px-3 py-2">Siguiente paso</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const d = dias(f.desde);
                  return (
                    <tr key={f.clave} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{f.cliente ?? <span className="text-gray-500">—</span>}</td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">
                        <Link href={f.href} className="text-verde hover:underline">{f.documento}</Link>{" "}
                        <span className="text-[11px] font-normal text-gray-500">{f.tipo}</span>
                      </td>
                      <td className="px-3 py-2">{f.proyecto ?? <span className="text-gray-500">—</span>}</td>
                      <td className="px-3 py-2">{f.contraparte}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${f.colorEstado}`}>{f.estado}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.monto ?? <span className="text-gray-500">—</span>}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${d != null && d >= 7 ? "text-amber-800 font-semibold" : ""}`} title={f.desde ? `Desde el ${fecha(f.desde)}` : undefined}>
                        {d == null ? "—" : `${d} d`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={f.href} className="text-verde font-semibold underline">{f.paso}</Link>
                      </td>
                    </tr>
                  );
                })}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                      {etapaSel || buscar ? "Nada en esta etapa." : "No hay compras esperando un paso."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          Las listas completas siguen en{" "}
          <Link href="/necesidades" className="underline">Necesidades de material</Link> y{" "}
          <Link href="/compras" className="underline">Ordenes de compra</Link>.
        </p>
      </div>
    </div>
  );
}
