"use client";

import { useEffect, useState, useTransition } from "react";
import { pesos, fecha as fmtFecha, primerNombre } from "@/lib/formato";
import { cambiarEstado } from "@/app/cotizaciones/acciones";

export interface DatosEnvio {
  id: number;
  num: string;
  total: number;
  vence: string;
  cliente: string;
  contacto: string | null;
  emailCliente: string | null;
  telefonoCliente: string | null;
  vendedor: string;
  cargoVendedor: string | null;
  emailVendedor: string | null;
  telefonoVendedor: string | null;
  asunto: string;
  cuerpo: string;
  mensajeWhatsApp: string;
  estado: string;
  // Token del enlace publico: con el, el cliente abre y descarga la cotizacion
  // sin cuenta. Es lo que reemplaza al adjunto, que los enlaces no soportan.
  token: string;
}

// Reemplaza los marcadores de las plantillas guardadas en parametros. Son los
// mismos que usaba modCotizacion.bas en Access.
function aplicar(plantilla: string, d: DatosEnvio, enlace: string): string {
  const nombre = primerNombre(d.contacto) || primerNombre(d.cliente);
  return plantilla
    .replace(/\{ENLACE\}/g, enlace)
    .replace(/\{NUM\}/g, d.num)
    .replace(/\{NOMBRE\}/g, nombre)
    .replace(/\{CLIENTE\}/g, d.cliente)
    .replace(/\{VENDEDOR\}/g, d.vendedor)
    .replace(/\{CARGOVENDEDOR\}/g, d.cargoVendedor ?? "Ejecutivo Comercial")
    .replace(/\{EMAILVENDEDOR\}/g, d.emailVendedor ?? "")
    .replace(/\{FONOVENDEDOR\}/g, d.telefonoVendedor ?? "")
    .replace(/\{TOTAL\}/g, `$${pesos(d.total)}`)
    .replace(/\{CADUCA\}/g, fmtFecha(d.vence))
    // En la plantilla el salto de linea viene como "|" (Access no guardaba
    // saltos reales en el parametro).
    .replace(/\|/g, "\n");
}

// Deja solo digitos y antepone 56 si el numero viene en formato local. wa.me
// exige el numero sin +, sin espacios y con codigo de pais.
function normalizarFono(fono: string | null): string | null {
  if (!fono) return null;
  let n = fono.replace(/\D/g, "");
  if (!n) return null;
  if (n.startsWith("56")) return n;
  if (n.startsWith("9") && n.length === 9) return "56" + n;
  if (n.length === 8) return "569" + n;
  return n;
}

export default function EnvioCotizacion({ datos }: { datos: DatosEnvio }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, empezar] = useTransition();
  const [estado, setEstado] = useState(datos.estado);

  // El origen solo se conoce en el navegador; en el primer render queda vacio
  // para no provocar un desajuste de hidratacion.
  const [origen, setOrigen] = useState("");
  useEffect(() => setOrigen(window.location.origin), []);
  const enlace = origen ? `${origen}/c/${datos.token}` : "";

  // Si la plantilla no trae {ENLACE}, el enlace se agrega al final: asi el
  // cliente siempre recibe como llegar al documento, sin tener que editar las
  // plantillas guardadas en parametros.
  function conEnlace(texto: string, plantilla: string): string {
    if (plantilla.includes("{ENLACE}") || !enlace) return texto;
    return `${texto}\n\nVer y descargar la cotizacion:\n${enlace}`;
  }

  const asunto = aplicar(datos.asunto, datos, enlace);
  const cuerpo = conEnlace(aplicar(datos.cuerpo, datos, enlace), datos.cuerpo);
  const mensajeWA = conEnlace(
    aplicar(datos.mensajeWhatsApp, datos, enlace),
    datos.mensajeWhatsApp
  );
  const fono = normalizarFono(datos.telefonoCliente);

  // Al enviar, la cotizacion pasa a Enviada. Aceptada y Rechazada no se pisan:
  // son estados manuales, misma regla que en Access.
  function marcarEnviada() {
    if (estado === "Aceptada" || estado === "Rechazada") return;
    empezar(async () => {
      const r = await cambiarEstado(datos.id, "Enviada");
      if (!r?.error) setEstado("Enviada");
    });
  }

  const mailto = `mailto:${encodeURIComponent(
    datos.emailCliente ?? ""
  )}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

  const wa = fono
    ? `https://wa.me/${fono}?text=${encodeURIComponent(mensajeWA)}`
    : `https://wa.me/?text=${encodeURIComponent(mensajeWA)}`;

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /* si el navegador lo bloquea, el usuario copia del cuadro a mano */
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-verde">
          Enviar al cliente
          {estado === "Enviada" && (
            <span className="ml-2 text-xs font-normal text-green-700">
              (ya enviada)
            </span>
          )}
        </span>
        <span className="text-gray-400 text-sm">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
          <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded p-3 space-y-1">
            <div>
              El mensaje lleva un <strong>enlace a la cotizacion</strong>: el
              cliente la abre y la descarga en PDF sin necesidad de cuenta.
            </div>
            <div className="text-blue-800/80">
              Va por enlace y no como archivo adjunto porque ni el correo ni
              WhatsApp permiten adjuntar desde un boton web. Si necesita mandarlo
              como archivo, use &quot;Abrir el PDF&quot;, guardelo y adjuntelo a
              mano en la ventana que se abre.
            </div>
          </div>

          {enlace && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-dorado-osc font-semibold">Enlace:</span>
              <code className="bg-gray-50 border border-gray-200 rounded px-2 py-1 break-all">
                {enlace}
              </code>
              <button
                onClick={() => copiar(enlace)}
                className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
              >
                copiar
              </button>
              <a
                href={enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="text-verde underline"
              >
                probar
              </a>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={mailto}
              onClick={marcarEnviada}
              className={`text-sm font-semibold px-3 py-1.5 rounded ${
                datos.emailCliente
                  ? "bg-verde text-white"
                  : "bg-gray-200 text-gray-400 pointer-events-none"
              }`}
            >
              Enviar por correo
            </a>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              onClick={marcarEnviada}
              className="bg-[#25D366] text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Enviar por WhatsApp
            </a>
            <a
              href={`/cotizaciones/${datos.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Abrir el PDF
            </a>
            {pendiente && (
              <span className="text-xs text-gray-500 self-center">
                actualizando estado...
              </span>
            )}
          </div>

          {!datos.emailCliente && (
            <p className="text-xs text-amber-700">
              Este cliente no tiene correo registrado: agreguelo en Clientes para
              habilitar el envio por correo.
            </p>
          )}
          {!fono && (
            <p className="text-xs text-amber-700">
              Sin telefono registrado: WhatsApp se abrira para que elija el
              contacto a mano.
            </p>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 text-xs">
              Ver y copiar los textos
            </summary>
            <div className="mt-2 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-dorado-osc">
                    Asunto del correo
                  </span>
                  <button
                    onClick={() => copiar(asunto)}
                    className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                  >
                    copiar
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                  {asunto}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-dorado-osc">
                    Cuerpo del correo
                  </span>
                  <button
                    onClick={() => copiar(cuerpo)}
                    className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                  >
                    copiar
                  </button>
                </div>
                <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-xs whitespace-pre-wrap font-sans">
                  {cuerpo}
                </pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-dorado-osc">
                    Mensaje de WhatsApp
                  </span>
                  <button
                    onClick={() => copiar(mensajeWA)}
                    className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                  >
                    copiar
                  </button>
                </div>
                <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-xs whitespace-pre-wrap font-sans">
                  {mensajeWA}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
