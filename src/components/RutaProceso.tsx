import Link from "next/link";
import { PROCESOS, type UbicacionProceso } from "@/lib/procesos";

// La linea del proceso en la cabecera: todas las etapas en horizontal, las ya recorridas con su marca y su enlace, la
// etapa donde se esta parado destacada en dorado, y las que siguen en trazo hueco.
export default function RutaProceso({ proceso }: { proceso: UbicacionProceso }) {
  const def = PROCESOS[proceso.tipo];
  const actual = Math.max(0, def.etapas.findIndex((e) => e.clave === proceso.etapa));

  return (
    <nav aria-label={def.nombre} className="bg-crema border-b border-gray-200 print:hidden">
      <ol className="flex items-center gap-0 px-4 py-1.5 overflow-x-auto whitespace-nowrap text-[11px] leading-none">
        {def.etapas.map((e, i) => {
          const estado = i < actual ? "antes" : i === actual ? "actual" : "despues";
          const enlace = proceso.enlaces?.[e.clave];
          const contenido = (
            <>
              <span
                aria-hidden="true"
                className={`ruta-nodo ruta-${estado} grid place-items-center shrink-0 rounded-full ${estado === "actual" ? "h-5 w-5" : "h-4 w-4"}`}
              >
                {estado === "antes" && (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.4 5 8.8l4.5-5" />
                  </svg>
                )}
                {estado === "actual" && <span className="h-1.5 w-1.5 rounded-full bg-verde" />}
              </span>
              <span className={estado === "actual" ? "font-bold text-negro" : estado === "antes" ? "font-semibold text-verde" : "text-gray-500"}>{e.etiqueta}</span>
              {enlace?.ref && <span className={`tabular-nums ${estado === "actual" ? "text-dorado-osc" : "text-gray-500"}`}>{enlace.ref}</span>}
            </>
          );
          const caja = `flex items-center gap-1.5 rounded-full px-2 py-1 ${estado === "actual" ? "bg-dorado/25 ring-1 ring-dorado" : ""}`;
          return (
            <li key={e.clave} className="flex items-center" aria-current={estado === "actual" ? "step" : undefined}>
              {i > 0 && <span aria-hidden="true" className={`ruta-tramo ${i <= actual ? "ruta-tramo-hecho" : "ruta-tramo-falta"}`} />}
              {enlace?.href && estado !== "actual" ? (
                <Link href={enlace.href} className={`${caja} hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-dorado`} title={`Ir a ${e.etiqueta.toLowerCase()}`}>
                  {contenido}
                </Link>
              ) : (
                <span className={caja}>{contenido}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
