"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { armarBorradorOutlook, registrarEnvioLead } from "@/app/leads/mensaje";
import { urlArchivoLead } from "@/app/leads/edicion-lead";
import { aplicarPlantilla, normalizarFono, type Canal, type DatosMensaje, type Plantilla } from "@/lib/mensajes";

export type CotizacionAdjuntable = { id: number; folio: string };
// Un archivo subido al lead.
export type ArchivoAdjuntable = { id: number; nombre: string; tamano: number };

const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Aviso = { ok: boolean; texto: string } | null;

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
  const [ocupado, setOcupado] = useState(false);
  const ultimo = useRef({ clave: "", cuando: 0 });
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

  async function anotar() {
    // Cada envio queda anotado; solo se ignora el mismo toque repetido a los pocos segundos.
    const clave = `${canal}|${destino}|${asunto}|${cuerpo}|${folios.join(",")}|${nombresArchivos.join(",")}`;
    if (ultimo.current.clave === clave && Date.now() - ultimo.current.cuando < 15000) return true;
    const r = await registrarEnvioLead(idLead, canal, plantilla?.nombre ?? "Mensaje libre", destino, folios, elegidas, canal === "email" ? asunto : "", cuerpo, nombresArchivos);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.mensaje ?? "No se pudo anotar en el lead." });
      return false;
    }
    ultimo.current = { clave, cuando: Date.now() };
    nota.current = (r.mensaje ?? "").replace(/^Anotado en el lead, con seguimiento en 3 dias\.\s*/, "");
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
      setAviso({ ok: true, texto: "Se bajo el borrador: abralo para verlo en Outlook de escritorio, revisarlo y enviarlo. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : "") });
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
            ? "Se abrio Gmail con el mensaje y se bajaron los archivos: arrastrelos al correo antes de enviar. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : "")
            : "Se abrio Gmail con el mensaje para revisarlo. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : ""),
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
    setOcupado(true);
    try {
      if (!(await anotar())) return;
      if (claves.length > 0) await bajarPdfs();
      window.open(
        fono ? `https://wa.me/${fono}?text=${encodeURIComponent(cuerpo)}` : `https://wa.me/?text=${encodeURIComponent(cuerpo)}`,
        "_blank",
        "noopener,noreferrer"
      );
      setAviso({
        ok: true,
        texto:
          (claves.length > 0
            ? "Se abrio WhatsApp con el mensaje escrito y se bajaron los archivos: adjuntelos en el chat y envie desde WhatsApp. Para que viajen con el mensaje, use \"Compartir con los archivos\"."
            : "Se abrio WhatsApp con el mensaje escrito: revíselo y envíelo desde WhatsApp.") +
          " Quedo anotado en el lead con seguimiento en 3 dias." +
          (nota.current ? ` ${nota.current}` : ""),
      });
    } catch (e) {
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
          "Se compartieron el mensaje y los archivos. Si en el chat falta el texto, esta copiado: peguelo con Ctrl+V. Quedo anotado en el lead con seguimiento en 3 dias." +
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

            <div className="flex flex-wrap gap-2">
              {canal === "email" ? (
                <>
                  <button
                    type="button"
                    onClick={outlook}
                    disabled={ocupado || sinContacto || !asunto.trim() || !cuerpo.trim()}
                    className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                  >
                    {ocupado ? "Preparando…" : "Borrador para Outlook de escritorio"}
                  </button>
                  <button
                    type="button"
                    onClick={gmail}
                    disabled={ocupado || sinContacto || !asunto.trim() || !cuerpo.trim()}
                    className="bg-verde text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                  >
                    Abrir en Gmail
                  </button>
                </>
              ) : (
                <>
                  {claves.length > 0 && puedeCompartir && (
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
                    className={`font-semibold px-2.5 py-1 rounded disabled:opacity-50 ${claves.length > 0 && puedeCompartir ? "border border-[#25D366] text-[#128C7E] bg-white" : "bg-[#25D366] text-white"}`}
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
