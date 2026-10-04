import Link from "next/link";
import { alternar, conParametro, type Dir, type Orden } from "@/lib/ordenTabla";

// El titulo de una columna que se puede pinchar para ordenar. Es un enlace, no
// un boton: funciona sin javascript, se puede abrir en otra pestaña y el orden
// queda en la direccion. La flecha dice por donde se esta ordenando y
// aria-sort lo dice igual a quien usa un lector de pantalla.
export default function TituloOrden({
  qs,
  param,
  campo,
  actual,
  inicial = "desc",
  alineacion = "left",
  ancho,
  titulo,
  children,
}: {
  qs: string;
  param: string;
  campo: string;
  actual: Orden;
  // Por donde empieza la primera vez que se pincha.
  inicial?: Dir;
  alineacion?: "left" | "right" | "center";
  ancho?: string;
  // Aclaracion al pasar el cursor, cuando el titulo no alcanza a explicarse.
  titulo?: string;
  children: React.ReactNode;
}) {
  const activa = actual.campo === campo;
  const siguiente = alternar(actual, campo, inicial);
  const clase = alineacion === "right" ? "text-right" : alineacion === "center" ? "text-center" : "text-left";

  return (
    <th
      scope="col"
      className={`${clase} px-2.5 py-1.5 ${ancho ?? ""}`}
      aria-sort={activa ? (actual.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={conParametro(qs, param, `${siguiente.campo}:${siguiente.dir}`)}
        scroll={false}
        title={titulo ?? (typeof children === "string" ? `Ordenar por ${children.toLowerCase()}` : "Ordenar por esta columna")}
        className={`inline-flex items-center gap-0.5 hover:text-verde ${activa ? "text-verde font-semibold" : ""}`}
      >
        {children}
        <span aria-hidden className={activa ? "" : "opacity-25"}>
          {activa ? (actual.dir === "asc" ? "▴" : "▾") : "▾"}
        </span>
      </Link>
    </th>
  );
}

// La misma idea para los cuadros que no son tablas: una barra de botones con
// los datos por los que se puede ordenar. Las fichas de leads se leen mejor en
// dos lineas que en seis columnas, asi que no se convierten en tabla.
export function BarraOrden({
  qs,
  param,
  actual,
  opciones,
}: {
  qs: string;
  param: string;
  actual: Orden;
  opciones: { campo: string; texto: string; inicial?: Dir }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-600">
      <span>Ordenar por</span>
      {opciones.map((o) => {
        const activa = actual.campo === o.campo;
        const siguiente = alternar(actual, o.campo, o.inicial ?? "desc");
        return (
          <Link
            key={o.campo}
            href={conParametro(qs, param, `${siguiente.campo}:${siguiente.dir}`)}
            scroll={false}
            aria-current={activa ? "true" : undefined}
            className={`rounded border px-1.5 py-0.5 ${
              activa ? "border-verde bg-verde text-white font-semibold" : "border-gray-300 hover:border-verde"
            }`}
          >
            {o.texto}
            {activa && <span aria-hidden> {actual.dir === "asc" ? "▴" : "▾"}</span>}
          </Link>
        );
      })}
    </div>
  );
}
