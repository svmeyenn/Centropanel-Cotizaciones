import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { COLOR_NM, ESTADOS_NM } from "@/lib/compras";
import { fecha } from "@/lib/formato";

export const metadata = { title: "Necesidades de material" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

type Fila = {
  id: number;
  folio: string;
  estado: string;
  id_proyecto: number | null;
  proyecto: string | null;
  id_pedido: number | null;
  num_pedido: string | null;
  fecha_requerida: string | null;
  solicitante: string | null;
  n_items: number;
  n_sc: number;
  n_oc: number;
  creado: string;
  total: number;
};

// El paso previo a la orden de compra: lo que una obra o un pedido necesita, cotizado a varios proveedores y
// adjudicado por solicitud. La lista viene paginada desde la base.
export default async function Pagina({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string; pagina?: string }> }) {
  const v = await requerirVendedor();
  const { estado, q, pagina } = await searchParams;
  const pag = Math.max(1, Number(pagina) || 1);
  const supabase = await createClient();
  const { data } = await supabase.rpc("nm_listado", {
    p_estado: estado || null,
    p_buscar: q || null,
    p_limite: POR_PAGINA,
    p_desde: (pag - 1) * POR_PAGINA,
  });
  const filas = ((data ?? []) as Fila[]).map((f) => ({ ...f, n_items: Number(f.n_items), n_sc: Number(f.n_sc), n_oc: Number(f.n_oc), total: Number(f.total) }));
  const total = filas[0]?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const puedeCrear = ["Administrador", "Supervisor", "Comprador"].includes(v.rol) || v.puede_crear;

  const href = (p: { estado?: string; q?: string; pagina?: number }) => {
    const s = new URLSearchParams();
    const e = p.estado ?? estado;
    if (e) s.set("estado", e);
    if (q) s.set("q", q);
    if (p.pagina && p.pagina > 1) s.set("pagina", String(p.pagina));
    const t = s.toString();
    return `/necesidades${t ? `?${t}` : ""}`;
  };

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Necesidades de material" subtitulo="Lo que se necesita comprar, cotizado y adjudicado antes de la orden de compra" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/necesidades" className={`px-2 py-1 rounded ${!estado ? "bg-verde text-white" : "bg-gray-100"}`}>
              Todas
            </Link>
            {ESTADOS_NM.map((e) => (
              <Link key={e} href={href({ estado: e })} className={`px-2 py-1 rounded ${estado === e ? "bg-verde text-white" : "bg-gray-100"}`}>
                {e}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/necesidades" className="flex gap-1">
              {estado && <input type="hidden" name="estado" value={estado} />}
              <input
                name="q"
                defaultValue={q ?? ""}
                aria-label="Buscar necesidad"
                placeholder="Folio, obra o pedido"
                className="border border-gray-300 rounded px-2 py-1 text-xs w-48 bg-white"
              />
              <button className="border border-gray-300 bg-white text-xs font-semibold px-2 py-1 rounded">Buscar</button>
            </form>
            {puedeCrear && (
              <Link href="/necesidades/nueva" className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
                Nueva necesidad
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">Necesidad</th>
                  <th className="text-left px-3 py-2">Para</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Items</th>
                  <th className="text-right px-3 py-2">Solicitudes</th>
                  <th className="text-right px-3 py-2">Ordenes</th>
                  <th className="text-left px-3 py-2">Requerida</th>
                  <th className="text-left px-3 py-2">Pidio</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-500 py-8">
                      {estado || q ? "Ninguna necesidad coincide con el filtro." : "Todavia no hay necesidades de material."}
                    </td>
                  </tr>
                )}
                {filas.map((n) => (
                  <tr key={n.id} className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-2 font-semibold">
                      <Link href={`/necesidades/${n.id}`} className="text-verde hover:underline">
                        {n.folio}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {n.proyecto && <span className="block">{n.proyecto}</span>}
                      {n.num_pedido && <span className="block text-[11px] text-gray-600">Pedido {n.num_pedido}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${COLOR_NM[n.estado] ?? ""}`}>{n.estado}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{n.n_items}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n.n_sc}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n.n_oc}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{n.fecha_requerida ? fecha(n.fecha_requerida) : <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">{n.solicitante}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {paginas > 1 && (
          <nav aria-label="Paginas" className="flex items-center justify-between text-xs text-gray-600">
            <span>
              {total.toLocaleString("es-CL")} necesidades · pagina {pag} de {paginas}
            </span>
            <span className="flex gap-2">
              {pag > 1 && (
                <Link href={href({ pagina: pag - 1 })} className="border border-gray-300 bg-white rounded px-2 py-1 font-semibold">
                  Anterior
                </Link>
              )}
              {pag < paginas && (
                <Link href={href({ pagina: pag + 1 })} className="border border-gray-300 bg-white rounded px-2 py-1 font-semibold">
                  Siguiente
                </Link>
              )}
            </span>
          </nav>
        )}
      </div>
    </div>
  );
}
