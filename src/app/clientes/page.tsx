import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import GestorClientes from "@/components/GestorClientes";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("razon_social");

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Clientes" subtitulo="Ficha del cliente y listado completo" />
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex justify-end">
          <Link
            href="/"
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded"
          >
            Menu
          </Link>
        </div>
        <GestorClientes
          clientes={clientes ?? []}
          puedeEditar={v.puede_editar || v.rol === "Administrador"}
        />
      </div>
    </div>
  );
}
