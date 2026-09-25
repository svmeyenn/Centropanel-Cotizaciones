import { redirect } from "next/navigation";
import EnConstruccion from "@/components/EnConstruccion";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Se abre con el permiso Mantenedores.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/topes")) redirect("/");

  return <EnConstruccion titulo="TOPES DE GASTO" subtitulo="Limites por categoria para las rendiciones" />;
}
