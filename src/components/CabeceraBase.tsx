import type { ReactNode } from "react";
import Link from "next/link";
import LOGO from "@/lib/logo";
import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Franja superior: titulo, subtitulo y el pais, en una sola linea y lo mas
// delgada posible para dejarle la pantalla al contenido. Sigue el estilo de la
// aplicacion de Finanzas.
//
// Con sesion el logo vive arriba del menu lateral, a la izquierda, y aqui no
// se repite. Las pantallas sin menu --ingreso, recuperar y cambiar la clave--
// lo muestran en la franja, sobre blanco.
//
// El logo va como data URI (src/lib/logo.ts) y con <img> en vez de next/image:
// asi viaja dentro del bundle y no depende de subir el binario por separado en
// cada despliegue, que es justo donde se perdio la primera vez.
export default function CabeceraBase({
  titulo,
  subtitulo,
  enlazarLogo = true,
  mostrarLogo = true,
  derecha,
  franja,
}: {
  titulo: string;
  subtitulo?: string;
  // El login no tiene a donde volver: ahi el logo va sin enlace.
  enlazarLogo?: boolean;
  mostrarLogo?: boolean;
  // Lo que va a la derecha de la banda: el pais.
  derecha?: ReactNode;
  // Color de la franja inferior, que identifica el mercado de un vistazo.
  franja?: string;
}) {
  const logo = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={LOGO} alt="Centro Panel" className="h-8 w-auto shrink-0" />
  );

  return (
    <>
      {/* Copia de pruebas: se avisa en cada pantalla para que nadie cotice a
          un cliente creyendo que esta en el sistema de verdad. */}
      {ES_SANDBOX && (
        <div className="bg-dorado-osc text-white text-[11px] font-semibold text-center px-4 py-0.5 print:hidden">
          AMBIENTE DE PRUEBAS &middot; los datos de esta copia no son los del
          sistema real y no llegan a produccion
        </div>
      )}
      <header className="flex items-stretch h-10">
        {mostrarLogo && (
          <div className="bg-white px-3 flex items-center shrink-0">
            {enlazarLogo ? (
              <Link href="/" title="Volver al menu principal">
                {logo}
              </Link>
            ) : (
              logo
            )}
          </div>
        )}
        <div className="flex-1 min-w-0 bg-verde px-4 flex items-center gap-3">
          <h1 className="text-white text-base font-semibold leading-none truncate">
            {titulo}
          </h1>
          {subtitulo && (
            <span className="hidden md:inline text-dorado text-xs leading-none truncate">
              {subtitulo}
            </span>
          )}
          {derecha && <div className="ml-auto shrink-0 print:hidden">{derecha}</div>}
        </div>
      </header>
      {franja && (
        <div className="h-0.5 print:hidden" style={{ backgroundColor: franja }} />
      )}
    </>
  );
}
