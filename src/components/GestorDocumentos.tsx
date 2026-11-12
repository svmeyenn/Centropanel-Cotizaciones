"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fecha } from "@/lib/formato";
import { BUCKET_DOCUMENTOS } from "@/lib/documentos";
import { EXTENSIONES_PROHIBIDAS, TOPE_ARCHIVO_LEAD } from "@/lib/leads";
import { nombreSeguro } from "@/lib/finanzas/almacen";
import { editarDocumento, quitarDocumento, registrarDocumento, urlDocumento } from "@/app/documentos/acciones";

export interface DocumentoFila {
  id: number;
  nombre: string;
  nota: string;
  tamano: number;
  id_pais: number | null;
  activo: boolean;
  creado: string;
  subido_por: string | null;
}

const TITULO = "bg-verde text-white text-[11px] font-semibold px-3 py-1 flex justify-between";
const BOTON = "bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40";
const BOTON_CLARO = "border border-gray-300 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";
const INPUT = "w-full border border-gray-300 rounded px-2 py-1 text-sm";

const peso = (b: number) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(b / 1024)).toLocaleString("es-CL")} KB`;

// La biblioteca: el administrador sube cada documento con una nota que lo identifica; todos lo ven
// y lo adjuntan desde el lead al escribirle al cliente.
export default function GestorDocumentos({
  documentos,
  esAdmin,
  paises,
}: {
  documentos: DocumentoFila[];
  esAdmin: boolean;
  paises: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  // Los archivos elegidos o arrastrados, cada uno con la nota que lo identifica, antes de subirlos.
  const [pendientes, setPendientes] = useState<{ archivo: File; nota: string }[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [pais, setPais] = useState<number | null>(paises.length === 1 ? paises[0].id : null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<{ nota: string; idPais: number | null; activo: boolean }>({ nota: "", idPais: null, activo: true });
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [pendiente, empezar] = useTransition();

  const nombrePais = (id: number | null) => (id == null ? "Todos" : (paises.find((p) => p.id === id)?.nombre ?? "Otro"));

  function agregar(lista: File[]) {
    setAviso(null);
    const malos = lista.filter((f) => EXTENSIONES_PROHIBIDAS.test(f.name) || f.size === 0 || f.size > TOPE_ARCHIVO_LEAD);
    const buenos = lista.filter((f) => !malos.includes(f));
    if (malos.length) setAviso({ ok: false, texto: `No se agregaron ${malos.map((f) => f.name).join(", ")}: estan vacios, pesan mas de 25 MB o son programas.` });
    // La nota parte con el nombre del archivo sin extension, para corregirla y no partir de cero.
    setPendientes((x) => [...x, ...buenos.map((f) => ({ archivo: f, nota: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") }))]);
    if (entrada.current) entrada.current.value = "";
  }

  async function subir() {
    setAviso(null);
    if (pendientes.length === 0) return setAviso({ ok: false, texto: "Elija o arrastre los archivos." });
    if (pendientes.some((x) => !x.nota.trim())) return setAviso({ ok: false, texto: "Cada documento necesita una nota que diga que es." });
    setSubiendo(true);
    const fallas: string[] = [];
    const quedan: { archivo: File; nota: string }[] = [];
    try {
      const supabase = createClient();
      for (const x of pendientes) {
        const ruta = `${crypto.randomUUID()}-${nombreSeguro(x.archivo.name)}`;
        const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(ruta, x.archivo, { contentType: x.archivo.type || undefined, upsert: false });
        if (error) {
          fallas.push(`${x.archivo.name}: ${error.message}`);
          quedan.push(x);
          continue;
        }
        const r = await registrarDocumento({ ruta, nombre: x.archivo.name, tipo: x.archivo.type, tamano: x.archivo.size, nota: x.nota, idPais: pais });
        if (!r.ok) {
          fallas.push(`${x.archivo.name}: ${r.mensaje ?? "no se pudo registrar"}`);
          quedan.push(x);
        }
      }
    } finally {
      setSubiendo(false);
    }
    const subidos = pendientes.length - quedan.length;
    setPendientes(quedan);
    setAviso(
      fallas.length
        ? { ok: false, texto: `${subidos ? `Se subieron ${subidos}. ` : ""}No se pudieron subir: ${fallas.join("; ")}.` }
        : { ok: true, texto: subidos === 1 ? "Documento subido." : `Se subieron ${subidos} documentos.` }
    );
    if (subidos) router.refresh();
  }

  async function abrir(id: number) {
    setAviso(null);
    // La pestana se abre antes de pedir el enlace: si no, el navegador la bloquea.
    const ventana = window.open("", "_blank");
    const r = await urlDocumento(id);
    if (r.url && ventana) ventana.location.href = r.url;
    else {
      ventana?.close();
      setAviso({ ok: false, texto: r.error ?? "No se pudo abrir el documento." });
    }
  }

  function guardar(id: number) {
    empezar(async () => {
      const r = await editarDocumento(id, borrador);
      setAviso({ ok: r.ok, texto: r.mensaje ?? "" });
      if (r.ok) {
        setEditando(null);
        router.refresh();
      }
    });
  }

  function quitar(id: number) {
    empezar(async () => {
      const r = await quitarDocumento(id);
      setConfirmando(null);
      setAviso({ ok: r.ok, texto: r.mensaje ?? "" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {esAdmin && (
        <section className="bg-white border border-gray-200 rounded overflow-hidden">
          <h2 className={TITULO}>
            <span>SUBIR UN DOCUMENTO</span>
          </h2>
          <div className="p-3 space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                agregar(Array.from(e.dataTransfer.files));
              }}
              className={`rounded border border-dashed px-3 py-4 text-center text-xs ${arrastrando ? "border-verde bg-crema" : "border-gray-300 bg-gray-50"}`}
            >
              <p className="text-gray-700">Arrastre aqui fichas tecnicas, catalogos o certificados, o</p>
              <button type="button" onClick={() => entrada.current?.click()} className={`${BOTON} mt-1`}>
                Elegir archivos
              </button>
              <input
                ref={entrada}
                type="file"
                multiple
                className="sr-only"
                aria-label="Elegir documentos"
                onChange={(e) => agregar(Array.from(e.target.files ?? []))}
              />
              <p className="mt-1 text-[11px] text-gray-500">Varios a la vez; hasta 25 MB cada uno.</p>
            </div>

            {pendientes.length > 0 && (
              <>
                <ul className="space-y-2">
                  {pendientes.map((x, i) => (
                    <li key={`${x.archivo.name}-${i}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center">
                      <span className="text-xs break-all">
                        {x.archivo.name} <span className="text-gray-500">({peso(x.archivo.size)})</span>
                      </span>
                      <span>
                        <label htmlFor={`doc-nota-nueva-${i}`} className="sr-only">Nota de {x.archivo.name}</label>
                        <input
                          id={`doc-nota-nueva-${i}`}
                          className={INPUT}
                          maxLength={500}
                          placeholder="Que es: Ficha tecnica panel SIP 114 mm OSB/OSB"
                          value={x.nota}
                          onChange={(e) => setPendientes((l) => l.map((y, k) => (k === i ? { ...y, nota: e.target.value } : y)))}
                        />
                      </span>
                      <button type="button" onClick={() => setPendientes((l) => l.filter((_, k) => k !== i))} className="text-red-700 underline text-xs justify-self-start">
                        Sacar
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-gray-500">La nota es lo que se ve al elegirlo en el lead: diga que es, para reconocerlo.</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs">
                    <span className="block font-semibold text-dorado-osc mb-0.5">Mercado</span>
                    <select id="doc-pais" className="border border-gray-300 rounded px-2 py-1 text-sm" value={pais ?? ""} onChange={(e) => setPais(e.target.value ? Number(e.target.value) : null)}>
                      {paises.length > 1 && <option value="">Todos</option>}
                      {paises.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={subir} disabled={subiendo || pendientes.some((x) => !x.nota.trim())} className={BOTON}>
                    {subiendo ? "Subiendo..." : pendientes.length === 1 ? "Subir" : `Subir los ${pendientes.length}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {aviso && (
        <div role={aviso.ok ? "status" : "alert"} className={`text-xs rounded p-2 border ${aviso.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {aviso.texto}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded overflow-hidden">
        <h2 className={TITULO}>
          <span>BIBLIOTECA</span>
          <span className="font-normal">{documentos.filter((d) => d.activo).length} en uso</span>
        </h2>
        {documentos.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">
            Todavia no hay documentos. {esAdmin ? "Suba el primero arriba." : "El administrador los sube."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-crema text-dorado-osc">
                <tr>
                  <th className="text-left px-3 py-1">Nota</th>
                  <th className="text-left px-3 py-1">Archivo</th>
                  <th className="text-right px-3 py-1 w-20">Peso</th>
                  <th className="text-left px-3 py-1 w-20">Mercado</th>
                  <th className="text-left px-3 py-1 w-32">Subido</th>
                  {esAdmin && <th className="px-3 py-1 w-40" />}
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id} className={`border-t border-gray-100 align-top ${d.activo ? "" : "text-gray-400"}`}>
                    <td className="px-3 py-1.5">
                      {editando === d.id ? (
                        <div className="space-y-1">
                          <label htmlFor={`doc-nota-${d.id}`} className="sr-only">Nota</label>
                          <input id={`doc-nota-${d.id}`} className={INPUT} maxLength={500} value={borrador.nota} onChange={(e) => setBorrador({ ...borrador, nota: e.target.value })} />
                          <div className="flex gap-3 items-center">
                            <label className="inline-flex items-center gap-1">
                              <span className="text-gray-600">Mercado</span>
                              <select className="border border-gray-300 rounded px-1 py-0.5" value={borrador.idPais ?? ""} onChange={(e) => setBorrador({ ...borrador, idPais: e.target.value ? Number(e.target.value) : null })}>
                                {paises.length > 1 && <option value="">Todos</option>}
                                {paises.map((p) => (
                                  <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                              </select>
                            </label>
                            <label className="inline-flex items-center gap-1">
                              <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} />
                              En uso
                            </label>
                          </div>
                        </div>
                      ) : (
                        <span className="font-semibold">
                          {d.nota}
                          {!d.activo && <span className="ml-2 font-normal text-[11px]">(fuera de uso: no se ofrece en los leads)</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <button type="button" onClick={() => abrir(d.id)} className="text-verde underline text-left break-all">
                        {d.nombre}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{peso(d.tamano)}</td>
                    <td className="px-3 py-1.5">{nombrePais(d.id_pais)}</td>
                    <td className="px-3 py-1.5">
                      {fecha(d.creado.slice(0, 10))}
                      {d.subido_por && <span className="block text-[11px] text-gray-500">{d.subido_por}</span>}
                    </td>
                    {esAdmin && (
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        {editando === d.id ? (
                          <span className="inline-flex gap-1">
                            <button type="button" disabled={pendiente} onClick={() => guardar(d.id)} className={BOTON}>Guardar</button>
                            <button type="button" onClick={() => setEditando(null)} className={BOTON_CLARO}>Cancelar</button>
                          </span>
                        ) : confirmando === d.id ? (
                          <span className="inline-flex items-center gap-1">
                            <span>¿Quitar?</span>
                            <button type="button" disabled={pendiente} onClick={() => quitar(d.id)} className="border border-red-300 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white">Si</button>
                            <button type="button" onClick={() => setConfirmando(null)} className={BOTON_CLARO}>No</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-3">
                            <button
                              type="button"
                              className="text-verde underline"
                              onClick={() => {
                                setBorrador({ nota: d.nota, idPais: d.id_pais, activo: d.activo });
                                setEditando(d.id);
                              }}
                            >
                              Editar
                            </button>
                            <button type="button" className="text-red-700 underline" onClick={() => setConfirmando(d.id)}>Quitar</button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
