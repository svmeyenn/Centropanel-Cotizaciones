import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import PanelDesempeno, { type Desempeno } from "@/components/PanelDesempeno";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { menuDe } from "@/lib/menu";
import { VERSION } from "@/lib/version";
import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Portada. Arriba, como va el mes; abajo, los mismos accesos del menu lateral
// con la nota de cada grupo. El tablero lo calcula entero panel_desempeno()
// en la base, filtrado por el mercado activo.
export default async function Home() {
  const v = await requerirVendedor();
  const grupos = menuDe(v);

  const { idPaisActivo } = await contextoMercado(v);
  const supabase = await createClient();
  const { data: panel } = await supabase.rpc("panel_desempeno", {
    p_pais: idPaisActivo,
  });
  const desempeno = panel as Desempeno | null;

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="COTIZADOR SIP"
        subtitulo="Costeo y cotizacion de paneles estructurales"
      />
      <div className="max-w-screen-2xl mx-auto p-6">
        <p className="text-sm text-gray-600 mb-5">
          Sesion: <span className="font-semibold">{v.nombre}</span> ({v.rol})
        </p>

        {desempeno && (
          <div className="mb-8">
            <PanelDesempeno d={desempeno} />
          </div>
        )}

        <div className="space-y-5">
          {grupos.map((g) => (
            <section key={g.titulo}>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-semibold text-verde">{g.titulo}</h2>
                <span className="text-xs text-gray-500">{g.nota}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {g.opciones.map((o) => (
                  <Link
                    key={o.href}
                    href={o.href}
                    className="bg-white border border-gray-200 rounded px-4 py-3 text-sm font-semibold text-verde hover:border-verde transition-colors"
                  >
                    {o.texto}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Version vigente: sube con cada entrega a produccion (VERSIONES.md).
            En pruebas se aclara que hay cambios que aun no estan en ella. */}
        <p className="mt-8 text-[11px] text-gray-500">
          Version {VERSION}
          {ES_SANDBOX ? " · con cambios en prueba aun no publicados" : ""}
        </p>
      </div>
    </div>
  );
}
