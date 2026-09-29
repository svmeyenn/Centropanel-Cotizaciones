import BandaDivisas from "@/components/BandaDivisas";
import Cabecera from "@/components/Cabecera";
import PanelDesempeno, { type Desempeno } from "@/components/PanelDesempeno";
import TareasPendientes, { type Tarea } from "@/components/TareasPendientes";
import { cargarParidades } from "@/lib/divisas";
import {
  contextoMercado,
  requerirVendedor,
  tienePerfilAdmin,
} from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { VERSION } from "@/lib/version";
import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Portada: como va el mes. Los accesos ya estan en el menu lateral, que esta
// siempre a la vista, asi que aqui no se repiten. El tablero lo calcula entero
// panel_desempeno() en la base, para el mercado activo y el mes elegido.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const v = await requerirVendedor();
  const { mes } = await searchParams;

  const { idPaisActivo, activo, accesibles } = await contextoMercado(v);

  // Las paridades que se miran son las del mercado en que se trabaja: desde
  // Chile importa el dolar y la UF; desde Peru, cuanto vale su sol. Con los dos
  // mercados a la vista se muestra una banda por pais.
  const mercadosEnBanda = activo ? [activo] : accesibles;
  const bandas = await Promise.all(
    mercadosEnBanda.map(async (p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      paridades: await cargarParidades(p.codigo),
    }))
  );
  const supabase = await createClient();
  const { data: panel } = await supabase.rpc("panel_desempeno", {
    p_pais: idPaisActivo,
    // Llega como AAAA-MM desde el selector; la base espera una fecha.
    p_mes: /^\d{4}-\d{2}$/.test(mes ?? "") ? `${mes}-01` : null,
  });
  const desempeno = panel as Desempeno | null;

  // Lo comprometido en las bitacoras y todavia no hecho. Un vendedor ve lo
  // suyo; quien dirige ve lo del equipo, que es lo que necesita para saber que
  // esta quedando en el camino.
  const soloMias = !tienePerfilAdmin(v);
  let consultaTareas = supabase
    .from("v_tareas_pendientes")
    .select("*")
    // Lo mas atrasado primero: es lo que hay que resolver hoy.
    .order("proxima_fecha", { ascending: true })
    .limit(50);

  if (soloMias) consultaTareas = consultaTareas.eq("id_vendedor", v.id);
  if (idPaisActivo) consultaTareas = consultaTareas.eq("id_pais", idPaisActivo);

  const { data: tareas } = await consultaTareas;

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="SISTEMA DE GESTION"
        subtitulo="Ventas, produccion, cobranza y finanzas"
      />
      <div className="max-w-screen-2xl mx-auto p-4 space-y-3">
        <BandaDivisas bandas={bandas} />

        <p className="text-[11px] text-gray-600">
          Sesion: <span className="font-semibold">{v.nombre}</span> ({v.rol})
        </p>

        {desempeno ? (
          <PanelDesempeno d={desempeno} />
        ) : (
          <p className="text-sm text-gray-500">
            No se pudo cargar el tablero. Use el menu de la izquierda.
          </p>
        )}

        <TareasPendientes
          tareas={(tareas ?? []) as Tarea[]}
          puedeCerrar={v.puede_editar}
          soloMias={soloMias}
        />

        {/* Version vigente: sube con cada entrega a produccion (VERSIONES.md).
            En pruebas se aclara que hay cambios que aun no estan en ella. */}
        <p className="text-[10px] text-gray-500">
          Version {VERSION}
          {ES_SANDBOX ? " · con cambios en prueba aun no publicados" : ""}
        </p>
      </div>
    </div>
  );
}
