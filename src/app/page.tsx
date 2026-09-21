import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import { requerirVendedor } from "@/lib/sesion";
import { menuDe } from "@/lib/menu";
import { VERSION } from "@/lib/version";
import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Portada. Muestra lo mismo que el menu lateral, en grande y con la nota de
// cada grupo: es donde se aterriza al entrar.
export default async function Home() {
  const v = await requerirVendedor();
  const grupos = menuDe(v);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="COTIZADOR SIP"
        subtitulo="Costeo y cotizacion de paneles estructurales"
      />
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-gray-600 mb-5">
          Sesion: <span className="font-semibold">{v.nombre}</span> ({v.rol})
        </p>

        <div className="space-y-5">
          {grupos.map((g) => (
            <section key={g.titulo}>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-semibold text-verde">{g.titulo}</h2>
                <span className="text-xs text-gray-500">{g.nota}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
