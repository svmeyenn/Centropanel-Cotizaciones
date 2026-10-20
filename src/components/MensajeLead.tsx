"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { armarBorradorOutlook, registrarEnvioLead } from "@/app/leads/mensaje";
import { useTurnoWhatsapp } from "@/lib/turnoWhatsapp";
import { programarMensaje } from "@/app/leads/programados";
import { aBase64, estadoAyudante, outlookCorreo, whatsappAbrir, type AdjuntoB64, type EstadoAyudante } from "@/lib/ayudante";
import { urlArchivoLead } from "@/app/leads/edicion-lead";
import { aplicarPlantilla, normalizarFono, type Canal, type DatosMensaje, type Plantilla } from "@/lib/mensajes";

export type CotizacionAdjuntable = { id: number; folio: string };
// Un archivo subido al lead.
export type ArchivoAdjuntable = { id: number; nombre: string; tamano: number };

const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Aviso = { ok: boolean; texto: string } | null;

const pad = (n: number) => String(n).padStart(2, "0");
// Valor de un campo datetime-local: la hora de este computador.
const paraCampo = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const manana9 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return paraCampo(d);
};
const cuandoLegible = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "full", timeStyle: "short" });

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white";
const ROTULO = "block text-[11px] font-semibold text-dorado-osc mb-0.5";

