import EnConstruccion from "@/components/EnConstruccion";
import { requerirVendedor } from "@/lib/sesion";

export default async function Pagina() {
  await requerirVendedor();
  return (
    <EnConstruccion titulo="Catalogo de productos" subtitulo="Paneles ya configurados, con su costo y precio" />
  );
}
