"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarEnvioLead } from "@/app/leads/mensaje";
import { cerrarProgramado } from "@/app/leads/programados";
import { urlArchivoLead } from "@/app/leads/edicion-lead";
import { aBase64, estadoAyudante, outlookCancelar, whatsappAbrir, type AdjuntoB64, type EstadoAyudante } from "@/lib/ayudante";
import { normalizarFono } from "@/lib/mensajes";
import { useTurnoWhatsapp } from "@/lib/turnoWhatsapp";

export type Programado = {
  id: number;
  id_clientify: number;
  // El lead, cuando la lista es de varios.
  nombre?: string;
  // 51 para Peru, 56 para Chile: para completar un telefono sin codigo de pais.
  prefijo?: string;
  canal: "email" | "whatsapp";
  programado_para: string;
  destino: string;
  asunto: string | null;
  cuerpo: string;
  plantilla: string | null;
  ids_cotizacion: number[];
  ids_archivo: number[];
  nombres_adjuntos: string[];
  estado: "Programado" | "En bandeja de salida";
};

const cuandoLegible = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });

// "hace 25 min", "en 3 h", "hace 2 d": cuanto falta o cuanto se paso de la hora.
function relativo(iso: string, ahora: number): string {
  const min = Math.round((new Date(iso).getTime() - ahora) / 60000);
  const m = Math.abs(min);
  const t = m < 60 ? `${m} min` : m < 60 * 48 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  return min <= 0 ? `hace ${t}` : `en ${t}`;
}

