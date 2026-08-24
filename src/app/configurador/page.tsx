import EnConstruccion from "@/components/EnConstruccion";
import { requerirVendedor } from "@/lib/sesion";

export default async function Pagina() {
  await requerirVendedor();
  return (
    <EnConstruccion titulo="Configurador de paneles SIP" subtitulo="Elija la plancha EPS y las placas" />
  );
}
