import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import FormProyecto from "@/components/FormProyecto";
import PresupuestoProyecto from "@/components/PresupuestoProyecto";
import GanttProyecto from "@/components/GanttProyecto";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { dinero, fecha, hoyISO, monedaDelPais } from "@/lib/formato";

export const dynamic = "force-dynamic";

const PESTANAS = [
  ["resumen", "Resumen"],
  ["presupuesto", "Presupuesto"],
  ["gantt", "Cronograma"],
  ["compras", "Compras"],
  ["datos", "Datos"],
] as const;

const uno = <T,>(x: unknown): T | null => (Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null));

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const v = await requerirVendedor();
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const tab = (await searchParams).tab ?? "resumen";
  const puedeEditar = tienePerfilAdmin(v);

  const supabase = await createClient();
  const { data: p } = await supabase.from("proyectos").select("*").eq("id_proyecto", id).single();
  if (!p) notFound();
  const moneda = monedaDelPais(Number(p.id_pais));

  const [{ data: costos }, { data: tareas }, { data: ocs }, { data: res }, { data: pedidos }, { data: vendedores }] =
    await Promise.all([
      supabase.from("v_partida_costos").select("*").eq("id_proyecto", id).order("id"),
      supabase
        .from("proyecto_tareas")
        .select("id, nombre, fecha_inicio, fecha_fin, avance, id_predecesora, id_partida, hito")
        .eq("id_proyecto", id)
        .order("fecha_inicio")
        .order("id"),
      supabase
        .from("ordenes_compra")
        .select("id, num_oc, estado, fecha, total, id_partida, entidades(razon_social)")
        .eq("id_proyecto", id)
        .order("id", { ascending: false }),
      supabase.from("v_proyecto_resumen").select("*").eq("id_proyecto", id).single(),
      supabase.from("pedidos").select("id, num_pedido, estado").eq("id_proyecto", id),
      supabase.from("vendedores").select("id, nombre").eq("activo", true).order("nombre"),
    ]);

  const partidas = (costos ?? []).map((c) => ({
    id: Number(c.id),
    codigo: null as string | null,
    nombre: c.nombre as string,
    categoria: c.categoria as string,
    presupuesto: Number(c.presupuesto),
    comprometido: Number(c.comprometido),
    por_aprobar: Number(c.por_aprobar),
  }));
  // El codigo no viaja en la vista: se lee aparte para el editor.
  const { data: codigos } = await supabase.from("proyecto_partidas").select("id, codigo").eq("id_proyecto", id);
  const cod = new Map((codigos ?? []).map((c) => [Number(c.id), c.codigo as string | null]));
  for (const x of partidas) x.codigo = cod.get(x.id) ?? null;

  const pres = Number(res?.presupuesto ?? 0);
  const comp = Number(res?.comprometido ?? 0);
  const apr = Number(res?.por_aprobar ?? 0);
  const egr = Number(res?.egresos ?? 0);
  const ing = Number(res?.ingresos ?? 0);
  const avance = Number(res?.avance ?? 0);
  const nombreResp = (vendedores ?? []).find((x) => Number(x.id) === Number(p.id_responsable))?.nombre;

  const Kpi = ({ t, v: valor, rojo }: { t: string; v: string; rojo?: boolean }) => (
    <div className="bg-white border border-gray-200 rounded p-3">
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{t}</div>
      <div className={`text-lg font-bold ${rojo ? "text-red-700" : "text-verde"}`}>{valor}</div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo={p.nombre as string}
        subtitulo={`${p.cliente ?? "Sin cliente"} · ${p.estado}${nombreResp ? ` · Responsable: ${nombreResp}` : ""}`}
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/proyectos" />

        <div className="flex gap-1 border-b border-gray-200">
          {PESTANAS.map(([k, t]) => (
            <Link
              key={k}
              href={`/proyectos/${id}?tab=${k}`}
              className={`px-3 py-1.5 text-sm rounded-t ${
                tab === k ? "bg-verde text-white font-semibold" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>

        {tab === "resumen" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi t="Presupuesto" v={dinero(pres, moneda)} />
              <Kpi t="Comprometido (OC aprobadas)" v={dinero(comp, moneda)} />
              <Kpi t="Disponible" v={dinero(pres - comp, moneda)} rojo={pres > 0 && pres - comp < 0} />
              <Kpi t="OC por aprobar" v={dinero(apr, moneda)} />
              <Kpi t="Ingresos registrados" v={dinero(ing, moneda)} />
              <Kpi t="Egresos registrados" v={dinero(egr, moneda)} />
              <Kpi t="Resultado" v={dinero(ing - egr, moneda)} rojo={ing - egr < 0} />
              <Kpi t="Avance del cronograma" v={`${avance}%`} />
            </div>
            <div className="text-sm text-gray-600">
              {p.fecha_inicio ? `${fecha(p.fecha_inicio)} → ${p.fecha_fin ? fecha(p.fecha_fin) : "sin termino"}` : "Sin fechas definidas."}
              {p.direccion ? ` · ${p.direccion}` : ""}
            </div>
            {(pedidos ?? []).length > 0 && (
              <div className="text-sm">
                Pedidos de venta:{" "}
                {(pedidos ?? []).map((x) => (
                  <Link key={x.id} href={`/pedidos/${x.id}`} className="text-verde hover:underline mr-3">
                    {x.num_pedido} ({x.estado})
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "presupuesto" && (
          <PresupuestoProyecto idProyecto={id} partidas={partidas} moneda={moneda} puedeEditar={puedeEditar} />
        )}

        {tab === "gantt" && (
          <GanttProyecto
            idProyecto={id}
            tareas={(tareas ?? []).map((t) => ({
              id: Number(t.id),
              nombre: t.nombre as string,
              fecha_inicio: t.fecha_inicio as string,
              fecha_fin: t.fecha_fin as string,
              avance: Number(t.avance),
              id_predecesora: t.id_predecesora != null ? Number(t.id_predecesora) : null,
              id_partida: t.id_partida != null ? Number(t.id_partida) : null,
              hito: Boolean(t.hito),
            }))}
            partidas={partidas.map((x) => ({ id: x.id, nombre: x.nombre }))}
            puedeEditar={puedeEditar}
            hoy={hoyISO()}
          />
        )}

        {tab === "compras" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Link
                href={`/compras/nueva?proyecto=${id}`}
                className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
              >
                Nueva orden de compra
              </Link>
            </div>
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-verde text-white">
                  <tr>
                    <th className="text-left px-3 py-2">OC</th>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Proveedor</th>
                    <th className="text-left px-3 py-2">Partida</th>
                    <th className="text-left px-3 py-2">Estado</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(ocs ?? []).map((o) => (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold">
                        <Link href={`/compras/${o.id}`} className="text-verde hover:underline">
                          {o.num_oc}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{fecha(o.fecha)}</td>
                      <td className="px-3 py-2">{uno<{ razon_social: string }>(o.entidades)?.razon_social}</td>
                      <td className="px-3 py-2">{partidas.find((x) => x.id === Number(o.id_partida))?.nombre ?? "—"}</td>
                      <td className="px-3 py-2">{o.estado}</td>
                      <td className="px-3 py-2 text-right">{dinero(Number(o.total), moneda)}</td>
                    </tr>
                  ))}
                  {(ocs ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                        Sin ordenes de compra.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "datos" && (
          <FormProyecto
            id={id}
            inicial={{
              nombre: p.nombre as string,
              cliente: (p.cliente as string) ?? "",
              tipo: p.tipo,
              estado: p.estado,
              id_responsable: p.id_responsable != null ? Number(p.id_responsable) : null,
              direccion: (p.direccion as string) ?? "",
              fecha_inicio: (p.fecha_inicio as string) ?? "",
              fecha_fin: (p.fecha_fin as string) ?? "",
              notas: (p.notas as string) ?? "",
            }}
            responsables={(vendedores ?? []).map((x) => ({ id: Number(x.id), nombre: x.nombre as string }))}
            puedeEditar={puedeEditar}
            etiquetaBoton="Editar"
          />
        )}
      </div>
    </div>
  );
}
