import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorClientes from "@/components/GestorClientes";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("razon_social");
  const { paises, esAdminGeneral } = await contextoMercado(v);

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
