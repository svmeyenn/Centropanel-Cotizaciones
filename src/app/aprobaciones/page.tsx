import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import ColaAprobacion, { type ItemCola } from "@/components/ColaAprobacion";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { monedaDelPais } from "@/lib/formato";
import { uno } from "@/lib/relaciones";
import { cargarEnlacesRespaldo } from "@/lib/finanzas/consultas";

export const dynamic = "force-dynamic";

// Todo lo que espera una firma: ordenes de compra y egresos. Cada uno lo
// aprueba quien esta asignado al proyecto; sin aprobador asignado, cualquier
// Administrador.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") redirect("/");
  const supabase = await createClient();
  const { idPaisActivo } = await contextoMercado(v);

  const [{ data: ocs }, { data: egr }, { data: vend }, { data: proy }] = await Promise.all([
    conPais(
      supabase
        .from("ordenes_compra")
        .select("id, num_oc, id_pais, id_proyecto, id_solicitante, fecha, total, entidades(razon_social), proyectos(nombre)")
        .eq("estado", "Pendiente aprobacion"),
      idPaisActivo
    ),
    conPais(
      supabase
        .from("movimientos")
        .select("id_mov, id_pais, id_proyecto, id_vendedor, monto, fecha_registro, origen_destino, comentario, documento")
        .eq("tipo", "Egreso")
        .eq("estado_pago", "Pendiente")
        .eq("aprobacion", "Pendiente")
        .is("id_oc", null),
      idPaisActivo
    ),
    supabase.from("vendedores").select("id, nombre"),
    supabase.from("proyectos").select("id_proyecto, nombre, cliente"),
  ]);

  // Una consulta por proyecto distinto, no por fila.
  const proyectos = [...new Set([...(ocs ?? []), ...(egr ?? [])].map((x) => `${x.id_proyecto ?? 0}|${x.id_pais}`))];
  const puede = new Map<string, boolean>();
  await Promise.all(
    proyectos.map(async (k) => {
      const [p, pais] = k.split("|").map(Number);
      const { data } = await supabase.rpc("puede_aprobar_proyecto", { p_proyecto: p || null, p_pais: pais });
      puede.set(k, Boolean(data));
    })
  );

  // El respaldo de cada egreso, para abrirlo sin salir de la bandeja.
  const adjuntos = await cargarEnlacesRespaldo((egr ?? []).map((m) => Number(m.id_mov)));

  const quien = new Map((vend ?? []).map((x) => [Number(x.id), x.nombre as string]));
  const nombreProy = new Map(
    (proy ?? []).map((x) => [Number(x.id_proyecto), `${x.nombre}${x.cliente ? ` · ${x.cliente}` : ""}`])
  );

  const items: ItemCola[] = [
    ...(ocs ?? []).map((o) => ({
      clave: `o${o.id}`,
      tipo: "orden" as const,
      id: Number(o.id),
      titulo: o.num_oc as string,
      detalle: `Orden de compra · ${uno<{ razon_social: string }>(o.entidades)?.razon_social ?? ""}`,
      proyecto: uno<{ nombre: string }>(o.proyectos)?.nombre ?? "",
      solicita: quien.get(Number(o.id_solicitante)) ?? "",
      fecha: o.fecha as string,
      monto: Number(o.total),
      moneda: monedaDelPais(Number(o.id_pais)),
      puede: puede.get(`${o.id_proyecto ?? 0}|${o.id_pais}`) ?? false,
      enlace: `/compras/${o.id}`,
    })),
    ...(egr ?? []).map((m) => ({
      clave: `e${m.id_mov}`,
      tipo: "egreso" as const,
      id: Number(m.id_mov),
      titulo: (m.origen_destino as string) || "Egreso",
      detalle: `Egreso${m.documento ? ` · doc ${m.documento}` : ""}${m.comentario ? ` · ${m.comentario}` : ""}`,
      proyecto: nombreProy.get(Number(m.id_proyecto)) ?? "",
      solicita: quien.get(Number(m.id_vendedor)) ?? "",
      fecha: String(m.fecha_registro).slice(0, 10),
      monto: Number(m.monto),
      moneda: monedaDelPais(Number(m.id_pais)),
      puede: puede.get(`${m.id_proyecto ?? 0}|${m.id_pais}`) ?? false,
      enlace: "/egresos",
      adjunto: adjuntos[Number(m.id_mov)] ?? null,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Por aprobar" subtitulo="Ordenes de compra y egresos que esperan su firma" />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <ColaAprobacion items={items} />
      </div>
    </div>
  );
}
