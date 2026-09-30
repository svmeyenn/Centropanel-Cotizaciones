// Un bloque de la cabecera de un documento: su titulo y los campos que le
// corresponden. Los datos se agrupan por tema --con quien es el negocio, que
// documento es, como se paga, como se entrega-- en vez de ir todos seguidos
// en una sola rejilla, donde habia que leerlos todos para encontrar uno.
//
// La cotizacion y el pedido usan el mismo bloque: son el mismo negocio en dos
// momentos, y no tienen por que leerse distinto.
export default function GrupoCabecera({
  titulo,
  children,
  className,
  columnas = "sm:grid-cols-2",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
  columnas?: string;
}) {
  return (
    <section
      className={`bg-white border border-gray-200 rounded p-3 ${className ?? ""}`}
    >
      <h2 className="text-[10px] font-bold tracking-wide text-dorado-osc mb-2">
        {titulo}
      </h2>
      <div className={`grid gap-3 ${columnas}`}>{children}</div>
    </section>
  );
}
