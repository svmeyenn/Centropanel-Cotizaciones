"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { armarBorradorOutlook, registrarEnvioLead } from "@/app/leads/mensaje";
import { aplicarPlantilla, normalizarFono, type Canal, type DatosMensaje, type Plantilla } from "@/lib/mensajes";

export type CotizacionAdjuntable = { id: number; folio: string };

type Aviso = { ok: boolean; texto: string } | null;

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white";
const ROTULO = "block text-[11px] font-semibold text-dorado-osc mb-0.5";

// El menu de compartir del sistema acepta archivos en celulares; en la mayoria de
// los computadores no, y ahi se baja el PDF para adjuntarlo en WhatsApp.
function puedeCompartirArchivos(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  return navigator.canShare({ files: [new File([""], "prueba.pdf", { type: "application/pdf" })] });
}

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
  datos,
  lineaTexto,
}: {
  idLead: number;
  plantillas: Plantilla[];
  emails: string[];
  telefonos: { phone: string; whatsapp?: boolean }[];
  prefijoTelefono: string;
  cotizaciones: CotizacionAdjuntable[];
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
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [editado, setEditado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ocupado, setOcupado] = useState(false);
  const ultimo = useRef({ clave: "", cuando: 0 });
  // Si el lead paso de "no contactado" a "contactado", la base lo dice al registrar.
  const nota = useRef("");
  const [archivos, setArchivos] = useState<Record<number, File>>({});
  const [compartible, setCompartible] = useState(false);

  const folios = cotizaciones.filter((c) => elegidas.includes(c.id)).map((c) => c.folio);
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

  // El texto se rehace con la plantilla, los folios y los datos --salvo que la
  // persona ya lo haya editado a mano--.
  useEffect(() => {
    if (editado) return;
    const d: DatosMensaje = { ...datos, folios };
    setAsunto(plantilla?.asunto ? aplicarPlantilla(plantilla.asunto, d) : "");
    setCuerpo(plantilla ? aplicarPlantilla(plantilla.cuerpo, d) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantilla, folios.join("|"), editado]);

  // En el celular los PDF se bajan apenas se eligen: el telefono solo deja abrir
  // el menu de compartir justo despues del toque, y esperar la descarga en ese
  // momento lo haria fallar.
  useEffect(() => {
    if (!abierto || canal !== "whatsapp" || !puedeCompartirArchivos()) return;
    setCompartible(true);
    let vigente = true;
    for (const c of cotizaciones.filter((x) => elegidas.includes(x.id))) {
      if (archivos[c.id]) continue;
      fetch(`/cotizaciones/${c.id}/pdf/archivo`)
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((b) => {
          if (vigente) setArchivos((a) => ({ ...a, [c.id]: new File([b], `${c.folio}.pdf`, { type: "application/pdf" }) }));
        })
        .catch(() => {});
    }
    return () => {
      vigente = false;
    };
  }, [abierto, canal, elegidas, cotizaciones, archivos]);

  const faltaPreparar = compartible && canal === "whatsapp" && elegidas.some((id) => !archivos[id]);

  async function anotar() {
    // Cada envio queda anotado; solo se ignora el mismo toque repetido a los pocos segundos.
    const clave = `${canal}|${destino}|${asunto}|${cuerpo}|${folios.join(",")}`;
    if (ultimo.current.clave === clave && Date.now() - ultimo.current.cuando < 15000) return true;
    const r = await registrarEnvioLead(idLead, canal, plantilla?.nombre ?? "Mensaje libre", destino, folios, elegidas, canal === "email" ? asunto : "", cuerpo);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.mensaje ?? "No se pudo anotar en el lead." });
      return false;
    }
    ultimo.current = { clave, cuando: Date.now() };
    nota.current = (r.mensaje ?? "").replace(/^Anotado en el lead, con seguimiento en 3 dias\.\s*/, "");
    setAviso({ ok: true, texto: r.mensaje ?? "Anotado en el lead." });
    return true;
  }

  async function bajarPdfs() {
    for (const c of cotizaciones.filter((x) => elegidas.includes(x.id))) {
      const r = await fetch(`/cotizaciones/${c.id}/pdf/archivo`);
      if (!r.ok) throw new Error(`No se pudo generar el PDF de ${c.folio}.`);
      descargar(`${c.folio}.pdf`, await r.blob());
    }
  }

  async function outlook() {
    setOcupado(true);
    setAviso(null);
    try {
      // Queda anotado apenas se genera, aunque despues falle algo al armar el
      // archivo: si no se envio, el registro se borra desde el lead.
      if (!(await anotar())) return;
      const r = await armarBorradorOutlook(idLead, destino, asunto, cuerpo, elegidas);
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
      if (elegidas.length > 0) await bajarPdfs();
      const url =
        `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(destino)}` +
        `&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setAviso({
        ok: true,
        texto:
          elegidas.length > 0
            ? "Se abrio Gmail con el mensaje y se bajaron los PDF: arrastrelos al correo antes de enviar. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : "")
            : "Se abrio Gmail con el mensaje para revisarlo. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : ""),
      });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function whatsapp() {
    setAviso(null);
    const fono = normalizarFono(destino, prefijoTelefono);
    const lista = elegidas.map((id) => archivos[id]).filter(Boolean);
    // Compartir con archivos: el celular abre su menu y la persona elige WhatsApp
    // y el contacto.
    if (compartible && lista.length > 0 && lista.length === elegidas.length) {
      try {
        await navigator.share({ files: lista, text: cuerpo });
        if (await anotar())
          setAviso({ ok: true, texto: "Elija WhatsApp y el contacto en el menu. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : "") });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setAviso({ ok: false, texto: "No se pudo abrir el menu de compartir." });
      }
      return;
    }
    setOcupado(true);
    try {
      if (!(await anotar())) return;
      if (elegidas.length > 0) await bajarPdfs();
      window.open(
        fono ? `https://wa.me/${fono}?text=${encodeURIComponent(cuerpo)}` : `https://wa.me/?text=${encodeURIComponent(cuerpo)}`,
        "_blank",
        "noopener,noreferrer"
      );
      setAviso({
        ok: true,
        texto:
          elegidas.length > 0
            ? "Se abrio WhatsApp con el mensaje y se bajaron los PDF: adjuntelos en el chat antes de enviar. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : "")
            : "Se abrio WhatsApp con el mensaje para revisarlo. Quedo anotado en el lead con seguimiento en 3 dias." + (nota.current ? ` ${nota.current}` : ""),
      });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
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
              <legend className={ROTULO}>Adjuntar el PDF de</legend>
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
                <button
                  type="button"
                  onClick={whatsapp}
                  disabled={ocupado || sinContacto || !cuerpo.trim() || faltaPreparar}
                  className="bg-[#25D366] text-white font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                >
                  {faltaPreparar ? "Preparando PDF…" : "Abrir WhatsApp"}
                </button>
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
