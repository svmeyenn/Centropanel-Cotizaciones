import Link from "next/link";

// Filtros de los listados de cotizaciones y pedidos. Es un formulario que
// navega con querystring --sin javascript-- para que el filtro quede en la
// direccion: se puede guardar en favoritos, compartir y volver atras.
export interface ValoresFiltro {
  q?: string;
  desde?: string;
  hasta?: string;
  rut?: string;
  razon?: string;
  contacto?: string;
  estado?: string;
}

export default function FiltrosDocumentos({
  base,
  etiquetaFolio,
  etiquetaId,
  estados,
  valores,
  hayFiltro,
  extra,
}: {
  base: string;
  etiquetaFolio: string;
  // RUT en Chile, RUC en Peru; viendo los dos mercados juntos, "RUT / RUC".
  etiquetaId: string;
  estados: string[];
  valores: ValoresFiltro;
  hayFiltro: boolean;
  // Acciones que acompanan a los filtros, como bajar a Excel lo filtrado.
  extra?: React.ReactNode;
}) {
  const campo =
    "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";

  return (
    <form
      className="bg-white border border-gray-200 rounded p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      action={base}
    >
      <Campo rotulo={etiquetaFolio}>
        <input name="q" defaultValue={valores.q ?? ""} className={campo} />
      </Campo>
      <Campo rotulo="Desde">
        <input
          type="date"
          name="desde"
          defaultValue={valores.desde ?? ""}
          className={campo}
        />
      </Campo>
      <Campo rotulo="Hasta">
        <input
          type="date"
          name="hasta"
          defaultValue={valores.hasta ?? ""}
          className={campo}
        />
      </Campo>
      <Campo rotulo={etiquetaId}>
        <input name="rut" defaultValue={valores.rut ?? ""} className={campo} />
      </Campo>
      <Campo rotulo="Razon social">
        <input
          name="razon"
          defaultValue={valores.razon ?? ""}
          className={campo}
        />
      </Campo>
      <Campo rotulo="Nombre del contacto">
        <input
          name="contacto"
          defaultValue={valores.contacto ?? ""}
          className={campo}
        />
      </Campo>
      <Campo rotulo="Estado">
        <select name="estado" defaultValue={valores.estado ?? ""} className={campo}>
          <option value="">Todos</option>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </Campo>
      <div className="flex items-end gap-2">
        <button className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded">
          Filtrar
        </button>
        {hayFiltro && (
          <Link
            href={base}
            className="text-xs text-gray-600 underline self-center pb-1.5"
          >
            limpiar
          </Link>
        )}
        {extra}
      </div>
    </form>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs">
      <span className="block text-dorado-osc font-semibold mb-0.5">{rotulo}</span>
      {children}
    </label>
  );
}
