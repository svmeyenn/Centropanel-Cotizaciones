"use client";

import { useState, useTransition } from "react";
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
}

// Reemplaza los marcadores de las plantillas guardadas en parametros. Son los
// mismos que usaba modCotizacion.bas en Access.
function aplicar(plantilla: string, d: DatosEnvio): string {
  const nombre = primerNombre(d.contacto) || primerNombre(d.cliente);
  return plantilla
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

  const asunto = aplicar(datos.asunto, datos);
  const cuerpo = aplicar(datos.cuerpo, datos);
  const mensajeWA = aplicar(datos.mensajeWhatsApp, datos);
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
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded p-3">
            <strong>Adjunte el PDF a mano.</strong> Ni el correo ni WhatsApp
            permiten adjuntar un archivo desde un enlace, asi que descargue el PDF
            con el boton de abajo y adjuntelo en la ventana que se abre. El texto
            ya va escrito.
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/cotizaciones/${datos.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-verde text-verde text-sm font-semibold px-3 py-1.5 rounded"
            >
              1. Abrir PDF para guardarlo
            </a>
            <a
              href={mailto}
              onClick={marcarEnviada}
              className={`text-sm font-semibold px-3 py-1.5 rounded ${
                datos.emailCliente
                  ? "bg-verde text-white"
                  : "bg-gray-200 text-gray-400 pointer-events-none"
              }`}
            >
              2. Enviar por correo
            </a>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              onClick={marcarEnviada}
              className="bg-[#25D366] text-white text-sm font-semibold px-3 py-1.5 rounded"
            >
              2. Enviar por WhatsApp
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
                    className="text-xs text-verde underline"
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
                    className="text-xs text-verde underline"
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
                    className="text-xs text-verde underline"
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
