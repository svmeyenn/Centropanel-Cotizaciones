import EnConstruccion from "@/components/EnConstruccion";
import { requerirVendedor } from "@/lib/sesion";

export default async function Pagina() {
  await requerirVendedor();
  return (
    <EnConstruccion titulo="Vendedores y accesos" subtitulo="Perfil de cada vendedor y lo que puede hacer" />
  );
}