// Los mensajes dejados para despues. El correo ya esta en la bandeja de salida de Outlook y sale
// solo; el WhatsApp espera aqui, y con un clic se abre el chat del contacto con todo listo.
export default function MensajesProgramados({
  items,
  titulo,
  mostrarLead,
  ahoraInicial,
}: {
  items: Programado[];
  titulo: string;
  mostrarLead: boolean;
  // La hora del servidor al armar la pagina: asi lo vencido se pinta igual en el servidor y en el navegador.
  ahoraInicial?: string;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [ayudante, setAyudante] = useState<EstadoAyudante | null | undefined>(undefined);
  const { espera, esperarTurno, cancelar: cancelarEspera } = useTurnoWhatsapp(setAviso);
  const conAyudante = Boolean(ayudante?.pareado);
  // Reloj: cada medio minuto se vuelve a separar lo que ya cumplio su hora de lo que aun no.
  const [ahora, setAhora] = useState(() => (ahoraInicial ? new Date(ahoraInicial).getTime() : Date.now()));
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    let vigente = true;
    estadoAyudante().then((e) => vigente && setAyudante(e));
    return () => {
      vigente = false;
    };
  }, []);

  // Los archivos del mensaje, en el orden en que se guardaron: primero los PDF de las cotizaciones.
  const traerAdjuntos = useCallback(async (p: Programado): Promise<AdjuntoB64[]> => {
    const salida: AdjuntoB64[] = [];
    for (let i = 0; i < p.ids_cotizacion.length; i++) {
      const r = await fetch(`/cotizaciones/${p.ids_cotizacion[i]}/pdf/archivo`);
      if (!r.ok) throw new Error("No se pudo generar el PDF de una cotizacion.");
      salida.push({ nombre: p.nombres_adjuntos[i] ?? `Cotizacion-${p.ids_cotizacion[i]}.pdf`, base64: await aBase64(await r.blob()) });
    }
    for (let i = 0; i < p.ids_archivo.length; i++) {
      const u = await urlArchivoLead(p.ids_archivo[i]);
      if (!u.url) throw new Error(u.error ?? "No se pudo abrir un archivo del lead.");
      const r = await fetch(u.url);
      if (!r.ok) throw new Error("No se pudo traer un archivo del lead.");
      salida.push({ nombre: p.nombres_adjuntos[p.ids_cotizacion.length + i] ?? `archivo-${p.ids_archivo[i]}`, base64: await aBase64(await r.blob()) });
    }
    return salida;
  }, []);

  async function abrirChat(p: Programado) {
    setAviso(null);
    const fono = normalizarFono(p.destino, p.prefijo ?? "56");
    if (!fono) return setAviso({ ok: false, texto: "El numero no es valido." });
    // La ventana se abre al pulsar: despues de una espera el navegador ya no la dejaria abrir.
    const ventana = conAyudante ? null : window.open("about:blank", "_blank");
    setOcupado(p.id);
    try {
      if (!(await esperarTurno())) return void ventana?.close();
      const adjuntos = await traerAdjuntos(p);
      if (conAyudante) {
        const r = await whatsappAbrir({ telefono: fono, texto: p.cuerpo, adjuntos });
        if (!r.ok) return setAviso({ ok: false, texto: r.motivo ?? "El ayudante no pudo abrir WhatsApp." });
      } else {
        const url = `https://wa.me/${fono}?text=${encodeURIComponent(p.cuerpo)}`;
        if (ventana) ventana.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
      }
      // Ahora si sale: queda anotado en el lead, con su seguimiento, y deja de estar pendiente.
      const nCot = p.ids_cotizacion.length;
      const folios = p.nombres_adjuntos.slice(0, nCot).map((n) => n.replace(/\.pdf$/i, ""));
      const archivos = p.nombres_adjuntos.slice(nCot);
      const r = await registrarEnvioLead(p.id_clientify, "whatsapp", p.plantilla ?? "Mensaje libre", p.destino, folios, p.ids_cotizacion, "", p.cuerpo, archivos, null, null);
      if (!r.ok) return setAviso({ ok: false, texto: r.mensaje ?? "No se pudo anotar en el lead." });
      await cerrarProgramado(p.id, p.id_clientify, "Enviado");
      setAviso({
        ok: true,
        texto: adjuntos.length > 0
          ? `Se abrio el chat con el mensaje escrito.${conAyudante ? " Los archivos estan copiados: peguelos con Ctrl+V." : " Los archivos adjuntelos a mano: use el lead para bajarlos."} Quedo anotado en el lead.`
          : "Se abrio el chat con el mensaje escrito. Quedo anotado en el lead.",
      });
      router.refresh();
    } catch (e) {
      ventana?.close();
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  // Un correo que ya paso de su hora: Outlook lo mando solo, y aqui se da por enviado.
  async function darPorEnviado(p: Programado) {
    setAviso(null);
    setOcupado(p.id);
    try {
      const r = await cerrarProgramado(p.id, p.id_clientify, "Enviado");
      setAviso({ ok: r.ok, texto: r.ok ? "Quedo como enviado." : (r.mensaje ?? "No se pudo actualizar.") });
      if (r.ok) router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  async function cancelarMensaje(p: Programado) {
    setAviso(null);
    if (!confirm("Cancelar este mensaje programado?")) return;
    setOcupado(p.id);
    try {
      let nota = "";
      if (p.canal === "email") {
        if (conAyudante) {
          const r = await outlookCancelar({ para: p.destino, asunto: p.asunto ?? "" });
          nota = r.ok ? " Se quito de la bandeja de salida de Outlook." : ` No se pudo quitar de Outlook (${r.motivo ?? "sin respuesta"}): borrelo a mano de la bandeja de salida.`;
        } else nota = " Borrelo a mano de la bandeja de salida de Outlook: este computador no tiene el ayudante.";
      }
      const r = await cerrarProgramado(p.id, p.id_clientify, "Cancelado");
      setAviso({ ok: r.ok, texto: r.ok ? `Cancelado.${nota}` : (r.mensaje ?? "No se pudo cancelar.") });
      if (r.ok) router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  if (items.length === 0) return null;

  const vencidos = items.filter((p) => new Date(p.programado_para).getTime() <= ahora);
  const porLlegar = items.filter((p) => new Date(p.programado_para).getTime() > ahora);

  const fila = (p: Programado, vencido: boolean) => (
    <li
      key={p.id}
      className={`flex flex-wrap items-start gap-x-2 gap-y-0.5 px-3 py-1.5 ${vencido ? "bg-amber-50 border-l-4 border-amber-500" : "border-l-4 border-transparent"}`}
    >
      <span className={`shrink-0 text-[9px] font-semibold border rounded px-1 ${p.canal === "email" ? "text-verde border-verde" : "text-[#128C7E] border-[#128C7E]"}`}>
        {p.canal === "email" ? "Correo" : "WhatsApp"}
      </span>
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-semibold break-words">
          {mostrarLead && p.nombre ? (
            <Link href={`/leads/${p.id_clientify}`} className="text-verde underline">
              {p.nombre}
            </Link>
          ) : (
            (p.nombre ?? p.destino)
          )}
          {p.nombre ? <span className="font-normal text-gray-600"> · {p.destino}</span> : null}
          {p.asunto ? <span className="font-normal text-gray-600"> · {p.asunto}</span> : null}
        </p>
        <p className={vencido ? "text-amber-900 font-semibold break-words" : "text-gray-600 break-words"}>
          {vencido ? "Ya es la hora: " : ""}
          {cuandoLegible(p.programado_para)} ({relativo(p.programado_para, ahora)})
          <span className="font-normal text-gray-600">
            {" · "}
            {p.estado}
            {p.nombres_adjuntos.length > 0 ? ` · ${p.nombres_adjuntos.length} adjunto${p.nombres_adjuntos.length > 1 ? "s" : ""}` : ""}
          </span>
        </p>
        {vencido && p.canal === "email" && (
          <p className="text-[10px] text-amber-900">Outlook debio mandarlo a esa hora. Si no salio, estaba cerrado: revise la bandeja de salida.</p>
        )}
        <p className="text-gray-500 line-clamp-2 break-words">{p.cuerpo}</p>
      </div>
      <span className="shrink-0 flex gap-1">
        {p.canal === "whatsapp" && (
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => abrirChat(p)}
            className={`rounded px-2 py-0.5 font-semibold disabled:opacity-50 ${vencido ? "bg-[#25D366] text-white" : "border border-[#25D366] text-[#128C7E]"}`}
            title={vencido ? "Ya es la hora" : "Todavia no es la hora: se puede enviar antes"}
          >
            {ocupado === p.id ? "Abriendo…" : "Abrir chat"}
          </button>
        )}
        {p.canal === "email" && vencido && (
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => darPorEnviado(p)}
            className="rounded px-2 py-0.5 font-semibold bg-verde text-white disabled:opacity-50"
          >
            Ya salio
          </button>
        )}
        <button
          type="button"
          disabled={ocupado !== null}
          onClick={() => cancelarMensaje(p)}
          className="rounded px-2 py-0.5 font-semibold border border-gray-300 text-gray-700 disabled:opacity-50"
        >
          Cancelar
        </button>
      </span>
    </li>
  );

  return (
    <section aria-label={titulo} className="bg-white border border-gray-200 rounded overflow-hidden text-[11px]">
      <div className={`${vencidos.length > 0 ? "bg-amber-600" : "bg-verde"} text-white px-3 py-1.5 flex flex-wrap items-baseline justify-between gap-2`}>
        <h2 className="text-[11px] font-semibold uppercase">
          {titulo} · {items.length}
        </h2>
        <span className="text-[10px]">
          {vencidos.length > 0 ? `${vencidos.length} ya cumpli${vencidos.length === 1 ? "o" : "eron"} su hora` : "Ninguno ha cumplido su hora todavia"}
        </span>
      </div>
      {espera != null && (
        <p className="px-3 py-1 flex flex-wrap items-center gap-2 text-amber-800 font-semibold" role="status" aria-live="polite">
          <span>Sale en {espera} s</span>
          <button type="button" onClick={cancelarEspera} className="underline font-normal">
            Cancelar envio
          </button>
        </p>
      )}
      {aviso && (
        <p className={`px-3 py-1 ${aviso.ok ? "text-green-700" : "text-red-700"}`} role={aviso.ok ? "status" : "alert"}>
          {aviso.texto}
        </p>
      )}
      <div className="max-h-96 overflow-y-auto">
        {vencidos.length > 0 && (
          <>
            <h3 className="sticky top-0 z-[1] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-900">
              Ya cumplieron su hora · {vencidos.length}
            </h3>
            <ul className="divide-y divide-amber-100">{vencidos.map((p) => fila(p, true))}</ul>
          </>
        )}
        {porLlegar.length > 0 && (
          <>
            <h3 className="sticky top-0 z-[1] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide bg-crema text-dorado-osc">
              Aun no llega su hora · {porLlegar.length}
            </h3>
            <ul className="divide-y divide-gray-100">{porLlegar.map((p) => fila(p, false))}</ul>
          </>
        )}
      </div>
    </section>
  );
}
