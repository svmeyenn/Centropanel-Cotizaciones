import { redirect } from "next/navigation";
import EnConstruccion from "@/components/EnConstruccion";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// La abre quien rinde sus gastos y quien los paga.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/rendiciones")) redirect("/");

  return <EnConstruccion titulo="RENDICIONES DE GASTOS" subtitulo="Anticipos, boletas y reintegros de cada persona" />;
}
