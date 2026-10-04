import Link from "next/link";

// Las dos caras del inicio: lo que hay que hacer (gestion) y como va el negocio
// (desempeno). Son pestanas con direccion propia: se pueden recargar y
// compartir sin perder donde se estaba.
export default function PestanasInicio({
  vista,
  quien,
  mes,
}: {
  vista: "gestion" | "desempeno";
  quien?: string;
  mes?: string;
}) {
  const pestanas = [
    {
      clave: "gestion" as const,
      texto: "Mi gestion",
      ayuda: "Lo comprometido, lo que espera y lo que viene",
      href: `/${quien ? `?quien=${encodeURIComponent(quien)}` : ""}`,
    },
    {
      clave: "desempeno" as const,
      texto: "Desempeno",
      ayuda: "Ventas, leads y cumplimiento del mes",
      href: `/?vista=desempeno${mes ? `&mes=${encodeURIComponent(mes)}` : ""}`,
    },
  ];
  return (
    <nav aria-label="Vistas del inicio" className="flex gap-1 border-b border-gray-300">
      {pestanas.map((p) => {
        const activa = p.clave === vista;
        return (
          <Link
            key={p.clave}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={`-mb-px px-3 py-1.5 text-xs rounded-t border focus-visible:outline focus-visible:outline-2 focus-visible:outline-verde ${
              activa
                ? "bg-white border-gray-300 border-b-white font-semibold text-verde"
                : "border-transparent text-gray-600 hover:text-verde hover:bg-white/60"
            }`}
          >
            {p.texto}
            <span className="hidden md:inline text-[10px] font-normal text-gray-500"> · {p.ayuda}</span>
          </Link>
        );
      })}
    </nav>
  );
}
