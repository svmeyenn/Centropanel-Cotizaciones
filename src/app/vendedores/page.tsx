import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorVendedores from "@/components/GestorVendedores";
import { requerirVendedor } from "@/lib/sesion";
import { esSuperAdmin } from "@/lib/permisos";
import type { PerfilAcceso } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") redirect("/");

  const supabase = await createClient();
  const { data: vendedores } = await supabase
    .from("vendedores")
    .select("*")
    .order("nombre");

  const { data: perfiles } = await supabase.from("perfiles").select("*").order("orden");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Vendedores y accesos"
        subtitulo="Perfil de cada vendedor y lo que puede hacer"
      />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorVendedores
          vendedores={vendedores ?? []}
          miId={v.id}
          perfiles={(perfiles ?? []) as PerfilAcceso[]}
          soySuper={esSuperAdmin(v)}
        />
      </div>
    </div>
  );
}
