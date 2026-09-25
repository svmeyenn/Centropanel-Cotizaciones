import { redirect } from "next/navigation";
import EnConstruccion from "@/components/EnConstruccion";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Se abre con el permiso Ver informes.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/resumen-proyecto")) redirect("/");

  return <EnConstruccion titulo="RESUMEN POR PROYECTO" subtitulo="Ingresos, egresos y resultado de cada obra" />;
}
