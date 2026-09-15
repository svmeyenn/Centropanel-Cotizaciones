import Link from "next/link";
import type { Pais } from "@/types/database";

// Elige de que pais se administran los datos en la vista Todos. Con un mercado
// activo no aparece: se administra ese.
export default function PestanasPais({
  paises,
  elegido,
  ruta,
}: {
  paises: Pais[];
  elegido: Pais;
  ruta: string;
}) {
  if (paises.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-600">Mercado:</span>
      {paises.map((x) => (
        <Link
          key={x.id}
          href={`${ruta}?pais=${x.codigo}`}
          aria-current={x.id === elegido.id ? "page" : undefined}
          className={`bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ${
            x.id === elegido.id ? "ring-2 ring-dorado ring-offset-1" : "opacity-70"
          }`}
        >
          {x.nombre}
        </Link>
      ))}
    </div>
  );
}
