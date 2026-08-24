import Link from "next/link";
import Cabecera from "@/components/Cabecera";

// Placeholder de las fases 3/4 del plan de migracion: el esqueleto (fase 2)
// deja el menu completo navegable aunque la pantalla todavia no este hecha,
// para que el primer deploy no tenga enlaces rotos.
export default function EnConstruccion({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="min-h-screen">
      <Cabecera titulo={titulo} subtitulo={subtitulo} />
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border border-gray-200 rounded p-6 text-center">
          <p className="text-gray-600 text-sm mb-4">
            Esta pantalla se construye en la siguiente etapa del proyecto.
          </p>
          <Link href="/" className="text-verde font-semibold text-sm underline">
            Volver al menu
          </Link>
        </div>
      </div>
    </div>
  );
}
