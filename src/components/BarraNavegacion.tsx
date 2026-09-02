"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Navegacion comun a todas las pantallas: volver a la anterior y volver al menu.
// "Volver" usa el historial del navegador, que es lo que espera el usuario; si
// se entro directo por URL (historial vacio) cae al destino indicado.
export default function BarraNavegacion({
  volverA = "/",
  children,
}: {
  volverA?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  function atras() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(volverA);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        onClick={atras}
        className="border border-verde text-verde text-xs px-2.5 py-1 rounded hover:bg-white"
      >
        ← Volver
      </button>
      <Link
        href="/"
        className="border border-verde text-verde text-xs px-2.5 py-1 rounded hover:bg-white"
      >
        Menu principal
      </Link>
      {children && <div className="ml-auto flex gap-2">{children}</div>}
    </div>
  );
}
