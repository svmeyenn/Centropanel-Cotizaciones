import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelAyudante from "@/components/PanelAyudante";
import { contactosConfigurado } from "@/lib/contactosGoogle";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const v = await requerirVendedor();
  const listo = contactosConfigurado();
  return (
    <div className="min-h-screen">
      <Cabecera titulo="Ayudante de Outlook y WhatsApp" subtitulo="Correos programados en Outlook, chat de WhatsApp con los archivos listos y contactos en el telefono" />
      <div className="max-w-screen-xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PanelAyudante emailRemitente={v.email ?? ""} />

        <section className="bg-white border border-gray-200 rounded p-4 space-y-2 text-sm max-w-3xl">
          <h2 className="font-semibold text-verde">Contactos en el telefono</h2>
          {listo ? (
            <p className="text-green-700 font-semibold">
              Activo: al mandarle un WhatsApp a un lead, su contacto se guarda en Contactos de Google de {v.email ?? "su cuenta"}, con la etiqueta &quot;Leads Centropanel&quot;. Si el telefono tiene esa cuenta de Google sincronizada, WhatsApp lo muestra con su nombre.
            </p>
          ) : (
            <>
              <p className="text-amber-700 font-semibold">
                Falta activarlo: el administrador de Google Workspace debe autorizar el permiso de contactos (una sola vez para todos).
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-gray-700">
                <li>
                  En Google Cloud, en el proyecto de la empresa, active la API <strong>People API</strong> y cree una <strong>cuenta de servicio</strong> con una clave JSON.
                </li>
                <li>
                  En la consola de administracion de Google Workspace: Seguridad, Controles de API, <strong>Delegacion de todo el dominio</strong>, Agregar. Use el ID de cliente de esa cuenta de servicio y el permiso{" "}
                  <code className="bg-gray-100 px-1">https://www.googleapis.com/auth/contacts</code>.
                </li>
                <li>
                  En Vercel, agregue las variables <code className="bg-gray-100 px-1">GOOGLE_SA_EMAIL</code> (el correo de la cuenta de servicio) y <code className="bg-gray-100 px-1">GOOGLE_SA_KEY</code> (la clave privada del JSON) y vuelva a desplegar.
                </li>
              </ol>
              <p className="text-gray-600">Mientras no se active, el WhatsApp se envia y se anota igual; solo falta guardar el contacto.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
