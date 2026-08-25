import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import GestorFormasPago from "@/components/GestorFormasPago";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { data: formas } = await supabase
    .from("formas_pago")
    .select("*")
    .order("orden");

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Formas de pago"
        subtitulo="Catalogo estandar que se ofrece en las cotizaciones"
      />
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex justify-end">
          <Link
            href="/"
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded"
          >
            Menu
          </Link>
        </div>
        <GestorFormasPago
          formas={formas ?? []}
          esAdmin={v.rol === "Administrador"}
        />
      </div>
    </div>
  );
}
