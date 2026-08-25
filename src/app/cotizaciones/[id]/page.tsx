import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import EditorCotizacion from "@/components/EditorCotizacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerParametros, pNum, pTxt } from "@/lib/parametros";
import EnvioCotizacion from "@/components/EnvioCotizacion";
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
    { data: productos },
    parametros,
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
    supabase
      .from("v_catalogo_venta")
      .select("id, descripcion, tipo, precio_venta")
      .eq("activo", true)
      .order("descripcion"),
    leerParametros(),
  ]);

  if (!cot) notFound();

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

      <div className="max-w-5xl mx-auto px-6 pb-6">
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
          }}
        />
      </div>
    </div>
  );
}
