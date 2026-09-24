import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import EditorCotizacion from "@/components/EditorCotizacion";
import { contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerIvaPorPais, leerParametros, pTxt } from "@/lib/parametros";
import EnvioCotizacion from "@/components/EnvioCotizacion";
import BotonGenerarPedido from "@/components/BotonGenerarPedido";
import { sumarDias } from "@/lib/formato";

// Ver / modificar una cotizacion existente. Abre en solo lectura (equivalente
// al modo Visualizar de Access) y recien al pulsar Modificar se habilita.
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
    { data: cot },
    { data: items },
    { data: clientes },
    { data: formasPago },
    { data: mediosPago },
    { data: productos },
    { data: materias },
    ivaPorPais,
  ] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select(
        "*, clientes(razon_social, contacto, email, telefono), vendedores(nombre, cargo, email, telefono)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("cotizacion_detalle")
      .select("*")
      .eq("id_cotizacion", id)
      .order("orden"),
    supabase.from("clientes").select("*").eq("activo", true).order("razon_social"),
    supabase.from("formas_pago").select("*").eq("activo", true).order("orden"),
    supabase.from("medios_pago").select("*").eq("activo", true).order("orden"),
    supabase
      .from("v_catalogo_venta")
      .select("id, sku, descripcion, tipo, familia, subfamilia, precio_venta, precio_manual")
      .eq("activo", true)
      .order("familia")
        .order("subfamilia")
      .order("descripcion"),
    // Insumos del panel emergente: la vista de venta no expone costos.
    supabase
      .from("v_materias_primas_venta")
      .select("id, nombre, tipo, etiqueta, espesor_nominal")
      .eq("activo", true)
      .order("nombre"),
    leerIvaPorPais(),
  ]);

  if (!cot) notFound();

  // Textos de correo y WhatsApp del mercado de la cotizacion.
  const parametros = await leerParametros(Number(cot.id_pais));

  // El pedido, si ya se genero: es lo que explica por que la cotizacion esta
  // congelada, asi que se muestra en la misma pantalla.
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, num_pedido")
    .eq("id_cotizacion", id)
    .maybeSingle();

  const supabaseTot = await createClient();
  const { data: tot } = await supabaseTot
    .from("v_cotizacion_totales")
    .select("total")
    .eq("id", id)
    .single();

  type Rel = Record<string, string | null>;
  const uno = (x: unknown): Rel | null =>
    Array.isArray(x) ? ((x[0] as Rel) ?? null) : ((x as Rel) ?? null);
  const cli = uno(cot.clientes);
  const ven = uno(cot.vendedores);

  const { paises, esAdminGeneral } = await contextoMercado(v);

  // Costo de hoy de cada producto del catalogo, para el margen. Va por
  // costo_productos() porque el vendedor no puede leer la tabla de productos
  // y el margen lo ven todos los perfiles.
  const costoPorProducto: Record<number, number> = {};
  const { data: costos } = await supabase.rpc("costo_productos", { p_ids: null });
  for (const x of (costos ?? []) as { id: number; costo: number }[]) {
    costoPorProducto[Number(x.id)] = Number(x.costo ?? 0);
  }


  // Grupo de descuento de cada producto (Productos, Flete o Instalaciones),
  // configurado en el catalogo. Va por funcion porque el vendedor no puede
  // leer la tabla de productos.
  const grupoPorProducto: Record<number, string> = {};
  const { data: grupos } = await supabase.rpc("grupos_productos");
  for (const g of (grupos ?? []) as { id: number; grupo: string }[]) {
    grupoPorProducto[Number(g.id)] = g.grupo;
  }

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Detalle de cotizacion"
        subtitulo="Datos del cliente, items y valorizacion"
      />
      <EditorCotizacion
        modo="ver"
        id={id}
        numCotizacion={cot.num_cotizacion}
        estado={cot.estado}
        clientes={clientes ?? []}
        paises={paises}
        esAdminGeneral={esAdminGeneral}
        formasPago={formasPago ?? []}
        mediosPago={(mediosPago ?? []).map((m) => ({
          id: Number(m.id),
          nombre: m.nombre as string,
          comision_pct: Number(m.comision_pct),
          activo: Boolean(m.activo),
          id_pais: Number(m.id_pais),
        }))}
        productos={productos ?? []}
        grupoPorProducto={grupoPorProducto}
        materias={materias ?? []}
        puedeCrearPanel={v.puede_crear || tienePerfilAdmin(v)}
        ivaPorPais={ivaPorPais}
        puedeEditar={v.puede_editar || tienePerfilAdmin(v)}
        verMargen
        costoPorProducto={costoPorProducto}
        inicial={{
          id_cliente: cot.id_cliente,
          id_vendedor: cot.id_vendedor,
          id_forma_pago: cot.id_forma_pago,
          id_medio_pago: cot.id_medio_pago,
          fecha: (cot.fecha as string).slice(0, 10),
          validez_dias: cot.validez_dias,
          tiempo_entrega: cot.tiempo_entrega ?? "",
          direccion_despacho: cot.direccion_despacho ?? "",
          notas: cot.notas ?? "",
          descuento_tipo: cot.descuento_tipo,
          descuento_pct: Number(cot.descuento_pct),
          descuento_monto: Number(cot.descuento_monto),
          descuento2_tipo: cot.descuento2_tipo ?? "Monto",
          descuento2_pct: Number(cot.descuento2_pct ?? 0),
          descuento2_monto: Number(cot.descuento2_monto ?? 0),
          descuento3_tipo: cot.descuento3_tipo ?? "Monto",
          descuento3_pct: Number(cot.descuento3_pct ?? 0),
          descuento3_monto: Number(cot.descuento3_monto ?? 0),
          items: (items ?? []).map((it) => ({
            id_producto: it.id_producto,
            sku: (it.sku as string | null) ?? null,
            descripcion: it.descripcion,
            unidades: Number(it.unidades),
            valor_unitario: Number(it.valor_unitario),
            costo_unitario: Number(it.costo_unitario),
          })),
        }}
      />

      <div className="max-w-screen-2xl mx-auto px-6 pb-4">
        <BotonGenerarPedido
          idCotizacion={id}
          numCotizacion={cot.num_cotizacion ?? ""}
          pedido={
            pedido
              ? { id: Number(pedido.id), num: pedido.num_pedido as string }
              : null
          }
          puede={v.puede_crear || tienePerfilAdmin(v)}
        />
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 pb-6">
        <EnvioCotizacion
          datos={{
            id,
            num: cot.num_cotizacion ?? "",
            total: Number(tot?.total ?? 0),
            vence: sumarDias(
              (cot.fecha as string).slice(0, 10),
              cot.validez_dias ?? 7
            ),
            cliente: cli?.razon_social ?? "",
            contacto: cli?.contacto ?? null,
            emailCliente: cli?.email ?? null,
            telefonoCliente: cli?.telefono ?? null,
            vendedor: ven?.nombre ?? "",
            cargoVendedor: ven?.cargo ?? null,
            emailVendedor: ven?.email ?? null,
            telefonoVendedor: ven?.telefono ?? null,
            asunto: pTxt(parametros, "AsuntoEmail", "Cotizacion {NUM}"),
            cuerpo: pTxt(parametros, "CuerpoEmail", ""),
            mensajeWhatsApp: pTxt(parametros, "MensajeWhatsApp", ""),
            estado: cot.estado,
            token: cot.token_publico as string,
          }}
        />
      </div>
    </div>
  );
}
