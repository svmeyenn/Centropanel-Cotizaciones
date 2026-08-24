import EnConstruccion from "@/components/EnConstruccion";
import { requerirVendedor } from "@/lib/sesion";

export default async function Pagina() {
  await requerirVendedor();
  return (
    <EnConstruccion titulo="Formas de pago" subtitulo="Catalogo estandar que se ofrece en las cotizaciones" />
  );
}
