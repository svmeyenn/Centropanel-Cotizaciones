"use client";

// Un lead o una cotizacion que sigue vivo --no esta cerrado, ganado ni clasificado como
// basura-- siempre debe tener una tarea de seguimiento. Estos avisos lo recuerdan: no bloquean.

// El aviso fijo de la ficha: aparece mientras el lead o la cotizacion no tenga ninguna tarea pendiente.
export function BannerSinTarea({
  sujeto,
  estado,
  ancla,
  puedeAgregar,
}: {
  sujeto: "lead" | "cotizacion";
  // El estado en que esta, ya en palabras.
  estado: string;
  // El formulario donde se anota la tarea.
  ancla: string;
  puedeAgregar: boolean;
}) {
  return (
    <div className="bg-amber-50 border border-amber-400 text-amber-900 rounded px-3 py-2 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1" role="alert">
      <span>
        <strong>Sin tarea de seguimiento:</strong> {sujeto === "lead" ? "este lead" : "esta cotizacion"} esta en «{estado}» y no tiene ninguna tarea pendiente. Mientras siga vivo,
        siempre debe tener una.
      </span>
      {puedeAgregar && (
        <a href={`#${ancla}`} className="font-semibold underline whitespace-nowrap">
          Agregar una tarea
        </a>
      )}
    </div>
  );
}

// La consulta que se abre al registrar algo que deja al lead o a la cotizacion sin tarea.
export function PanelSinTarea({
  texto,
  acciones,
  className = "",
}: {
  texto: React.ReactNode;
  acciones: { texto: string; onClick: () => void; principal?: boolean }[];
  className?: string;
}) {
  return (
    <div className={`bg-amber-50 border border-amber-400 text-amber-900 rounded px-3 py-2 text-[11px] space-y-1.5 ${className}`} role="alertdialog" aria-label="Falta una tarea de seguimiento">
      <p>{texto}</p>
      <div className="flex flex-wrap gap-2">
        {acciones.map((a) => (
          <button
            key={a.texto}
            type="button"
            onClick={a.onClick}
            className={
              a.principal
                ? "bg-verde text-white text-[11px] font-semibold px-2.5 py-0.5 rounded"
                : "border border-gray-300 text-gray-800 text-[11px] font-semibold px-2.5 py-0.5 rounded bg-white"
            }
          >
            {a.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
