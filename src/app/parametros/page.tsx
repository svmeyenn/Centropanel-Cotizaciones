import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorParametros from "@/components/GestorParametros";
import PestanasPais from "@/components/PestanasPais";
import { contextoMercado, paisAdministrado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string }>;
}) {
  const v = await requerirVendedor();
  // Incluye MargenObjetivo: solo administrador.
  if (v.rol !== "Administrador") redirect("/");

  // Cada mercado tiene su empresa, su banco, su impuesto y su margen.
  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, (await searchParams).pais);
  if (!pais) redirect("/");

  const supabase = await createClient();
  const { data: parametros } = await supabase
    .from("parametros")
    .select("*")
    .eq("id_pais", pais.id)
    .order("clave");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Parametros del sistema"
        subtitulo={`Margen, impuesto, rendimiento del adhesivo y datos de la empresa en ${pais.nombre}`}
      />
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasPais
          paises={ctx.activo ? [] : ctx.accesibles}
          elegido={pais}
          ruta="/parametros"
        />
        <GestorParametros key={pais.id} idPais={pais.id} parametros={parametros ?? []} />
      </div>
    </div>
  );
}
