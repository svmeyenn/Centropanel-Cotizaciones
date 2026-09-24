import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasPais from "@/components/PestanasPais";
import GestorFamilias, { type FamiliaVista } from "@/components/GestorFamilias";
import {
  contextoMercado,
  paisAdministrado,
  requerirVendedor,
  tienePerfilAdmin,
} from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

// Panel de familias y subfamilias del catalogo. Cada mercado tiene el suyo,
// porque cada uno tiene su propio catalogo de productos.
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
  const [{ data: familias }, { data: subfamilias }, { data: productos }] =
    await Promise.all([
      supabase
        .from("familias")
        .select("nombre, grupo")
        .eq("id_pais", pais.id)
        .order("nombre"),
      supabase
        .from("subfamilias")
        .select("familia, nombre")
        .eq("id_pais", pais.id)
        .order("nombre"),
      supabase
        .from("productos")
        .select("id, descripcion, familia, subfamilia")
        .eq("id_pais", pais.id)
        .order("descripcion"),
    ]);

  const vista: FamiliaVista[] = (familias ?? []).map((f) => ({
    nombre: f.nombre as string,
    grupo: f.grupo as string,
    subfamilias: (subfamilias ?? [])
      .filter((s) => s.familia === f.nombre)
      .map((s) => s.nombre as string),
    productos: (productos ?? [])
      .filter((p) => p.familia === f.nombre)
      .map((p) => ({
        id: Number(p.id),
        descripcion: p.descripcion as string,
        subfamilia: (p.subfamilia as string | null) ?? null,
      })),
  }));

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Familias y subfamilias"
        subtitulo={`Clasificacion del catalogo de ${pais.nombre} y descuento al que pertenece cada familia`}
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasPais
          paises={ctx.activo ? [] : ctx.accesibles}
          elegido={pais}
          ruta="/familias"
        />
        <GestorFamilias idPais={pais.id} familias={vista} />
      </div>
    </div>
  );
}
