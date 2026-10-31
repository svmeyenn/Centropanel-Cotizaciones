import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import DatosCargaTabla, { type FilaCarga } from "@/components/transportes/DatosCargaTabla";
import { puedeVerRuta } from "@/lib/menu";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Peso y dimensiones" };
export const dynamic = "force-dynamic";

const n = (x: unknown) => (x == null ? null : Number(x));

export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/datos-carga")) redirect("/");
  const supabase = await createClient();
  const { idPaisActivo } = await contextoMercado(v);

  const [{ data: prods }, { data: mats }, { data: calc }] = await Promise.all([
    conPais(supabase.from("productos").select("id, descripcion, familia, tipo, ancho_mm, largo_mm, alto_mm, peso_kg, activo").eq("activo", true), idPaisActivo).order("familia").order("descripcion").limit(2000),
    conPais(supabase.from("materias_primas").select("id, nombre, familia, ancho_mm, largo_mm, espesor_mm, peso_kg, densidad_kg_m3, activo").eq("activo", true), idPaisActivo).order("familia").order("nombre").limit(2000),
    supabase.rpc("logistica_catalogo"),
  ]);
  type Calc = { clase: string; id: number; peso_kg: number | null; origen: string };
  const calculado = new Map<string, Calc>(((calc ?? []) as Calc[]).map((c) => [`${c.clase}-${c.id}`, c]));

  const filas: FilaCarga[] = [
    ...(prods ?? []).map((p) => {
      const c = calculado.get(`producto-${p.id}`);
      return {
        clase: "producto" as const, id: Number(p.id), nombre: p.descripcion as string, familia: (p.familia as string) ?? "Sin familia",
        ancho: n(p.ancho_mm), largo: n(p.largo_mm), alto: n(p.alto_mm), peso: n(p.peso_kg), densidad: null,
        pesoEfectivo: n(c?.peso_kg), origen: (c?.origen as string) ?? "falta",
      };
    }),
    ...(mats ?? []).map((m) => {
      const c = calculado.get(`materia-${m.id}`);
      return {
        clase: "materia" as const, id: Number(m.id), nombre: m.nombre as string, familia: (m.familia as string) ?? "Sin familia",
        ancho: n(m.ancho_mm), largo: n(m.largo_mm), alto: n(m.espesor_mm), peso: n(m.peso_kg), densidad: n(m.densidad_kg_m3),
        pesoEfectivo: n(c?.peso_kg), origen: (c?.origen as string) ?? "falta",
      };
    }),
  ];

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Peso y dimensiones" subtitulo="Los datos de carga de productos y materias primas, para calcular el viaje" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <DatosCargaTabla filas={filas} puedeEditar={v.puede_editar || tienePerfilAdmin(v)} />
      </div>
    </div>
  );
}
