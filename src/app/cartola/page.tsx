import { redirect } from "next/navigation";
import EnConstruccion from "@/components/EnConstruccion";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Se abre con el permiso Ver cartola.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/cartola")) redirect("/");

  return <EnConstruccion titulo="CARTOLA CONSOLIDADA" subtitulo="El movimiento de todas las cuentas en una sola linea" />;
}
