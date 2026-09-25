import { redirect } from "next/navigation";
import EnConstruccion from "@/components/EnConstruccion";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Se abre con el permiso Mantenedores.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/mantenedores")) redirect("/");

  return <EnConstruccion titulo="CUENTAS, PROYECTOS Y CATEGORIAS" subtitulo="Las listas con que se clasifica cada movimiento" />;
}
