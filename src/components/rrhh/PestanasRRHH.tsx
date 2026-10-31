import Link from "next/link";

const PESTANAS = [
  ["/rrhh", "Personal", "ver"],
  ["/rrhh/liquidaciones", "Liquidaciones y honorarios", "ver"],
  ["/rrhh/planilla", "Planilla previsional", "ver"],
  ["/rrhh/parametros", "Parametros", "administrar"],
] as const;

// Las pantallas de Recursos humanos, a mano desde cualquiera de ellas. Los parametros solo los ve quien administra.
export default function PestanasRRHH({ activa, administra }: { activa: (typeof PESTANAS)[number][0]; administra: boolean }) {
  return (
    <nav aria-label="Recursos humanos" className="flex flex-wrap gap-2 text-sm">
      {PESTANAS.filter(([, , n]) => n === "ver" || administra).map(([href, texto]) => (
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
