import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorMateriasPrimas from "@/components/GestorMateriasPrimas";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  // Pantalla de administracion: contiene los costos de cada insumo. El RLS ya
  // lo impide a nivel de datos, pero se corta antes para no mostrar una tabla
  // vacia sin explicacion.
  if (!tienePerfilAdmin(v)) redirect("/");

  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo } = await contextoMercado(v);
  const { data: materias } = await conPais(
    supabase.from("materias_primas").select("*"),
    idPaisActivo
  )
    .order("tipo")
    .order("nombre");

  // Etiquetas ya en uso, para sugerirlas al dar de alta: la etiqueta es la que
  // despues aparece en el nombre de cada panel, asi que dos variantes de la
  // misma dejarian nombres incoherentes.
  const etiquetas = [
    ...new Set(
      (materias ?? []).map((m) => (m.etiqueta as string | null) ?? "").filter(Boolean)
    ),
  ].sort();

  // Listas configurables del mercado activo. Si se mira "Todos" se juntan las
  // de los mercados visibles.
  const { data: listas } = await conPais(
    supabase.from("parametros_materia").select("clase, nombre"),
    idPaisActivo
  ).order("nombre");
  const de = (clase: string) => [
    ...new Set(
      (listas ?? []).filter((x) => x.clase === clase).map((x) => x.nombre as string)
    ),
  ].sort();

  const { data: tipos } = await supabase
    .from("tipos_materia")
    .select("id, nombre, es_nucleo, es_cara, orden, activo")
    .eq("activo", true)
    .order("orden");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Materias primas"
        subtitulo="Insumos y sus costos netos; de aqui sale el costo de cada panel"
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorMateriasPrimas
          materias={materias ?? []}
          etiquetas={de("Etiqueta").length ? de("Etiqueta") : etiquetas}
          familias={de("Familia")}
          unidades={de("Unidad")}
          tipos={tipos ?? []}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
        />
      </div>
    </div>
  );
}
