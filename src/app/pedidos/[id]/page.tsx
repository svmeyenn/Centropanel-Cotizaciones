import { monedaDelPais } from "@/lib/formato";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import EditorPedido, {
  type LineaVista,
  type NecesidadVista,
  type SolicitudVista,
} from "@/components/EditorPedido";
import type { FacturaVista } from "@/components/FacturaPedido";
import BarraNavegacion from "@/components/BarraNavegacion";
import type { FichaCliente } from "@/components/VentanaCliente";
import Link from "next/link";
import ProyectoDelPedido from "@/components/ProyectoDelPedido";
import BotonFacturaTransporte from "@/components/BotonFacturaTransporte";
import { cargarMaestros } from "@/lib/finanzas/consultas";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import type { MargenReal } from "@/components/EditorPedido";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/lib/relaciones";

export const dynamic = "force-dynamic";

// Los proyectos de paneles se llaman todos "Paneles": se distinguen por su cliente y por el pedido al que pertenecen.
function rotuloProyecto(x: { nombre: unknown; cliente?: unknown; pedidos?: unknown }): string {
  const peds = (Array.isArray(x.pedidos) ? x.pedidos : x.pedidos ? [x.pedidos] : []).map((p) => (p as { num_pedido: string }).num_pedido).filter(Boolean);
  return [x.nombre as string, x.cliente as string | null, peds.length ? peds.join(", ") : null].filter(Boolean).join(" · ");
}

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
    { data: proyectosAct },
  ] = await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "*, cotizaciones(id, num_cotizacion), clientes:entidades(id:id_entidad, razon_social, rut, contacto, email, telefono, direccion, comuna, ciudad, id_pais), vendedores(nombre), formas_pago(descripcion), medios_pago(nombre), paises(etiqueta_id, codigo, prefijo_telefono)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("pedido_detalle")
        .select("id, sku, descripcion, unidades, valor_unitario, id_producto")
        .eq("id_pedido", id)
        .order("orden"),
      supabase.rpc("necesidades_pedido", { p_pedido: id }),
      supabase
        .from("solicitudes")
        .select("id, num_solicitud, estado, entidades(razon_social)")
        .eq("id_pedido", id)
        .order("id"),
      supabase.from("v_pedido_cuenta").select("*").eq("id", id).single(),
      supabase
        .from("pagos_pedido")
        .select("id, fecha, monto, medio, referencia, gasto_financiero, vendedores(nombre)")
        .eq("id_pedido", id)
        .order("fecha")
        .order("id"),
      // Un pedido lleva varios documentos: el anticipo, el saldo, y a veces
      // una nota de credito. Se listan en el orden en que se emitieron.
      supabase
        .from("facturas")
        .select(
          "id, tipo, numero, fecha, neto, iva, total, archivo, archivo_nombre, vendedores(nombre)"
        )
        .eq("id_pedido", id)
        .order("fecha")
        .order("id"),
      supabase
        .from("proyectos")
        .select("id_proyecto, nombre, cliente, pedidos(num_pedido)")
        .eq("borrado", false)
        .eq("activo", true)
        .eq("tipo", "obra")
        .order("nombre"),
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

  // Costo de cada linea: el pedido no lo guarda, asi que se trae de la
  // cotizacion que lo origino --el costo congelado al vender-- cruzando por
  // producto y, si la linea se escribio a mano, por descripcion.
  const { data: detCot } = ped.id_cotizacion
    ? await supabase
        .from("cotizacion_detalle")
        .select("id_producto, descripcion, costo_unitario")
        .eq("id_cotizacion", ped.id_cotizacion)
    : { data: [] as { id_producto: number | null; descripcion: string; costo_unitario: number }[] };

  const costoPorProducto = new Map<string, number>();
  for (const x of detCot ?? []) {
    const clave = x.id_producto != null ? `p${x.id_producto}` : `d${x.descripcion}`;
    costoPorProducto.set(clave, Number(x.costo_unitario ?? 0));
  }
  // Si la cotizacion se grabo sin costo --se cotizo antes de costear--, vale
  // el costo de hoy del catalogo: es mejor que mostrar margen 100%.
  const idsProducto = [
    ...new Set(
      (lineas ?? [])
        .map((l) => l.id_producto as number | null)
        .filter((x): x is number => x != null)
    ),
  ];
  const { data: prods } = idsProducto.length
    ? await supabase.rpc("costo_productos", { p_ids: idsProducto })
    : { data: [] as { id: number; costo: number }[] };
  const costoCatalogo = new Map(
    ((prods ?? []) as { id: number; costo: number }[]).map((x) => [
      Number(x.id),
      Number(x.costo ?? 0),
    ])
  );

  const costoPorLinea: Record<number, number> = {};
  let sinCosto = 0;
  for (const l of lineas ?? []) {
    const clave =
      l.id_producto != null ? `p${l.id_producto}` : `d${l.descripcion}`;
    const costo =
      costoPorProducto.get(clave) ||
      (l.id_producto != null ? (costoCatalogo.get(Number(l.id_producto)) ?? 0) : 0);
    if (!costo) sinCosto += 1;
    costoPorLinea[Number(l.id)] = costo;
  }

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

  // Si un administrador autorizo generar solicitudes sin el pie completo: quien, cuando y por que.
  let sinPie: { por: string; en: string; motivo: string } | null = null;
  if (ped.sin_pie_autorizado_por != null) {
    const { data: quien } = await supabase
      .from("vendedores")
      .select("nombre")
      .eq("id", ped.sin_pie_autorizado_por)
      .maybeSingle();
    sinPie = {
      por: (quien?.nombre as string | undefined) ?? "un administrador",
      en: (ped.sin_pie_autorizado_en as string) ?? "",
      motivo: (ped.sin_pie_motivo as string | null) ?? "",
    };
  }

  // Las necesidades de material que ya salieron de este pedido.
  const { data: nmsDb } = await supabase.from("necesidades_material").select("id, folio, estado").eq("id_pedido", id).order("id");
  // Medios de pago que llevan gasto financiero para la empresa, y la tasa con que se sugiere.
  const { data: mediosDb } = await supabase.from("medios_pago").select("nombre, con_gasto, costo_pct").eq("id_pais", ped.id_pais);
  const mediosGasto = new Map((mediosDb ?? []).map((m) => [m.nombre as string, { con_gasto: Boolean(m.con_gasto), costo_pct: Number(m.costo_pct ?? 0) }]));
  // El margen real, con los costos que ya se ingresaron: solo para administradores y supervisores.
  const margenReal = tienePerfilAdmin(v) ? ((await supabase.rpc("pedido_margen_real", { p_pedido: id })).data as MargenReal | null) : null;
  // Quien puede cargar egresos carga aqui la factura del transportista; queda pendiente de aprobacion.
  const puedeCargarFlete = tienePerfilAdmin(v) && v.fin_solicitar_gastos && ped.id_proyecto != null;
  const maestrosFlete = puedeCargarFlete ? await cargarMaestros(Number(ped.id_pais)) : null;
  const necesidadesPedido = (nmsDb ?? []).map((n) => ({ id: Number(n.id), folio: n.folio as string, estado: n.estado as string }));

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
      uno<{ razon_social: string }>(s.entidades)?.razon_social ?? "",
    estado: s.estado as string,
    lineas: lineasPorSol.get(Number(s.id)) ?? 0,
  }));

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Detalle del pedido"
        subtitulo="Items, abastecimiento y solicitudes a proveedores"
      />
      <div className="max-w-screen-2xl mx-auto px-6 pt-6">
        <BarraNavegacion volverA="/pedidos">
          <Link
            href="/pedidos"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Todos los pedidos
          </Link>
        </BarraNavegacion>
        <ProyectoDelPedido
          idPedido={id}
          actual={
            (proyectosAct ?? []).find((x) => Number(x.id_proyecto) === Number(ped.id_proyecto))
              ? {
                  id: Number(ped.id_proyecto),
                  nombre: rotuloProyecto((proyectosAct ?? []).find((x) => Number(x.id_proyecto) === Number(ped.id_proyecto))!),
                }
              : null
          }
          proyectos={(proyectosAct ?? []).map((x) => ({ id: Number(x.id_proyecto), nombre: rotuloProyecto(x) }))}
          puedeEditar={tienePerfilAdmin(v)}
        />
      </div>
      <EditorPedido
        id={id}
        moneda={(ped.moneda as string | null) ?? monedaDelPais(Number(ped.id_pais))}
        num={ped.num_pedido as string}
        cotizacion={cot ? { id: cot.id, num: cot.num_cotizacion } : null}
        cliente={cli?.razon_social ?? ""}
        clienteRut={cli?.rut ?? null}
        etiquetaId={uno<{ etiqueta_id: string }>(ped.paises)?.etiqueta_id ?? "RUT"}
        impuesto={uno<{ codigo: string }>(ped.paises)?.codigo === "PE" ? "IGV" : "IVA"}
        clienteContacto={cli?.contacto ?? null}
        clienteTelefono={cli?.telefono ?? null}
        clienteCiudad={cli?.ciudad ?? null}
        vendedor={ven?.nombre ?? ""}
        inicial={{
          fecha: (ped.fecha as string).slice(0, 10),
          estado: ped.estado as string,
          direccion_despacho: (ped.direccion_despacho as string) ?? "",
          tiempo_entrega: (ped.tiempo_entrega as string) ?? "",
          fecha_entrega_esperada:
            ((ped.fecha_entrega_esperada as string) ?? "").slice(0, 10),
          fecha_entrega_efectiva:
            ((ped.fecha_entrega_efectiva as string) ?? "").slice(0, 10),
          notas: (ped.notas as string) ?? "",
        }}
        lineas={filas}
        necesidades={necesidades}
        solicitudes={solicitudes}
        formaPago={fp?.descripcion ?? null}
        medioPago={mp?.nombre ?? null}
        cuenta={{
          subtotal: Number(cta?.subtotal ?? 0),
          descuento_monto: Number(cta?.descuento_monto ?? 0),
          descuento2_monto: Number(cta?.descuento2_monto ?? 0),
          descuento3_monto: Number(cta?.descuento3_monto ?? 0),
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
          facturado: Number(cta?.facturado ?? 0),
          por_facturar: Number(cta?.por_facturar ?? 0),
        }}
        margenReal={margenReal}
        facturaTransporte={
          maestrosFlete ? (
            <BotonFacturaTransporte
              numPedido={ped.num_pedido as string}
              idProyecto={Number(ped.id_proyecto)}
              idCategoria={maestrosFlete.categorias.find((c) => c.nombre === "Transporte y fletes" && c.tipo === "Egreso" && !c.borrado)?.id_categoria ?? null}
              cuentas={maestrosFlete.cuentas}
              proyectos={maestrosFlete.proyectos}
              categorias={maestrosFlete.categorias}
              interlocutores={maestrosFlete.interlocutores}
            />
          ) : null
        }
        pagos={(pagos ?? []).map((g) => ({
          gasto: g.gasto_financiero != null ? Number(g.gasto_financiero) : null,
          requiereGasto: Boolean(mediosGasto.get(g.medio as string)?.con_gasto),
          sugerido: Math.round((Number(g.monto) * Number(mediosGasto.get(g.medio as string)?.costo_pct ?? 0)) / 100),
          id: Number(g.id),
          fecha: g.fecha as string,
          monto: Number(g.monto),
          medio: g.medio as string | null,
          referencia: g.referencia as string | null,
          quien: uno<{ nombre: string }>(g.vendedores)?.nombre ?? null,
        }))}
        facturas={(fact ?? []).map(
          (f) =>
            ({
              id: Number(f.id),
              tipo: (f.tipo as string) ?? "Factura",
              numero: f.numero as string,
              fecha: f.fecha as string,
              neto: Number(f.neto),
              iva: Number(f.iva),
              total: Number(f.total),
              quien: uno<{ nombre: string }>(f.vendedores)?.nombre ?? null,
              archivo: (f.archivo as string | null) ?? null,
              archivo_nombre: (f.archivo_nombre as string | null) ?? null,
            }) satisfies FacturaVista
        )}
        puedeEditar={v.puede_editar || tienePerfilAdmin(v)}
        puedeCrear={v.puede_crear || tienePerfilAdmin(v)}
        esAdmin={tienePerfilAdmin(v)}
        autorizacionSinPie={sinPie}
        necesidadesPedido={necesidadesPedido}
        costoPorLinea={costoPorLinea}
        fichaCliente={cli ? (cli as unknown as FichaCliente) : null}
        prefijoTelefono={uno<{ prefijo_telefono: string }>(ped.paises)?.prefijo_telefono ?? "+56"}
        verMargen
        lineasSinCosto={sinCosto}
      />
    </div>
  );
}
