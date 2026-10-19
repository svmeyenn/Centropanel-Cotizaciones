"use client";

import { useEffect, useState } from "react";
import { estadoAyudante, guardarClave, leerClave, type EstadoAyudante } from "@/lib/ayudante";

const BOTON = "bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-50";

export default function PanelAyudante({ emailRemitente }: { emailRemitente: string }) {
  const [estado, setEstado] = useState<EstadoAyudante | null | undefined>(undefined);
  const [clave, setClave] = useState("");
  const [guardada, setGuardada] = useState(false);

  async function revisar() {
    setEstado(await estadoAyudante());
  }

  useEffect(() => {
    setClave(leerClave());
    setGuardada(Boolean(leerClave()));
    revisar();
    const reloj = setInterval(revisar, 4000);
    return () => clearInterval(reloj);
  }, []);

  function emparejar() {
    guardarClave(clave);
    setGuardada(Boolean(clave.trim()));
    revisar();
  }

  const tieneCuenta = estado?.cuentas?.some((c) => c.toLowerCase() === emailRemitente.toLowerCase());

  return (
    <div className="space-y-4 max-w-3xl">
      <section className="bg-white border border-gray-200 rounded p-4 space-y-2">
        <h2 className="font-semibold text-verde">Estado en este computador</h2>
        {estado === undefined && <p className="text-sm text-gray-500">Revisando…</p>}
        {estado === null && (
          <p className="text-sm text-amber-700">
            <strong>No instalado.</strong> Siga los pasos de abajo. Si ya lo instalo, cierre sesion en Windows y vuelva a entrar, o ejecute el instalador de nuevo.
          </p>
        )}
        {estado && !estado.pareado && (
          <p className="text-sm text-amber-700">
            <strong>Instalado, falta emparejarlo.</strong> Pegue abajo la clave que mostro el instalador.
          </p>
        )}
        {estado?.pareado && (
          <ul className="text-sm space-y-1">
            <li className="text-green-700 font-semibold">Conectado y emparejado (version {estado.version}).</li>
            <li>
              Outlook de escritorio: <strong>{estado.outlook ? "disponible" : "no encontrado"}</strong>
            </li>
            <li>
              Correo remitente <strong>{emailRemitente}</strong>:{" "}
              {tieneCuenta ? (
                <strong className="text-green-700">cuenta encontrada en Outlook</strong>
              ) : (
                <strong className="text-red-700">
                  no esta en Outlook. Cuentas que tiene: {(estado.cuentas ?? []).join(", ") || "ninguna"}. Agreguela en Outlook.
                </strong>
              )}
            </li>
            <li>
              WhatsApp de escritorio: <strong>{estado.whatsapp ? "instalado" : "no instalado (se usara WhatsApp Web)"}</strong>
            </li>
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded p-4 space-y-2">
        <h2 className="font-semibold text-verde">Emparejar</h2>
        <p className="text-sm text-gray-600">
          La clave la genera el instalador en cada computador y evita que otra pagina web le de ordenes al ayudante. Se pega una sola vez en cada navegador.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            aria-label="Clave de emparejamiento"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Pegue aqui la clave"
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-80 font-mono"
          />
          <button type="button" onClick={emparejar} className={BOTON}>
            {guardada ? "Cambiar clave" : "Emparejar"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-verde">Instalacion (una vez por computador, sin permisos de administrador)</h2>
        <ol className="list-decimal pl-5 space-y-1 text-gray-700">
          <li>
            Descargue{" "}
            <a href="/ayudante/Instalar-Ayudante-Centropanel.cmd" download className="text-verde font-semibold underline">
              Instalar-Ayudante-Centropanel.cmd
            </a>{" "}
            y abralo con doble clic. Si Windows avisa que es de un editor desconocido, elija &quot;Mas informacion&quot; y &quot;Ejecutar de todas formas&quot;.
          </li>
          <li>La ventana negra muestra la clave de emparejamiento y la deja copiada. Pulse una tecla para cerrarla.</li>
          <li>Vuelva a esta pagina, pegue la clave y pulse Emparejar. Debe decir &quot;Conectado y emparejado&quot;.</li>
        </ol>
        <p className="text-gray-600">
          Se inicia solo cada vez que entra a Windows. Para quitarlo: abra{" "}
          <a href="/ayudante/Desinstalar-Ayudante-Centropanel.cmd" download className="underline">
            Desinstalar-Ayudante-Centropanel.cmd
          </a>
          .
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded p-4 space-y-1 text-sm text-gray-700">
        <h2 className="font-semibold text-verde">Que hace y que no</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Correo:</strong> el mensaje queda en la bandeja de salida de Outlook, desde su cuenta de Centropanel, con la hora de entrega elegida. Outlook debe estar abierto a esa hora para enviarlo. Sin fecha, se abre el correo para revisarlo.
          </li>
          <li>
            <strong>WhatsApp:</strong> se abre el chat del contacto con el mensaje escrito y los archivos copiados: se pegan con Ctrl+V y se envia. WhatsApp no deja adjuntar archivos de forma automatica sin su API de pago.
          </li>
          <li>Solo atiende a este sistema y a quien lo emparejo. No envia nada por su cuenta.</li>
        </ul>
      </section>
    </div>
  );
}
