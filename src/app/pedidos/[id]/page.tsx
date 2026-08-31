import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import EditorPedido, {
  type LineaVista,
  type NecesidadVista,
  type SolicitudVista,
} from "@/components/EditorPedido";
import BarraNavegacion from "@/components/BarraNavegacion";
import Link from "next/link";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const v = await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [{ data: ped }, { data: lineas }, { data: nec }, { data: sols }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "*, cotizaciones(id, num_cotizacion), clientes(razon_social), vendedores(nombre)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("pedido_detalle")
        .select("id, descripcion, unidades, valor_unitario")
        .eq("id_pedido", id)
        .order("orden"),
      supabase.rpc("necesidades_pedido", { p_pedido: id }),
      supabase
        .from("solicitudes")
        .select("id, num_solicitud, estado, proveedores(razon_social)")
        .eq("id_pedido", id)
        .order("id"),
    ]);

  if (!ped) notFound();

  const idsSol = (sols ?? []).map((s) => Number(s.id));
  const { data: detSol } = idsSol.length
    ? await supabase
        .from("solicitud_detalle")
        .select("id_solicitud")
        .in("id_solicitud", idsSol)
    : { data: [] as { id_solicitud: number }[] };

  const lineasPorSol = new Map<number, number>();
  for (const x of detSol ?? []) {
    const k = Number(x.id_solicitud);
    lineasPorSol.set(k, (lineasPorSol.get(k) ?? 0) + 1);
  }

  const uno = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);

  const cot = uno<{ id: number; num_cotizacion: string }>(ped.cotizaciones);
  const cli = uno<{ razon_social: string }>(ped.clientes);
  const ven = uno<{ nombre: string }>(ped.vendedores);

  const filas: LineaVista[] = (lineas ?? []).map((l) => ({
    id: Number(l.id),
    descripcion: l.descripcion as string,
    unidades: Number(l.unidades),
    valor_unitario: Number(l.valor_unitario),
  }));

  const necesidades: NecesidadVista[] = (
    (nec ?? []) as { descripcion: string; unidades: number }[]
  ).map((n) => ({
    descripcion: n.descripcion,
    unidades: Number(n.unidades),
  }));

  const solicitudes: SolicitudVista[] = (sols ?? []).map((s) => ({
    id: Number(s.id),
    num: s.num_solicitud as string,
    proveedor:
      uno<{ razon_social: string }>(s.proveedores)?.razon_social ?? "",
    estado: s.estado as string,
    lineas: lineasPorSol.get(Number(s.id)) ?? 0,
  }));

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Detalle del pedido"
        subtitulo="Items, abastecimiento y solicitudes a proveedores"
      />
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <BarraNavegacion volverA="/pedidos">
          <Link
            href="/pedidos"
            className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded hover:bg-white"
          >
            Todos los pedidos
          </Link>
        </BarraNavegacion>
      </div>
      <EditorPedido
        id={id}
        num={ped.num_pedido as string}
        cotizacion={cot ? { id: cot.id, num: cot.num_cotizacion } : null}
        cliente={cli?.razon_social ?? ""}
        vendedor={ven?.nombre ?? ""}
        inicial={{
          fecha: (ped.fecha as string).slice(0, 10),
          estado: ped.estado as string,
          direccion_despacho: (ped.direccion_despacho as string) ?? "",
          tiempo_entrega: (ped.tiempo_entrega as string) ?? "",
          notas: (ped.notas as string) ?? "",
        }}
        lineas={filas}
        necesidades={necesidades}
        solicitudes={solicitudes}
        puedeEditar={v.puede_editar || v.rol === "Administrador"}
        puedeCrear={v.puede_crear || v.rol === "Administrador"}
      />
    </div>
  );
}
