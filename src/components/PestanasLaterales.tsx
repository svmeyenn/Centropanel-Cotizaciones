"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OpcionVisible } from "@/lib/menu";

// Las pantallas de Configuracion comparten una columna de pestanas a la izquierda:
// se cambia de una a otra sin volver al menu. Fuera de esas rutas no hace nada.
export default function PestanasLaterales({
  titulo,
  opciones,
  children,
}: {
  titulo: string;
  opciones: OpcionVisible[];
  children: React.ReactNode;
}) {
  const ruta = usePathname();
  const activa = (href: string) => ruta === href || ruta.startsWith(href + "/");
  if (!opciones.some((o) => activa(o.href))) return <>{children}</>;

  return (
    <div className="flex flex-col lg:flex-row">
      <nav
        aria-label={titulo}
        className="print:hidden shrink-0 lg:w-52 lg:sticky lg:top-0 lg:self-start lg:h-screen lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-200 bg-crema px-2 py-3"
      >
        <h2 className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-dorado-osc">{titulo}</h2>
        <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {opciones.map((o) => (
            <li key={o.href} className="shrink-0">
              <Link
                href={o.href}
                aria-current={activa(o.href) ? "page" : undefined}
                className={`block rounded px-3 py-1.5 text-xs whitespace-nowrap lg:whitespace-normal border-l-4 ${
                  activa(o.href)
                    ? "border-verde bg-white font-semibold text-verde"
                    : "border-transparent text-gray-700 hover:bg-white/70"
                }`}
              >
                {o.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