function descargar(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Escribirle al contacto del lead por correo o WhatsApp. El mensaje sale de una
// plantilla, queda a la vista para revisarlo y editarlo, y solo se manda cuando la
// persona lo envia desde su programa o su telefono. Se adjunta el PDF de las
// cotizaciones elegidas, nunca un enlace.
export default function MensajeLead({
  idLead,
  plantillas,
  emails,
  telefonos,
  prefijoTelefono,
  cotizaciones,
  archivos,
  datos,
  lineaTexto,
}: {
  idLead: number;
  plantillas: Plantilla[];
  emails: string[];
  telefonos: { phone: string; whatsapp?: boolean }[];
  prefijoTelefono: string;
  cotizaciones: CotizacionAdjuntable[];
  // Los archivos que ya estan cargados en el lead.
  archivos: ArchivoAdjuntable[];
  datos: Omit<DatosMensaje, "folios">;
  // La linea del lead: los mensajes son los de esa linea.
  lineaTexto: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [canal, setCanal] = useState<Canal>(emails.length === 0 && telefonos.length > 0 ? "whatsapp" : "email");
  const delCanal = useMemo(() => plantillas.filter((p) => p.canal === canal), [plantillas, canal]);
  const [idPlantilla, setIdPlantilla] = useState<number | null>(null);
  const [destino, setDestino] = useState("");
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [archivosElegidos, setArchivosElegidos] = useState<number[]>([]);
  // Los archivos ya traidos, listos para adjuntar: se preparan al elegirlos, para que el
  // boton de compartir actue dentro del clic, que es lo unico que el navegador deja.
  const preparados = useRef(new Map<string, File>());
  const [listos, setListos] = useState("");
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [editado, setEditado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  // La pausa de 20 segundos entre un WhatsApp y el siguiente.
  const { espera, esperarTurno, cancelar: cancelarEspera } = useTurnoWhatsapp(setAviso);
  const [ocupado, setOcupado] = useState(false);
  const ultimo = useRef({ clave: "", cuando: 0 });
  // Dejarlo programado: el correo queda en la bandeja de salida de Outlook con su hora; el
  // WhatsApp espera su hora en el sistema.
  const [programar, setProgramar] = useState(false);
  const [cuando, setCuando] = useState("");
  // El ayudante del computador: undefined mientras se averigua, null si no esta instalado.
  const [ayudante, setAyudante] = useState<EstadoAyudante | null | undefined>(undefined);
  const conAyudante = Boolean(ayudante?.pareado);
  // Si el lead paso de "no contactado" a "contactado", la base lo dice al registrar.
  const nota = useRef("");

  const folios = cotizaciones.filter((c) => elegidas.includes(c.id)).map((c) => c.folio);
  const nombresArchivos = archivos.filter((a) => archivosElegidos.includes(a.id)).map((a) => a.nombre);
  const claves = [...elegidas.map((i) => `c${i}`), ...archivosElegidos.map((i) => `a${i}`)];
  const clavesTexto = claves.join(",");
  const preparando = claves.length > 0 && listos !== clavesTexto;
  const plantilla = delCanal.find((p) => p.id === idPlantilla) ?? null;

  // Al abrir o cambiar de canal se elige la primera plantilla y el primer contacto.
  useEffect(() => {
    setIdPlantilla(delCanal[0]?.id ?? null);
    setEditado(false);
    setAviso(null);
    if (canal === "email") setDestino(emails[0] ?? "");
    else {
      const t = telefonos.find((x) => x.whatsapp) ?? telefonos[0];
      setDestino(t?.phone ?? "");
    }
  }, [canal, delCanal, emails, telefonos]);

  useEffect(() => {
    let vigente = true;
    estadoAyudante().then((e) => vigente && setAyudante(e));
    return () => {
      vigente = false;
    };
  }, []);

  // Si el navegador sabe compartir archivos --telefono, o Windows con la hoja de compartir--.
  useEffect(() => {
    try {
      const prueba = new File(["x"], "prueba.pdf", { type: "application/pdf" });
      setPuedeCompartir(typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [prueba] }));
    } catch {
      setPuedeCompartir(false);
    }
  }, []);

  // Trae cada archivo elegido apenas se elige.
  useEffect(() => {
    if (claves.length === 0) return;
    let vigente = true;
    Promise.all(claves.map((k) => traer(k)))
      .then(() => vigente && setListos(clavesTexto))
      .catch((e) => vigente && setAviso({ ok: false, texto: (e as Error).message }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavesTexto]);

  // El texto se rehace con la plantilla, los folios y los datos --salvo que la
  // persona ya lo haya editado a mano--.
  useEffect(() => {
    if (editado) return;
    const d: DatosMensaje = { ...datos, folios };
    setAsunto(plantilla?.asunto ? aplicarPlantilla(plantilla.asunto, d) : "");
    setCuerpo(plantilla ? aplicarPlantilla(plantilla.cuerpo, d) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantilla, folios.join("|"), editado]);

  // La fecha elegida para dejarlo programado, ya validada; o el texto del error.
  function fechaProgramada(): { iso: string; dias: number } | string {
    if (!cuando) return "Elija la fecha y la hora.";
    const f = new Date(cuando);
    if (Number.isNaN(f.getTime()) || f.getTime() < Date.now() + 60000) return "La fecha y la hora deben ser futuras.";
    // El seguimiento cuenta desde que sale el mensaje, no desde hoy.
    const dias = Math.ceil((f.getTime() - Date.now()) / 86400000) + (plantilla?.dias_seguimiento ?? 3);
    return { iso: f.toISOString(), dias };
  }

  async function anotar(prog?: { programadoPara: string; dias: number }) {
    // Cada envio queda anotado; solo se ignora el mismo toque repetido a los pocos segundos.
    const clave = `${canal}|${destino}|${asunto}|${cuerpo}|${folios.join(",")}|${nombresArchivos.join(",")}|${prog?.programadoPara ?? ""}`;
    if (ultimo.current.clave === clave && Date.now() - ultimo.current.cuando < 15000) return true;
    const r = await registrarEnvioLead(idLead, canal, plantilla?.nombre ?? "Mensaje libre", destino, folios, elegidas, canal === "email" ? asunto : "", cuerpo, nombresArchivos, prog?.dias ?? plantilla?.dias_seguimiento ?? null, prog?.programadoPara ?? null);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.mensaje ?? "No se pudo anotar en el lead." });
      return false;
    }
    ultimo.current = { clave, cuando: Date.now() };
    nota.current = (r.mensaje ?? "").replace(/^Anotado en el lead, con seguimiento en \d+ dias?\.\s*/, "");
    setAviso({ ok: true, texto: r.mensaje ?? "Anotado en el lead." });
    return true;
  }

  // Un archivo adjuntable --el PDF de una cotizacion ("c12") o un archivo del lead ("a7")--,
  // traido una sola vez.
  async function traer(clave: string): Promise<File> {
    const guardado = preparados.current.get(clave);
    if (guardado) return guardado;
    const id = Number(clave.slice(1));
    let blob: Blob;
    let nombre: string;
    if (clave[0] === "c") {
      const c = cotizaciones.find((x) => x.id === id);
      const r = await fetch(`/cotizaciones/${id}/pdf/archivo`);
      if (!r.ok) throw new Error(`No se pudo generar el PDF de ${c?.folio ?? "la cotizacion"}.`);
      blob = await r.blob();
      nombre = `${c?.folio ?? `Cotizacion-${id}`}.pdf`;
    } else {
      const a = archivos.find((x) => x.id === id);
      const u = await urlArchivoLead(id);
      if (!u.url) throw new Error(u.error ?? `No se pudo abrir ${a?.nombre ?? "el archivo"}.`);
      const r = await fetch(u.url);
      if (!r.ok) throw new Error(`No se pudo traer ${a?.nombre ?? "el archivo"}.`);
      blob = await r.blob();
      nombre = a?.nombre ?? `archivo-${id}`;
    }
    const f = new File([blob], nombre, { type: blob.type || "application/octet-stream" });
    preparados.current.set(clave, f);
    return f;
  }

  // Baja a la carpeta de descargas lo elegido: cotizaciones y archivos del lead.
  async function bajarPdfs() {
    for (const k of claves) {
      const f = await traer(k);
      descargar(f.name, f);
    }
  }

  async function adjuntosB64(): Promise<AdjuntoB64[]> {
    const salida: AdjuntoB64[] = [];
    for (const k of claves) {
      const f = await traer(k);
      salida.push({ nombre: f.name, base64: await aBase64(f) });
    }
    return salida;
  }

  const datosProgramado = (iso: string, estado: "Programado" | "En bandeja de salida") => ({
    idLead,
    canal,
    programadoPara: iso,
    destino,
    asunto,
    cuerpo,
    plantilla: plantilla?.nombre ?? "Mensaje libre",
    idsCotizacion: elegidas,
    idsArchivo: archivosElegidos,
    nombresAdjuntos: [...folios.map((f) => `${f}.pdf`), ...nombresArchivos],
    estado,
  });

  // Correo directo a Outlook de escritorio, por el ayudante y desde la cuenta de quien escribe
  // --stephan@centropanel.cl, por ejemplo--: se abre para revisarlo o, con fecha, queda en la
  // bandeja de salida esperando su hora. Sin archivo que bajar ni abrir.
  async function outlookDirecto() {
    setAviso(null);
    const desde = (datos.emailVendedor ?? "").trim();
    if (!desde) return setAviso({ ok: false, texto: "Su ficha no tiene correo: el correo sale desde su cuenta de Centropanel. Pida que lo agreguen en Vendedores y accesos." });
    let prog: { iso: string; dias: number } | null = null;
    if (programar) {
      const f = fechaProgramada();
      if (typeof f === "string") return setAviso({ ok: false, texto: f });
      prog = f;
    }
    setOcupado(true);
    try {
      const r = await outlookCorreo({ desde, para: destino, asunto, cuerpo, enviar_en: prog?.iso ?? null, adjuntos: await adjuntosB64() });
      if (!r.ok) return setAviso({ ok: false, texto: r.motivo ?? "Outlook no pudo crear el correo." });
      if (!(await anotar(prog ? { programadoPara: prog.iso, dias: prog.dias } : undefined))) return;
      if (prog) {
        const g = await programarMensaje(datosProgramado(prog.iso, "En bandeja de salida"));
        setAviso({
          ok: g.ok,
          texto:
            `Quedo en la bandeja de salida de Outlook (${desde}), programado para ${cuandoLegible(prog.iso)}. Outlook debe estar abierto a esa hora para enviarlo. Quedo anotado en el lead.` +
            (g.ok ? "" : ` (No se pudo dejar en la lista de programados: ${g.mensaje})`) +
            (nota.current ? ` ${nota.current}` : ""),
        });
      } else {
        setAviso({ ok: true, texto: `Se abrio el correo en Outlook (${desde}) para revisarlo y enviarlo. Quedo anotado en el lead, con su tarea de seguimiento.` + (nota.current ? ` ${nota.current}` : "") });
      }
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  // WhatsApp programado: espera su hora en el sistema. A esa hora aparece en "Mi gestion" y en
  // el lead, y con un clic se abre el chat del contacto con todo listo.
  async function programarWhatsapp() {
    setAviso(null);
    const f = fechaProgramada();
    if (typeof f === "string") return setAviso({ ok: false, texto: f });
    setOcupado(true);
    try {
      // No se anota en el lead todavia: sale --y se anota-- cuando se abre el chat a la hora.
      const g = await programarMensaje(datosProgramado(f.iso, "Programado"));
      if (!g.ok) return setAviso({ ok: false, texto: g.mensaje ?? "No se pudo programar." });
      setAviso({
        ok: true,
        texto: `Quedo programado para ${cuandoLegible(f.iso)}. Aparecera en Mi gestion y en este lead: al llegar la hora, un clic abre el chat con el mensaje y los archivos listos.` + (nota.current ? ` ${nota.current}` : ""),
      });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  // WhatsApp de escritorio por el ayudante: abre el chat del contacto con el texto escrito y los
  // archivos en el portapapeles, para pegarlos con Ctrl+V. Sin buscar a nadie.
  async function whatsappDirecto() {
    setAviso(null);
    const fono = normalizarFono(destino, prefijoTelefono);
    if (!fono) return setAviso({ ok: false, texto: "El numero no es valido." });
    setOcupado(true);
    try {
      if (!(await esperarTurno())) return;
      const r = await whatsappAbrir({ telefono: fono, texto: cuerpo, adjuntos: await adjuntosB64() });
      if (!r.ok) return setAviso({ ok: false, texto: r.motivo ?? "El ayudante no pudo abrir WhatsApp." });
      if (!(await anotar())) return;
      const n = Number(r.archivos ?? 0);
      setAviso({
        ok: true,
        texto:
          (n > 0
            ? r.pegado
              ? `Se abrio el chat del contacto con ${n === 1 ? "el archivo adjunto" : `los ${n} archivos adjuntos`} y el mensaje: revise y envie desde WhatsApp.`
              : `Se abrio el chat del contacto con el mensaje escrito. ${n === 1 ? "El archivo esta copiado" : `Los ${n} archivos estan copiados`}: pegue con Ctrl+V en el chat y envie.`
            : "Se abrio el chat del contacto con el mensaje escrito: revíselo y envíelo.") +
          " Quedo anotado en el lead, con su tarea de seguimiento." +
          (nota.current ? ` ${nota.current}` : ""),
      });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function outlook() {
    setOcupado(true);
    setAviso(null);
    try {
      // Queda anotado apenas se genera, aunque despues falle algo al armar el
      // archivo: si no se envio, el registro se borra desde el lead.
      if (!(await anotar())) return;
      const r = await armarBorradorOutlook(idLead, destino, asunto, cuerpo, elegidas, archivosElegidos);
      if (!r.ok) return setAviso({ ok: false, texto: `${r.mensaje} El registro ya quedo en el lead: si no va a enviar, borrelo desde ahi.` });
      const bin = atob(r.base64);
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      descargar(r.nombre, new Blob([bytes], { type: "message/rfc822" }));
      setAviso({ ok: true, texto: "Se bajo el borrador: abralo para verlo en Outlook de escritorio, revisarlo y enviarlo. Quedo anotado en el lead, con su tarea de seguimiento." + (nota.current ? ` ${nota.current}` : "") });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function gmail() {
    setOcupado(true);
    setAviso(null);
    try {
      if (!(await anotar())) return;
      if (claves.length > 0) await bajarPdfs();
      const url =
        `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(destino)}` +
        `&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setAviso({
        ok: true,
        texto:
          claves.length > 0
            ? "Se abrio Gmail con el mensaje y se bajaron los archivos: arrastrelos al correo antes de enviar. Quedo anotado en el lead, con su tarea de seguimiento." + (nota.current ? ` ${nota.current}` : "")
            : "Se abrio Gmail con el mensaje para revisarlo. Quedo anotado en el lead, con su tarea de seguimiento." + (nota.current ? ` ${nota.current}` : ""),
      });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  // El WhatsApp no sale del sistema: se abre la aplicacion de WhatsApp con el chat del
  // contacto y el mensaje ya escrito, y se revisa y se envia desde alli. El PDF no
  // puede viajar en el enlace: se baja para adjuntarlo en el chat.
  async function whatsapp() {
    setAviso(null);
    const fono = normalizarFono(destino, prefijoTelefono);
    // La ventana se abre al pulsar --despues de una espera el navegador ya no la dejaria abrir--
    // y se le da la direccion cuando llega el turno.
    const ventana = window.open("about:blank", "_blank");
    setOcupado(true);
    try {
      if (!(await esperarTurno())) return void ventana?.close();
      if (!(await anotar())) return void ventana?.close();
      if (claves.length > 0) await bajarPdfs();
      const url = fono ? `https://wa.me/${fono}?text=${encodeURIComponent(cuerpo)}` : `https://wa.me/?text=${encodeURIComponent(cuerpo)}`;
      if (ventana) ventana.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
      setAviso({
        ok: true,
        texto:
          (claves.length > 0
            ? "Se abrio WhatsApp con el mensaje escrito y se bajaron los archivos: adjuntelos en el chat y envie desde WhatsApp. Para que viajen con el mensaje, use \"Compartir con los archivos\"."
            : "Se abrio WhatsApp con el mensaje escrito: revíselo y envíelo desde WhatsApp.") +
          " Quedo anotado en el lead, con su tarea de seguimiento." +
          (nota.current ? ` ${nota.current}` : ""),
      });
    } catch (e) {
      ventana?.close();
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  // Comparte el mensaje y los archivos con la aplicacion que se elija --WhatsApp--: viajan
  // juntos, sin ir a buscarlos a una carpeta. El navegador no deja elegir el chat por uno: se
  // elige en la hoja de compartir. Se anota solo si se alcanzo a compartir.
  async function compartirWhatsapp() {
    setAviso(null);
    const archivosListos = claves.map((k) => preparados.current.get(k));
    if (archivosListos.some((f) => !f)) return setAviso({ ok: false, texto: "Los archivos todavia se estan preparando: espere un momento y vuelva a pulsar." });
    const files = archivosListos as File[];
    if (!navigator.canShare?.({ files })) return setAviso({ ok: false, texto: "Este navegador no puede compartir esos archivos. Use \"Abrir WhatsApp\" y adjunte lo que se bajo." });
    setOcupado(true);
    if (!(await esperarTurno())) return setOcupado(false);
    // Tras esperar, el navegador ya no deja abrir la hoja de compartir sin un clic nuevo.
    if (!navigator.userActivation?.isActive) {
      setOcupado(false);
      return setAviso({ ok: true, texto: "Ya pasaron los 20 segundos: pulse \"Compartir con los archivos\" otra vez para enviarlo." });
    }
    try {
      // El texto tambien queda copiado, por si la aplicacion elegida no lo recibe junto con los archivos.
      navigator.clipboard?.writeText(cuerpo).catch(() => {});
      await navigator.share({ files, text: cuerpo });
    } catch (e) {
      setOcupado(false);
      if ((e as Error).name === "AbortError") return setAviso({ ok: false, texto: "Se cancelo y no quedo anotado en el lead." });
      return setAviso({ ok: false, texto: `No se pudo compartir: ${(e as Error).message}` });
    }
    if (await anotar()) {
      setAviso({
        ok: true,
        texto:
          "Se compartieron el mensaje y los archivos. Si en el chat falta el texto, esta copiado: peguelo con Ctrl+V. Quedo anotado en el lead, con su tarea de seguimiento." +
          (nota.current ? ` ${nota.current}` : ""),
      });
    }
    setOcupado(false);
  }

  const sinContacto = canal === "email" ? emails.length === 0 : telefonos.length === 0;

  return (
    <section aria-label="Escribirle al contacto" className="text-[11px]">
      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} className="bg-verde text-white font-semibold px-2.5 py-1 rounded">
          Escribirle al contacto
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="bg-verde text-white px-3 py-1 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase">Escribirle al contacto</h2>
            <button type="button" onClick={() => setAbierto(false)} className="text-[11px] underline">
              Cerrar
            </button>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-gray-600">
              Mensajes de la linea <strong>{lineaTexto}</strong>. El mensaje no se envia solo: queda a la vista para que lo revise y lo envie usted. Se adjunta el PDF de las
              cotizaciones que elija, no un enlace.
            </p>

            <div className="flex gap-1.5" role="tablist" aria-label="Canal">
              {(["email", "whatsapp"] as Canal[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={canal === c}
                  onClick={() => setCanal(c)}
                  className={`px-2.5 py-1 rounded font-semibold border ${canal === c ? "bg-verde text-white border-verde" : "bg-white text-gray-700 border-gray-300"}`}
                >
                  {c === "email" ? "Correo" : "WhatsApp"}
                </button>
              ))}
            </div>

            {sinContacto ? (
              <p className="text-amber-700">
                El lead no tiene {canal === "email" ? "correo" : "telefono"} registrado: agreguelo en los datos del lead.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="msg-destino" className={ROTULO}>
                    {canal === "email" ? "Para" : "Al numero"}
                  </label>
                  <select id="msg-destino" value={destino} onChange={(e) => setDestino(e.target.value)} className={CAMPO}>
                    {(canal === "email" ? emails : telefonos.map((t) => t.phone)).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="msg-plantilla" className={ROTULO}>
                    Mensaje
                  </label>
                  <select
                    id="msg-plantilla"
                    value={idPlantilla ?? ""}
                    onChange={(e) => {
                      setIdPlantilla(Number(e.target.value) || null);
                      setEditado(false);
                    }}
                    className={CAMPO}
                  >
                    {delCanal.length === 0 && <option value="">{`(no hay mensajes de la linea ${lineaTexto})`}</option>}
                    {delCanal.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <fieldset>
              <legend className={ROTULO}>Adjuntar el PDF de las cotizaciones</legend>
              {cotizaciones.length === 0 ? (
                <p className="text-gray-500">Este lead no tiene cotizaciones vinculadas.</p>
              ) : (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {cotizaciones.map((c) => (
                    <li key={c.id}>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={elegidas.includes(c.id)}
                          onChange={(e) => setElegidas((x) => (e.target.checked ? [...x, c.id] : x.filter((i) => i !== c.id)))}
                        />
                        {c.folio}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <fieldset>
              <legend className={ROTULO}>Adjuntar archivos cargados en el lead</legend>
              {archivos.length === 0 ? (
                <p className="text-gray-500">Este lead no tiene archivos cargados.</p>
              ) : (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {archivos.map((a) => (
                    <li key={a.id}>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={archivosElegidos.includes(a.id)}
                          onChange={(e) => setArchivosElegidos((x) => (e.target.checked ? [...x, a.id] : x.filter((i) => i !== a.id)))}
                        />
                        <span>
                          {a.nombre} <span className="text-gray-500">({mb(a.tamano)})</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            {canal === "email" && (
              <div>
                <label htmlFor="msg-asunto" className={ROTULO}>
                  Asunto
                </label>
                <input
                  id="msg-asunto"
                  value={asunto}
                  onChange={(e) => {
                    setAsunto(e.target.value);
                    setEditado(true);
                  }}
                  className={CAMPO}
                />
              </div>
            )}
            <div>
              <label htmlFor="msg-cuerpo" className={ROTULO}>
                Texto
              </label>
              <textarea
                id="msg-cuerpo"
                value={cuerpo}
                onChange={(e) => {
                  setCuerpo(e.target.value);
                  setEditado(true);
                }}
                rows={9}
                className={CAMPO}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="inline-flex items-center gap-1.5 font-semibold">
                <input
                  type="checkbox"
                  checked={programar}
                  onChange={(e) => {
                    setProgramar(e.target.checked);
                    if (e.target.checked && !cuando) setCuando(manana9());
                  }}
                />
                Dejarlo programado
              </label>
              {programar && (
                <input
                  type="datetime-local"
                  aria-label="Fecha y hora de envio"
                  value={cuando}
                  min={paraCampo(new Date(Date.now() + 60000))}
                  onChange={(e) => setCuando(e.target.value)}
                  className={`${CAMPO} !w-auto`}
                />
              )}
              <span className="text-[10px] text-gray-600">
                {canal === "email"
                  ? "Queda en la bandeja de salida de Outlook y sale a esa hora (Outlook debe estar abierto)."
                  : "Queda en Mi gestion: a esa hora se abre el chat del contacto con un clic."}
              </span>
            </div>

            {canal === "email" && !conAyudante && ayudante !== undefined && (
              <p className="text-[10px] text-amber-700">
                {ayudante === null ? "Para dejarlo en la bandeja de salida de Outlook, o abrirlo en Outlook sin bajar un archivo, instale el ayudante: " : "El ayudante esta instalado pero falta emparejarlo: "}
                <a href="/ayudante" className="underline font-semibold" target="_blank" rel="noreferrer">
                  {ayudante === null ? "como instalarlo" : "emparejar"}
                </a>
                .
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {canal === "email" ? (
                <>
                  {conAyudante && ayudante?.outlook ? (
                    <button
                      type="button"
                      onClick={outlookDirecto}
                      disabled={ocupado || preparando || sinContacto || !asunto.trim() || !cuerpo.trim()}
                      className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                    >
                      {ocupado ? "Preparando…" : programar ? "Programar en Outlook" : "Abrir en Outlook"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={outlook}
                      disabled={ocupado || sinContacto || programar || !asunto.trim() || !cuerpo.trim()}
                      title={programar ? "Para programar hace falta el ayudante de Outlook" : undefined}
                      className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                    >
                      {ocupado ? "Preparando…" : "Borrador para Outlook de escritorio"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={gmail}
                    disabled={ocupado || sinContacto || !asunto.trim() || !cuerpo.trim()}
                    className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                  >
                    Abrir en Gmail
                  </button>
                </>
              ) : programar ? (
                <button
                  type="button"
                  onClick={programarWhatsapp}
                  disabled={ocupado || sinContacto || !cuerpo.trim()}
                  className="bg-[#25D366] text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                >
                  {ocupado ? "Programando…" : "Programar WhatsApp"}
                </button>
              ) : (
                <>
                  {conAyudante && (
                    <button
                      type="button"
                      onClick={whatsappDirecto}
                      disabled={ocupado || preparando || sinContacto || !cuerpo.trim()}
                      className="bg-[#25D366] text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                      title="Abre el chat del contacto con el mensaje escrito y los archivos listos para pegar"
                    >
                      {preparando ? "Preparando archivos…" : "Abrir chat con los archivos"}
                    </button>
                  )}
                  {claves.length > 0 && puedeCompartir && !conAyudante && (
                    <button
                      type="button"
                      onClick={compartirWhatsapp}
                      disabled={ocupado || preparando || !cuerpo.trim()}
                      className="bg-[#25D366] text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                    >
                      {preparando ? "Preparando archivos…" : "Compartir con los archivos"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={whatsapp}
                    disabled={ocupado || sinContacto || !cuerpo.trim()}
                    className={`font-semibold px-2.5 py-1 rounded disabled:opacity-50 ${conAyudante || (claves.length > 0 && puedeCompartir) ? "border border-[#25D366] text-[#128C7E] bg-white" : "bg-[#25D366] text-white"}`}
                  >
                    Abrir WhatsApp
                  </button>
                  {claves.length > 0 && (
                    <p className="basis-full text-[10px] text-gray-600">
                      {puedeCompartir
                        ? "\"Compartir con los archivos\" manda el texto y los archivos juntos: en la hoja que se abre elija WhatsApp y el chat del contacto. \"Abrir WhatsApp\" abre el chat del contacto con el texto y baja los archivos para adjuntarlos a mano."
                        : "Este navegador no puede mandar archivos a WhatsApp de una vez: se bajan a la carpeta de descargas para adjuntarlos en el chat. Desde el telefono si se pueden compartir juntos."}
                    </p>
                  )}
                </>
              )}
            </div>

            {espera != null && (
              <p className="flex flex-wrap items-center gap-2 text-amber-800 font-semibold" role="status" aria-live="polite">
                <span>Sale en {espera} s</span>
                <button type="button" onClick={cancelarEspera} className="underline font-normal">
                  Cancelar envio
                </button>
              </p>
            )}
            {aviso && (
              <p className={aviso.ok ? "text-green-700" : "text-red-700"} role={aviso.ok ? "status" : "alert"}>
                {aviso.texto}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
