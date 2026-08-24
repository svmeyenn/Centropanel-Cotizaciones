import LOGO from "@/lib/logo";

// Banda verde con logo y titulo/subtitulo. Replica el encabezado canonico que
// se uniformo en los 12 formularios de Access (recCab 900 twips, logo chico,
// titulo 17pt, subtitulo 9pt dorado): ver memoria del proyecto.
//
// El logo va como data URI (src/lib/logo.ts) y con <img> en vez de next/image:
// asi viaja dentro del bundle y no depende de subir el binario por separado en
// cada despliegue, que es justo donde se perdio la primera vez.
export default function Cabecera({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <div className="bg-verde px-6 py-4 flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO}
        alt="Centro Panel"
        width={64}
        height={46}
        className="shrink-0 h-[46px] w-auto"
      />
      <div>
        <h1 className="text-white text-xl font-bold leading-tight">{titulo}</h1>
        {subtitulo && (
          <p className="text-dorado text-sm leading-tight">{subtitulo}</p>
        )}
      </div>
    </div>
  );
}
