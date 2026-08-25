import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import GestorParametros from "@/components/GestorParametros";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  // Incluye MargenObjetivo: solo administrador.
  if (v.rol !== "Administrador") redirect("/");

  const supabase = await createClient();
  const { data: parametros } = await supabase
    .from("parametros")
    .select("*")
    .order("clave");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Parametros del sistema"
        subtitulo="Margen, IVA, rendimiento del adhesivo y datos de la empresa"
      />
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex justify-end">
          <Link
            href="/"
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded"
          >
            Menu
          </Link>
        </div>
        <GestorParametros parametros={parametros ?? []} />
      </div>
    </div>
  );
}
