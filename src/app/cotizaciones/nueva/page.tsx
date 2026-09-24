import Cabecera from "@/components/Cabecera";
import EditorCotizacion from "@/components/EditorCotizacion";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerIvaPorPais, leerParametros, pNum, pTxt } from "@/lib/parametros";
import { hoyISO } from "@/lib/formato";

// Alta de cotizacion. Nada se escribe en la base hasta pulsar GRABAR: el
// borrador vive en el estado del formulario, que es la regla que Stephan fijo
// para Access (tablas locales) trasladada a la web.
export default async function Pagina() {
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo, idPaisTrabajo } =
    await contextoMercado(v);

  const [
    { data: clientes },
    { data: formasPago },
    { data: mediosPago },
    { data: productos },
    { data: materias },
    params,
    ivaPorPais,
  ] = await Promise.all([
      conPais(
        supabase.from("clientes").select("*").eq("activo", true),
        idPaisActivo
      ).order("razon_social"),
      // De todos los mercados que alcanza: el editor muestra los del pais
      // del cliente elegido.
      conPais(
        supabase.from("formas_pago").select("*").eq("activo", true),
        idPaisActivo
      ).order("orden"),
      conPais(
        supabase.from("medios_pago").select("*").eq("activo", true),
        idPaisActivo
      ).order("orden"),
      // v_catalogo_venta y no productos: un Vendedor no puede leer costos.
      conPais(
        supabase
          .from("v_catalogo_venta")
          .select("id, descripcion, tipo, familia, subfamilia, precio_venta, precio_manual")
          .eq("activo", true),
        idPaisActivo
      )
        .order("familia")
        .order("subfamilia")
        .order("descripcion"),
      // Insumos del panel emergente: la vista de venta no expone costos.
      conPais(
        supabase
          .from("v_materias_primas_venta")
          .select("id, nombre, tipo, etiqueta, espesor_nominal")
          .eq("activo", true),
        idPaisActivo
      ).order("nombre"),
      leerParametros(idPaisTrabajo),
      leerIvaPorPais(),
    ]);

  // Se propone la forma de pago marcada como predeterminada --hoy el 50/50--,
  // y queda modificable como cualquier otro campo. Cual es se define en
  // Formas de pago, no aqui. Con los dos mercados se propone al elegir cliente.
  const formaPorDefecto =
    paises.length === 1
      ? ((formasPago ?? []).find(
          (f) => f.por_defecto && Number(f.id_pais) === paises[0].id
        )?.id ?? null)
      : null;

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
        modo="crear"
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
        puedeEditar={v.puede_crear || tienePerfilAdmin(v)}
        verMargen
        costoPorProducto={costoPorProducto}
        inicial={{
          id_cliente: null,
          id_vendedor: v.id,
          id_forma_pago: formaPorDefecto,
          id_medio_pago: null,
          fecha: hoyISO(),
          validez_dias: pNum(params, "ValidezDias", 7),
          tiempo_entrega: pTxt(params, "TiempoEntregaDefecto"),
          direccion_despacho: "",
          notas: "",
          descuento_tipo: "Monto",
          descuento_pct: 0,
          descuento_monto: 0,
          descuento2_tipo: "Monto",
          descuento2_pct: 0,
          descuento2_monto: 0,
          descuento3_tipo: "Monto",
          descuento3_pct: 0,
          descuento3_monto: 0,
          items: [],
        }}
      />
    </div>
  );
}
