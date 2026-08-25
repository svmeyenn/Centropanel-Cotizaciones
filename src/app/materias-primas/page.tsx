import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import GestorMateriasPrimas from "@/components/GestorMateriasPrimas";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  // Pantalla de administracion: contiene los costos de cada insumo. El RLS ya
  // lo impide a nivel de datos, pero se corta antes para no mostrar una tabla
  // vacia sin explicacion.
  if (v.rol !== "Administrador") redirect("/");

  const supabase = await createClient();
  const { data: materias } = await supabase
    .from("materias_primas")
    .select("*")
    .order("tipo")
    .order("nombre");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Materias primas"
        subtitulo="Insumos y sus costos netos; de aqui sale el costo de cada panel"
      />
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex justify-end">
          <Link
            href="/"
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded"
          >
            Menu
          </Link>
        </div>
        <GestorMateriasPrimas materias={materias ?? []} />
      </div>
    </div>
  );
}
