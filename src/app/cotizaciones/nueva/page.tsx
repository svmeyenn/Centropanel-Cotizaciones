import Cabecera from "@/components/Cabecera";
import EditorCotizacion from "@/components/EditorCotizacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerParametros, pNum, pTxt } from "@/lib/parametros";
import { hoyISO } from "@/lib/formato";

// Alta de cotizacion. Nada se escribe en la base hasta pulsar GRABAR: el
// borrador vive en el estado del formulario, que es la regla que Stephan fijo
// para Access (tablas locales) trasladada a la web.
export default async function Pagina() {
  const v = await requerirVendedor();
  const supabase = await createClient();

  const [
    { data: clientes },
    { data: formasPago },
    { data: mediosPago },
    { data: productos },
    { data: materias },
    params,
  ] = await Promise.all([
      supabase
        .from("clientes")
        .select("*")
        .eq("activo", true)
        .order("razon_social"),
      supabase
        .from("formas_pago")
        .select("*")
        .eq("activo", true)
        .order("orden"),
      supabase
        .from("medios_pago")
        .select("*")
        .eq("activo", true)
        .order("orden"),
      // v_catalogo_venta y no productos: un Vendedor no puede leer costos.
      supabase
        .from("v_catalogo_venta")
        .select("id, descripcion, tipo, familia, subfamilia, precio_venta, precio_manual")
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
      leerParametros(),
    ]);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Detalle de cotizacion"
        subtitulo="Datos del cliente, items y valorizacion"
      />
      <EditorCotizacion
        modo="crear"
        clientes={clientes ?? []}
        formasPago={formasPago ?? []}
        mediosPago={(mediosPago ?? []).map((m) => ({
          id: Number(m.id),
          nombre: m.nombre as string,
          comision_pct: Number(m.comision_pct),
          activo: Boolean(m.activo),
        }))}
        productos={productos ?? []}
        materias={materias ?? []}
        puedeCrearPanel={v.puede_crear || v.rol === "Administrador"}
        iva={pNum(params, "IVA", 0.19)}
        puedeEditar={v.puede_crear || v.rol === "Administrador"}
        inicial={{
          id_cliente: null,
          id_vendedor: v.id,
          id_forma_pago: null,
          id_medio_pago: null,
          fecha: hoyISO(),
          validez_dias: pNum(params, "ValidezDias", 7),
          tiempo_entrega: pTxt(params, "TiempoEntregaDefecto"),
          direccion_despacho: "",
          notas: "",
          descuento_tipo: "Monto",
          descuento_pct: 0,
          descuento_monto: 0,
          items: [],
        }}
      />
    </div>
  );
}
