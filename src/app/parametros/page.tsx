import EnConstruccion from "@/components/EnConstruccion";
import { requerirVendedor } from "@/lib/sesion";

export default async function Pagina() {
  await requerirVendedor();
  return (
    <EnConstruccion titulo="Parametros del sistema" subtitulo="Margen, IVA, rendimiento del adhesivo, datos de la empresa" />
  );
}
