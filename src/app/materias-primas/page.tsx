import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorMateriasPrimas from "@/components/GestorMateriasPrimas";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { ProveedorDeItem } from "@/components/ProveedoresDelItem";

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

  // Proveedor preferente de cada insumo: el que define su costo.
  const { data: pref } = await supabase.rpc("preferentes_costos");
  const preferentes: Record<number, { proveedor: string; costo: number }> = {};
  for (const x of (pref ?? []) as { id_materia_prima: number | null; proveedor: string; costo: number | null }[]) {
    if (x.id_materia_prima != null && x.costo != null)
      preferentes[Number(x.id_materia_prima)] = { proveedor: x.proveedor, costo: Number(x.costo) };
  }

  // Los proveedores de cada insumo, para elegir el preferente con un check en la ficha.
  const { data: provItems } = await supabase
    .from("proveedor_items")
    .select("id, id_proveedor, id_materia_prima, costo, moneda, activo, es_preferente, entidades(razon_social)")
    .not("id_materia_prima", "is", null)
    .order("id");
  const proveedoresDe: Record<number, ProveedorDeItem[]> = {};
  for (const x of provItems ?? []) {
    const pr = Array.isArray(x.entidades) ? x.entidades[0] : x.entidades;
    const k = Number(x.id_materia_prima);
    (proveedoresDe[k] ??= []).push({
      id: Number(x.id),
      id_proveedor: Number(x.id_proveedor),
      proveedor: (pr as { razon_social?: string } | null)?.razon_social ?? "",
      costo: Number(x.costo),
      moneda: (x.moneda as string | null) ?? null,
      activo: Boolean(x.activo),
      preferente: Boolean(x.es_preferente),
    });
  }

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
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorMateriasPrimas
          materias={materias ?? []}
          etiquetas={de("Etiqueta").length ? de("Etiqueta") : etiquetas}
          familias={de("Familia")}
          unidades={de("Unidad")}
          tipos={tipos ?? []}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
          preferentes={preferentes}
          proveedoresDe={proveedoresDe}
        />
      </div>
    </div>
  );
}
