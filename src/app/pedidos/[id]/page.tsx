import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import EditorPedido, {
  type LineaVista,
  type NecesidadVista,
  type SolicitudVista,
} from "@/components/EditorPedido";
import type { FacturaVista } from "@/components/FacturaPedido";
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
  const [
    { data: ped },
    { data: lineas },
    { data: nec },
    { data: sols },
    { data: cta },
    { data: pagos },
    { data: fact },
  ] = await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "*, cotizaciones(id, num_cotizacion), clientes(razon_social, rut, contacto, telefono, ciudad), vendedores(nombre), formas_pago(descripcion), medios_pago(nombre)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("pedido_detalle")
        .select("id, sku, descripcion, unidades, valor_unitario")
        .eq("id_pedido", id)
        .order("orden"),
      supabase.rpc("necesidades_pedido", { p_pedido: id }),
      supabase
        .from("solicitudes")
        .select("id, num_solicitud, estado, proveedores(razon_social)")
        .eq("id_pedido", id)
        .order("id"),
      supabase.from("v_pedido_cuenta").select("*").eq("id", id).single(),
      supabase
        .from("pagos_pedido")
        .select("id, fecha, monto, medio, referencia, vendedores(nombre)")
        .eq("id_pedido", id)
        .order("fecha")
        .order("id"),
      supabase
        .from("facturas")
        .select(
          "id, numero, fecha, neto, iva, total, archivo, archivo_nombre, vendedores(nombre)"
        )
        .eq("id_pedido", id)
        .maybeSingle(),
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
  const fp = uno<{ descripcion: string }>(ped.formas_pago);
  const mp = uno<{ nombre: string }>(ped.medios_pago);
  const cli = uno<{
    razon_social: string;
    rut: string | null;
    contacto: string | null;
    telefono: string | null;
    ciudad: string | null;
  }>(ped.clientes);
  const ven = uno<{ nombre: string }>(ped.vendedores);

  const filas: LineaVista[] = (lineas ?? []).map((l) => ({
    id: Number(l.id),
    sku: (l.sku as string | null) ?? null,
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
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
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
        clienteRut={cli?.rut ?? null}
        clienteContacto={cli?.contacto ?? null}
        clienteTelefono={cli?.telefono ?? null}
        clienteCiudad={cli?.ciudad ?? null}
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
        formaPago={fp?.descripcion ?? null}
        medioPago={mp?.nombre ?? null}
        cuenta={{
          total_neto: Number(cta?.total_neto ?? 0),
          iva: Number(cta?.iva ?? 0),
          total_sin_comision: Number(cta?.total_sin_comision ?? 0),
          comision_pct: Number(cta?.comision_pct ?? 0),
          comision_monto: Number(cta?.comision_monto ?? 0),
          total: Number(cta?.total ?? 0),
          pie_pct: Number(cta?.pie_pct ?? 0),
          pie_monto: Number(cta?.pie_monto ?? 0),
          abonado: Number(cta?.abonado ?? 0),
          saldo: Number(cta?.saldo ?? 0),
          pie_cubierto: Boolean(cta?.pie_cubierto),
        }}
        pagos={(pagos ?? []).map((g) => ({
          id: Number(g.id),
          fecha: g.fecha as string,
          monto: Number(g.monto),
          medio: g.medio as string | null,
          referencia: g.referencia as string | null,
          quien: uno<{ nombre: string }>(g.vendedores)?.nombre ?? null,
        }))}
        factura={
          fact
            ? ({
                id: Number(fact.id),
                numero: fact.numero as string,
                fecha: fact.fecha as string,
                neto: Number(fact.neto),
                iva: Number(fact.iva),
                total: Number(fact.total),
                quien: uno<{ nombre: string }>(fact.vendedores)?.nombre ?? null,
                archivo: (fact.archivo as string | null) ?? null,
                archivo_nombre: (fact.archivo_nombre as string | null) ?? null,
              } satisfies FacturaVista)
            : null
        }
        puedeEditar={v.puede_editar || v.rol === "Administrador"}
        puedeCrear={v.puede_crear || v.rol === "Administrador"}
        esAdmin={v.rol === "Administrador"}
      />
    </div>
  );
}
