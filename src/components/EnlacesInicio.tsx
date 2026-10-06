import Link from "next/link";

// Atajos a las dos caras del inicio desde una ficha: lo que hay que hacer hoy
// --Mi gestion-- y como va el negocio --Desempeno--.
export default function EnlacesInicio() {
  const clase = "bg-dorado-osc text-white text-xs font-semibold px-2.5 py-1 rounded";
  return (
    <nav aria-label="Ir al inicio" className="flex flex-wrap gap-2">
      <Link href="/?vista=gestion" className={clase}>
        Mi gestion
      </Link>
      <Link href="/" className={clase}>
        Desempeno
      </Link>
    </nav>
  );
}
