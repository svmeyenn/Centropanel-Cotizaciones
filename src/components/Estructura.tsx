import { Suspense } from "react";
import MenuLateral from "@/components/MenuLateral";
import PestanasLaterales from "@/components/PestanasLaterales";
import { ProveedorEstados } from "@/components/ProveedorEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import RecordatorioDatos from "@/components/RecordatorioDatos";
import { menuDe } from "@/lib/menu";
import { clientesIncompletos } from "@/lib/recordatorio";
import { requerirVendedor } from "@/lib/sesion";
import { VERSION } from "@/lib/version";
import { ES_SANDBOX } from "@/lib/supabase/esquema";
import type { Vendedor } from "@/types/database";

// El recordatorio de datos a medias recorre hasta 300 cotizaciones. Va aparte, en su propio
// limite de carga, para que el menu y la pantalla no esperen esa consulta.
async function Recordatorio({ v }: { v: Vendedor }) {
  const incompletos = await clientesIncompletos(v);
  if (incompletos.length === 0) return null;
  return <RecordatorioDatos clientes={incompletos} idVendedor={v.id} />;
}

// Arma la pantalla de quien trabaja con sesion: el menu fijo a la izquierda y
// el contenido a la derecha. Las pantallas sin sesion --ingreso, recuperar
// clave y el enlace publico del cliente-- no pasan por aqui.
export default async function Estructura({
  children,
}: {
  children: React.ReactNode;
}) {
  const v = await requerirVendedor();
  const catalogo = await catalogoEstados();
  const grupos = menuDe(v);
  const config = grupos.find((g) => g.pestanas);

  return (
    <div className="flex min-h-screen">
      {/* Quien navega con teclado salta el menu de un solo Tab. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-verde focus:text-white focus:text-sm focus:font-semibold focus:px-3 focus:py-2 focus:rounded"
      >
        Saltar al contenido
      </a>
      <Suspense fallback={null}>
        <Recordatorio v={v} />
      </Suspense>
      <MenuLateral
        grupos={grupos}
        nombre={v.nombre}
        rol={v.rol}
        version={VERSION}
        sandbox={ES_SANDBOX}
      />
      <main id="contenido" tabIndex={-1} className="flex-1 min-w-0 outline-none">
        <ProveedorEstados catalogo={catalogo}>
          <PestanasLaterales titulo={config?.titulo ?? ""} opciones={config?.opciones ?? []}>
            {children}
          </PestanasLaterales>
        </ProveedorEstados>
      </main>
    </div>
  );
}
