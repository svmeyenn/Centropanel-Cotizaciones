import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorTransportistas from "@/components/transportes/GestorTransportistas";
import { puedeVerRuta } from "@/lib/menu";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Transportistas" };
export const dynamic = "force-dynamic";

// Las empresas de transporte que trabajan para Centro Panel: quienes son, con que vehiculos
// y a que tarifa. Son proveedores con una marca mas, asi que tambien estan en la maestra de proveedores.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/transportistas")) redirect("/");

  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo } = await contextoMercado(v);
  const [{ data: transp }, { data: proveedores }, { data: vehiculos }, { data: tarifas }, { data: extra }] = await Promise.all([
    conPais(
      supabase.from("entidades").select("*, entidad_tipos!inner(tipo)").eq("entidad_tipos.tipo", "transportista"),
      idPaisActivo
    ).order("razon_social"),
    conPais(
      supabase.from("entidades").select("id_entidad, razon_social, entidad_tipos!inner(tipo)").eq("entidad_tipos.tipo", "proveedor").eq("activo", true),
      idPaisActivo
    ).order("razon_social"),
    supabase.from("transporte_vehiculos").select("id_entidad, activo"),
    supabase.from("transporte_tarifas").select("id_entidad, activa"),
    supabase.from("transportistas").select("id_entidad, cobertura"),
  ]);

  const cuenta = (filas: { id_entidad: number; activo?: boolean; activa?: boolean }[] | null) => {
    const m = new Map<number, number>();
    for (const f of filas ?? []) if (f.activo ?? f.activa) m.set(Number(f.id_entidad), (m.get(Number(f.id_entidad)) ?? 0) + 1);
    return m;
  };
  const nVeh = cuenta(vehiculos);
  const nTar = cuenta(tarifas);
  const cobertura = new Map((extra ?? []).map((e) => [Number(e.id_entidad), e.cobertura as string | null]));
  const yaSon = new Set((transp ?? []).map((t) => Number(t.id_entidad)));

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Transportistas" subtitulo="Empresas de transporte, sus vehiculos y sus tarifas" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorTransportistas
          filas={(transp ?? []).map((t) => ({
            id: Number(t.id_entidad),
            razon_social: t.razon_social as string,
            rut: t.rut as string | null,
            contacto: t.contacto as string | null,
            telefono: t.telefono as string | null,
            email: t.email as string | null,
            id_pais: t.id_pais as number | null,
            activo: Boolean(t.activo),
            cobertura: cobertura.get(Number(t.id_entidad)) ?? null,
            vehiculos: nVeh.get(Number(t.id_entidad)) ?? 0,
            tarifas: nTar.get(Number(t.id_entidad)) ?? 0,
          }))}
          proveedores={(proveedores ?? [])
            .filter((p) => !yaSon.has(Number(p.id_entidad)))
            .map((p) => ({ id: Number(p.id_entidad), razon_social: p.razon_social as string }))}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
          puedeEditar={v.puede_editar || tienePerfilAdmin(v)}
        />
      </div>
    </div>
  );
}
