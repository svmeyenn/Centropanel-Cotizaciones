import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorMateriasPrimas from "@/components/GestorMateriasPrimas";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
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

  // Etiquetas ya en uso, para sugerirlas al dar de alta: la etiqueta es la que
  // despues aparece en el nombre de cada panel, asi que dos variantes de la
  // misma dejarian nombres incoherentes.
  const etiquetas = [
    ...new Set(
      (materias ?? []).map((m) => (m.etiqueta as string | null) ?? "").filter(Boolean)
    ),
  ].sort();

  const { paises, esAdminGeneral } = await contextoMercado(v);
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
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorMateriasPrimas
          materias={materias ?? []}
          etiquetas={etiquetas}
          tipos={tipos ?? []}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
        />
      </div>
    </div>
  );
}
