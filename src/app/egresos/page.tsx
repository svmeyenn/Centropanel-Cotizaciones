import { redirect } from "next/navigation";
import EnConstruccion from "@/components/EnConstruccion";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Pagos a proveedores y gastos. Se abre con el permiso Ver egresos.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/egresos")) redirect("/");

  return <EnConstruccion titulo="EGRESOS" subtitulo="Lo que se paga y lo que esta pendiente de pago" />;
}
