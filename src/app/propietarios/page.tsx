import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorPropietarios, { type PersonaFila } from "@/components/GestorPropietarios";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Propietarios de leads" };
export const dynamic = "force-dynamic";

// Las personas a las que se les puede asignar un lead, cada una con su unico correo. Al cargar o cambiar un
// lead, la base corrige el nombre segun el correo: asi Clientify no puede volver a mezclar a dos personas.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/propietarios")) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.rpc("propietarios_listado");
  const personas: PersonaFila[] = ((data ?? []) as { email: string; nombre: string; leads: number }[]).map((p) => ({
    email: p.email,
    nombre: p.nombre,
    leads: Number(p.leads),
  }));

  return (
    <div className="min-h-screen">
      <Cabecera titulo="PROPIETARIOS DE LEADS" subtitulo="Cada persona con su unico correo" />
      <div className="max-w-[120rem] mx-auto p-4 space-y-3">
        <BarraNavegacion />
        <p className="bg-white border border-gray-200 rounded px-3 py-2 text-[12px] text-gray-700">
          Un correo es una persona y un nombre es una persona. Al agregar a alguien, los leads que ya traen su correo quedan con su nombre y los que
          traen solo su nombre, con su correo. Para que un lead le pueda llegar a una persona nueva, primero hay que agregarla aqui.
        </p>
        <GestorPropietarios personas={personas} />
      </div>
    </div>
  );
}
