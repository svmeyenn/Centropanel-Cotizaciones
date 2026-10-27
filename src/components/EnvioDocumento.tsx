"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import { normalizarFono } from "@/components/EnvioCotizacion";
import { aBase64, estadoAyudante, whatsappAbrir, type EstadoAyudante } from "@/lib/ayudante";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";

// Envia al proveedor la solicitud de cotizacion o la orden de compra, con el PDF: por correo --sale de la casilla de
// quien esta conectado, con el archivo adjunto-- o por WhatsApp --el ayudante abre el chat con el archivo listo; sin
// ayudante, se abre el chat con el texto y se baja el PDF para adjuntarlo--. Lo que se envia queda anotado.
export default function EnvioDocumento({
  etiqueta,
  titulo,
  proveedor,
  prefijoTelefono,
  pdfUrl,
  nombreArchivo,
  asunto: asuntoInicial,
  cuerpo: cuerpoInicial,
  textoWhatsApp,
  bloqueo,
  enviarCorreo,
  registrarWhatsApp,
}: {
  etiqueta: string;
  titulo: string;
  proveedor: { nombre: string; email: string | null; telefono: string | null };
  prefijoTelefono: string;
  pdfUrl: string;
  nombreArchivo: string;
  asunto: string;
  cuerpo: string;
  textoWhatsApp: string;
  // Motivo por el que aun no se puede enviar (por ejemplo, orden sin aprobar).
  bloqueo?: string | null;
  enviarCorreo: (asunto: string, texto: string) => Promise<{ ok: true; para: string } | { ok: false; error: string }>;
  registrarWhatsApp: (destino: string, texto: string) => Promise<void>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [asunto, setAsunto] = useState(asuntoInicial);
  const [cuerpo, setCuerpo] = useState(cuerpoInicial);
  const [wa, setWa] = useState(textoWhatsApp);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<"correo" | "wa" | null>(null);
  const [ayudante, setAyudante] = useState<EstadoAyudante | null | undefined>(undefined);
  const fono = normalizarFono(proveedor.telefono, prefijoTelefono);
  const conAyudante = Boolean(ayudante?.pareado && ayudante.whatsapp);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    estadoAyudante().then((e) => vigente && setAyudante(e));
    return () => {
      vigente = false;
    };
  }, [abierto]);

  async function porCorreo() {
    setOcupado("correo");
    setAviso(null);
    const r = await enviarCorreo(asunto, cuerpo);
    setOcupado(null);
    if (!r.ok) return setAviso({ ok: false, texto: r.error });
    setAviso({ ok: true, texto: `Enviado a ${r.para} con el PDF adjunto.` });
    router.refresh();
  }

  async function porWhatsApp() {
    setOcupado("wa");
    setAviso(null);
    try {
      if (conAyudante && fono) {
        const blob = await (await fetch(pdfUrl)).blob();
        const r = await whatsappAbrir({ telefono: fono, texto: wa, adjuntos: [{ nombre: nombreArchivo, base64: await aBase64(blob) }] });
        if (!r.ok) {
          setOcupado(null);
          return setAviso({ ok: false, texto: r.motivo ?? "El ayudante no pudo abrir WhatsApp." });
        }
        setAviso({ ok: true, texto: "Se abrio el chat con el PDF adjunto y el mensaje: revise y envie desde WhatsApp." });
      } else {
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.open(`https://wa.me/${fono ?? ""}?text=${encodeURIComponent(wa)}`, "_blank", "noopener,noreferrer");
        setAviso({ ok: true, texto: "Se abrio WhatsApp con el mensaje y se bajo el PDF: adjuntelo en el chat y envie desde WhatsApp." });
      }
      await registrarWhatsApp(proveedor.telefono ?? "", wa);
      router.refresh();
    } catch {
      setAviso({ ok: false, texto: "No se pudo preparar el PDF." });
    }
    setOcupado(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={Boolean(bloqueo)}
        title={bloqueo ?? undefined}
        className="bg-verde text-white text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40"
      >
        {etiqueta}
      </button>
      {abierto && (
        <Ventana titulo={titulo} subtitulo={`Para ${proveedor.nombre}`} onCerrar={() => setAbierto(false)} ancho="max-w-2xl">
          <div className="space-y-3 text-xs">
            <p>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-verde underline font-semibold">
                Ver el PDF ({nombreArchivo})
              </a>
            </p>
            <div>
              <label htmlFor="env-asunto" className={ROTULO}>Asunto del correo {proveedor.email ? `(a ${proveedor.email})` : ""}</label>
              <input id="env-asunto" className={CAMPO} value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label htmlFor="env-cuerpo" className={ROTULO}>Mensaje del correo</label>
              <textarea id="env-cuerpo" rows={7} className={CAMPO} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={porCorreo} disabled={!proveedor.email || ocupado !== null} className="bg-verde text-white font-semibold px-3 py-1.5 rounded disabled:opacity-40">
                {ocupado === "correo" ? "Enviando..." : "Enviar por correo con el PDF"}
              </button>
              {!proveedor.email && <span className="text-amber-700">El proveedor no tiene correo: agreguelo en su ficha.</span>}
            </div>
            <hr className="border-gray-200" />
            <div>
              <label htmlFor="env-wa" className={ROTULO}>Mensaje de WhatsApp {proveedor.telefono ? `(a ${proveedor.telefono})` : ""}</label>
              <textarea id="env-wa" rows={4} className={CAMPO} value={wa} onChange={(e) => setWa(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={porWhatsApp} disabled={ocupado !== null} className="bg-[#25D366] text-white font-semibold px-3 py-1.5 rounded disabled:opacity-40">
                {ocupado === "wa" ? "Preparando..." : conAyudante && fono ? "Abrir WhatsApp con el PDF" : "Abrir WhatsApp y bajar el PDF"}
              </button>
              {!fono && <span className="text-amber-700">Sin telefono registrado: se abrira WhatsApp para elegir el contacto.</span>}
              {ayudante === null && <span className="text-gray-500">Sin el ayudante, el PDF se baja para adjuntarlo a mano (<a href="/ayudante" target="_blank" rel="noreferrer" className="underline">instalar</a>).</span>}
            </div>
            <p className="text-gray-500">El WhatsApp no se envia solo: queda a la vista para que lo revise y lo envie usted.</p>
            {aviso && (
              <p className={`rounded px-3 py-2 border ${aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`} role="status">
                {aviso.texto}
              </p>
            )}
          </div>
        </Ventana>
      )}
    </>
  );
}
