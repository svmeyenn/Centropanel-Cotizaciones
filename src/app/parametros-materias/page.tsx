import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasPais from "@/components/PestanasPais";
import GestorParametrosMaterias, {
  type TipoMateriaVista,
  type ValorLista,
} from "@/components/GestorParametrosMaterias";
import {
  contextoMercado,
  paisAdministrado,
  requerirVendedor,
  tienePerfilAdmin,
} from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

// Listas con que se clasifican las materias primas. Etiqueta, familia y
// unidad son por mercado; el tipo es comun, porque define si el insumo sirve
// de nucleo o de cara del panel.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string }>;
}) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) redirect("/");

  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, (await searchParams).pais);
  if (!pais) redirect("/");

  const supabase = await createClient();
  const [{ data: valores }, { data: tipos }, { data: materias }] = await Promise.all([
    supabase
      .from("parametros_materia")
      .select("clase, nombre")
      .eq("id_pais", pais.id)
      .order("clase")
      .order("nombre"),
    supabase
      .from("tipos_materia")
      .select("id, nombre, es_nucleo, es_cara, orden, activo")
      .order("orden"),
    supabase
      .from("materias_primas")
      .select("tipo, familia, etiqueta, unidad")
      .eq("id_pais", pais.id),
  ]);

  // Cuantas materias primas usan cada valor: es lo que decide si se puede
  // eliminar y ahorra ir a buscarlo a mano.
  const cuenta = (campo: "tipo" | "familia" | "etiqueta" | "unidad", valor: string) =>
    (materias ?? []).filter((m) => (m[campo] ?? "") === valor).length;

  const lista: ValorLista[] = (valores ?? []).map((x) => ({
    clase: x.clase as string,
    nombre: x.nombre as string,
    usos: cuenta(
      x.clase === "Etiqueta" ? "etiqueta" : x.clase === "Familia" ? "familia" : "unidad",
      x.nombre as string
    ),
  }));

  const tiposVista: TipoMateriaVista[] = (tipos ?? []).map((t) => ({
    id: Number(t.id),
    nombre: t.nombre as string,
    es_nucleo: Boolean(t.es_nucleo),
    es_cara: Boolean(t.es_cara),
    orden: Number(t.orden ?? 0),
    activo: Boolean(t.activo),
    usos: cuenta("tipo", t.nombre as string),
  }));

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Parametros de materias primas"
        subtitulo={`Tipo, etiqueta, familia y unidad con que se clasifican los insumos de ${pais.nombre}`}
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasPais
          paises={ctx.activo ? [] : ctx.accesibles}
          elegido={pais}
          ruta="/parametros-materias"
        />
        <GestorParametrosMaterias
          idPais={pais.id}
          valores={lista}
          tipos={tiposVista}
        />
      </div>
    </div>
  );
}
