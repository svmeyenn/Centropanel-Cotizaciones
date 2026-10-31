import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelPerfiles from "@/components/PanelPerfiles";
import { requerirVendedor } from "@/lib/sesion";
import { esSuperAdmin } from "@/lib/permisos";
import { puedeVerRuta } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import type { PerfilAcceso } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/perfiles")) redirect("/");

  const supabase = await createClient();
  const [perfiles, topes, paises, personas, excepciones] = await Promise.all([
    supabase.from("perfiles").select("*").order("orden"),
    supabase.from("perfil_topes").select("id_perfil, id_pais, tope"),
    supabase.from("paises").select("id, nombre, moneda_base").eq("opera", true).eq("activo", true).order("orden"),
    supabase.from("vendedores").select("id, nombre, id_perfil, activo").eq("activo", true).order("nombre"),
    supabase
      .from("excepciones_segregacion")
      .select("id, en, regla, id_mov, monto, detalle, vendedores(nombre)")
      .order("en", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="min-h-screen vista-fin">
      <Cabecera
        titulo="Perfiles y permisos"
        subtitulo="Quien puede hacer que, hasta cuanto aprueba y que excepciones se han usado"
      />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelPerfiles
          perfiles={(perfiles.data ?? []) as PerfilAcceso[]}
          topes={(topes.data ?? []) as { id_perfil: number; id_pais: number; tope: number | null }[]}
          paises={(paises.data ?? []) as { id: number; nombre: string; moneda_base: string }[]}
          personas={(personas.data ?? []) as { id: number; nombre: string; id_perfil: number | null }[]}
          excepciones={
            (excepciones.data ?? []) as unknown as {
              id: number;
              en: string;
              regla: string;
              id_mov: number | null;
              monto: number | null;
              detalle: string | null;
              vendedores: { nombre: string } | null;
            }[]
          }
          puedeEditar={esSuperAdmin(v)}
        />
      </div>
    </div>
  );
}
