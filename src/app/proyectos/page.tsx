import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import FormProyecto from "@/components/FormProyecto";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { dinero, fecha, monedaDelPais } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const v = await requerirVendedor();
  const { ver } = await searchParams;
  const verCerrados = ver === "todos";
  const supabase = await createClient();
  const { idPaisActivo } = await contextoMercado(v);

  const [{ data: proyectos }, { data: resumen }, { data: vendedores }] = await Promise.all([
    conPais(
      supabase
        .from("proyectos")
        .select("id_proyecto, id_pais, nombre, cliente, tipo, estado, activo, fecha_inicio, fecha_fin, id_responsable")
        .eq("borrado", false),
      idPaisActivo
    ).order("id_proyecto", { ascending: false }),
    supabase.from("v_proyecto_resumen").select("*"),
    supabase.from("vendedores").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const res = new Map((resumen ?? []).map((r) => [Number(r.id_proyecto), r]));
  const quien = new Map((vendedores ?? []).map((x) => [Number(x.id), x.nombre as string]));
  const filas = (proyectos ?? []).filter(
    (p) => verCerrados || (p.activo && p.estado !== "Cerrado")
  );

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Proyectos"
        subtitulo="Cada obra con su presupuesto, cronograma y compras"
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-600 flex gap-3">
            <Link href="/proyectos" className={!verCerrados ? "font-bold underline" : ""}>
              Activos
            </Link>
            <Link href="/proyectos?ver=todos" className={verCerrados ? "font-bold underline" : ""}>
              Todos
            </Link>
          </div>
          <FormProyecto
            responsables={(vendedores ?? []).map((x) => ({ id: Number(x.id), nombre: x.nombre as string }))}
            puedeEditar={tienePerfilAdmin(v)}
            etiquetaBoton="Nuevo proyecto"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th className="text-left px-3 py-2">Proyecto</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Responsable</th>
                  <th className="text-left px-3 py-2">Plazo</th>
                  <th className="text-right px-3 py-2">Avance</th>
                  <th className="text-right px-3 py-2">Presupuesto</th>
                  <th className="text-right px-3 py-2">Comprometido</th>
                  <th className="text-right px-3 py-2">Disponible</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => {
                  const r = res.get(Number(p.id_proyecto));
                  const m = monedaDelPais(Number(p.id_pais));
                  const pres = Number(r?.presupuesto ?? 0);
                  const comp = Number(r?.comprometido ?? 0);
                  const disp = pres - comp;
                  return (
                    <tr key={p.id_proyecto} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold">
                        <Link href={`/proyectos/${p.id_proyecto}`} className="text-verde hover:underline">
                          {p.nombre}
                        </Link>
                        {p.tipo === "centro_costo" && (
                          <span className="ml-2 text-[10px] text-gray-500">centro de costo</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{p.cliente ?? ""}</td>
                      <td className="px-3 py-2">{p.estado}</td>
                      <td className="px-3 py-2">{quien.get(Number(p.id_responsable)) ?? ""}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.fecha_inicio ? fecha(p.fecha_inicio) : "—"} → {p.fecha_fin ? fecha(p.fecha_fin) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">{Number(r?.avance ?? 0)}%</td>
                      <td className="px-3 py-2 text-right">{pres ? dinero(pres, m) : "—"}</td>
                      <td className="px-3 py-2 text-right">{comp ? dinero(comp, m) : "—"}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${pres && disp < 0 ? "text-red-700" : ""}`}>
                        {pres ? dinero(disp, m) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                      Sin proyectos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
