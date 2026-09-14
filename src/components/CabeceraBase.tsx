import type { ReactNode } from "react";
import Link from "next/link";
import LOGO from "@/lib/logo";
import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Banda verde con logo y titulo/subtitulo. Replica el encabezado canonico que
// se uniformo en los 12 formularios de Access (recCab 900 twips, logo chico,
// titulo 17pt, subtitulo 9pt dorado): ver memoria del proyecto.
//
// El logo va como data URI (src/lib/logo.ts) y con <img> en vez de next/image:
// asi viaja dentro del bundle y no depende de subir el binario por separado en
// cada despliegue, que es justo donde se perdio la primera vez.
//
// Esta version no sabe nada de la sesion: la usa el login, que es componente de
// cliente y no tiene usuario todavia. El resto de las pantallas usa Cabecera,
// que le agrega el mercado.
export default function CabeceraBase({
  titulo,
  subtitulo,
  enlazarLogo = true,
  derecha,
  franja,
}: {
  titulo: string;
  subtitulo?: string;
  // El login no tiene a donde volver: ahi el logo va sin enlace.
  enlazarLogo?: boolean;
  // Lo que va a la derecha de la banda: el mercado activo.
  derecha?: ReactNode;
  // Color de la franja inferior, que identifica el mercado de un vistazo.
  franja?: string;
}) {
  const logo = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={LOGO}
      alt="Centro Panel"
      width={64}
      height={46}
      className="shrink-0 h-[46px] w-auto"
    />
  );

  return (
    <>
      {/* Copia de pruebas: se avisa en cada pantalla para que nadie cotice a
          un cliente creyendo que esta en el sistema de verdad. */}
      {ES_SANDBOX && (
        <div className="bg-dorado-osc text-white text-xs font-bold text-center px-4 py-1.5 print:hidden">
          AMBIENTE DE PRUEBAS &middot; los datos de esta copia no son los del
          sistema real y no llegan a produccion
        </div>
      )}
      <div className="bg-verde px-6 py-4 flex flex-wrap items-center gap-4">
        {enlazarLogo ? (
          <Link
            href="/"
            title="Volver al menu principal"
            className="shrink-0 rounded hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-dorado"
          >
            {logo}
          </Link>
        ) : (
          logo
        )}
        <div className="min-w-0">
          <h1 className="text-white text-xl font-bold leading-tight">
            {titulo}
          </h1>
          {subtitulo && (
            <p className="text-dorado text-sm leading-tight">{subtitulo}</p>
          )}
        </div>
        {derecha && <div className="ml-auto print:hidden">{derecha}</div>}
      </div>
      {franja && (
        <div className="h-1 print:hidden" style={{ backgroundColor: franja }} />
      )}
    </>
  );
}
