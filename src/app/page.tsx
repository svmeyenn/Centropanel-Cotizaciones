import Cabecera from "@/components/Cabecera";
import PanelDesempeno, { type Desempeno } from "@/components/PanelDesempeno";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
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

  const { idPaisActivo } = await contextoMercado(v);
  const supabase = await createClient();
  const { data: panel } = await supabase.rpc("panel_desempeno", {
    p_pais: idPaisActivo,
    // Llega como AAAA-MM desde el selector; la base espera una fecha.
    p_mes: /^\d{4}-\d{2}$/.test(mes ?? "") ? `${mes}-01` : null,
  });
  const desempeno = panel as Desempeno | null;

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="COTIZADOR SIP"
        subtitulo="Costeo y cotizacion de paneles estructurales"
      />
      <div className="max-w-screen-2xl mx-auto p-4 space-y-3">
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
