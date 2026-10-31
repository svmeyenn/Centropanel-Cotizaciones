import Link from "next/link";

const PESTANAS = [
  ["/transportistas", "Transportistas"],
  ["/transportistas/cotizar", "Cotizar flete"],
  ["/transportistas/reporte", "Reporte de fletes"],
] as const;

// Las tres pantallas del transporte, a mano desde cualquiera de ellas.
export default function PestanasTransportes({ activa }: { activa: (typeof PESTANAS)[number][0] }) {
  return (
    <nav aria-label="Transporte" className="flex flex-wrap gap-2 text-sm">
      {PESTANAS.map(([href, texto]) => (
        <Link
          key={href}
          href={href}
          aria-current={href === activa ? "page" : undefined}
          className={`bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ${href === activa ? "ring-2 ring-dorado ring-offset-1" : "opacity-70"}`}
        >
          {texto}
        </Link>
      ))}
    </nav>
  );
}
