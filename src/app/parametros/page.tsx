import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
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
        <BarraNavegacion />
        <GestorParametros parametros={parametros ?? []} />
      </div>
    </div>
  );
}
