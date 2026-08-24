import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import EditorCotizacion from "@/components/EditorCotizacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerParametros, pNum } from "@/lib/parametros";

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
    { data: productos },
    parametros,
  ] = await Promise.all([
    supabase.from("cotizaciones").select("*").eq("id", id).single(),
    supabase
      .from("cotizacion_detalle")
      .select("*")
      .eq("id_cotizacion", id)
      .order("orden"),
    supabase.from("clientes").select("*").eq("activo", true).order("razon_social"),
    supabase.from("formas_pago").select("*").eq("activo", true).order("orden"),
    supabase
      .from("v_catalogo_venta")
      .select("id, descripcion, tipo, precio_venta")
      .eq("activo", true)
      .order("descripcion"),
    leerParametros(),
  ]);

  if (!cot) notFound();

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
        formasPago={formasPago ?? []}
        productos={productos ?? []}
        iva={pNum(parametros, "IVA", 0.19)}
        puedeEditar={v.puede_editar || v.rol === "Administrador"}
        inicial={{
          id_cliente: cot.id_cliente,
          id_vendedor: cot.id_vendedor,
          id_forma_pago: cot.id_forma_pago,
          fecha: (cot.fecha as string).slice(0, 10),
          validez_dias: cot.validez_dias,
          tiempo_entrega: cot.tiempo_entrega ?? "",
          direccion_despacho: cot.direccion_despacho ?? "",
          notas: cot.notas ?? "",
          descuento_tipo: cot.descuento_tipo,
          descuento_pct: Number(cot.descuento_pct),
          descuento_monto: Number(cot.descuento_monto),
          items: (items ?? []).map((it) => ({
            id_producto: it.id_producto,
            descripcion: it.descripcion,
            unidades: Number(it.unidades),
            valor_unitario: Number(it.valor_unitario),
            costo_unitario: Number(it.costo_unitario),
          })),
        }}
      />
    </div>
  );
}
