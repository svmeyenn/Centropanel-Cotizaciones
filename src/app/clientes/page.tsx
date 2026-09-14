import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorClientes from "@/components/GestorClientes";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo } = await contextoMercado(v);
  const { data: clientes } = await conPais(
    supabase.from("clientes").select("*"),
    idPaisActivo
  ).order("razon_social");

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Clientes" subtitulo="Ficha del cliente y listado completo" />
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorClientes
          clientes={clientes ?? []}
          puedeEditar={v.puede_editar || v.rol === "Administrador"}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
        />
      </div>
    </div>
  );
}
