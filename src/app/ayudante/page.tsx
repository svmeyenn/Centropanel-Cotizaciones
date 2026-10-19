import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelAyudante from "@/components/PanelAyudante";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const v = await requerirVendedor();
  return (
    <div className="min-h-screen">
      <Cabecera titulo="Ayudante de Outlook y WhatsApp" subtitulo="Correos programados en Outlook y chat de WhatsApp con los archivos listos" />
      <div className="max-w-screen-xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelAyudante emailRemitente={v.email ?? ""} />
      </div>
    </div>
  );
}
