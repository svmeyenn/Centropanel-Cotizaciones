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
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [pais, setPais] = useState<number | null>(paises.length === 1 ? paises[0].id : null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<{ nota: string; idPais: number | null; activo: boolean }>({ nota: "", idPais: null, activo: true });
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [pendiente, empezar] = useTransition();

  const nombrePais = (id: number | null) => (id == null ? "Todos" : (paises.find((p) => p.id === id)?.nombre ?? "Otro"));

  async function subir() {
    setAviso(null);
    if (!archivo) return setAviso({ ok: false, texto: "Elija el archivo." });
    if (!nota.trim()) return setAviso({ ok: false, texto: "Escriba una nota que diga que es el documento." });
    if (EXTENSIONES_PROHIBIDAS.test(archivo.name)) return setAviso({ ok: false, texto: "Ese tipo de archivo no se puede subir." });
    if (archivo.size === 0) return setAviso({ ok: false, texto: "El archivo esta vacio." });
    if (archivo.size > TOPE_ARCHIVO_LEAD) return setAviso({ ok: false, texto: "El archivo pesa mas de 25 MB." });
    setSubiendo(true);
    try {
      const ruta = `${crypto.randomUUID()}-${nombreSeguro(archivo.name)}`;
      const { error } = await createClient().storage.from(BUCKET_DOCUMENTOS).upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });
      if (error) return setAviso({ ok: false, texto: error.message });
      const r = await registrarDocumento({ ruta, nombre: archivo.name, tipo: archivo.type, tamano: archivo.size, nota, idPais: pais });
      setAviso({ ok: r.ok, texto: r.mensaje ?? (r.ok ? "Documento subido." : "No se pudo registrar.") });
      if (r.ok) {
        setArchivo(null);
        setNota("");
        if (entrada.current) entrada.current.value = "";
        router.refresh();
      }
    } finally {
      setSubiendo(false);
    }
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
          <div className="p-3 grid gap-3 md:grid-cols-[1fr_2fr_auto] items-start">
            <div>
              <label htmlFor="doc-archivo" className="block text-xs font-semibold text-dorado-osc mb-0.5">Archivo</label>
              <input
                id="doc-archivo"
                ref={entrada}
                type="file"
                className="block w-full text-xs"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              <span className="block text-[11px] text-gray-500 mt-0.5">PDF, imagen, planilla u otro; hasta 25 MB.</span>
            </div>
            <div>
              <label htmlFor="doc-nota" className="block text-xs font-semibold text-dorado-osc mb-0.5">Nota</label>
              <input
                id="doc-nota"
                className={INPUT}
                placeholder="Ficha tecnica panel SIP 114 mm OSB/OSB"
                maxLength={500}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <span className="block text-[11px] text-gray-500 mt-0.5">Es lo que se ve al elegirlo en el lead: diga que es, para reconocerlo.</span>
            </div>
            <div>
              <label htmlFor="doc-pais" className="block text-xs font-semibold text-dorado-osc mb-0.5">Mercado</label>
              <select
                id="doc-pais"
                className={INPUT}
                value={pais ?? ""}
                onChange={(e) => setPais(e.target.value ? Number(e.target.value) : null)}
              >
                {paises.length > 1 && <option value="">Todos</option>}
                {paises.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <button type="button" onClick={subir} disabled={subiendo || !archivo || !nota.trim()} className={`${BOTON} mt-2 w-full`}>
                {subiendo ? "Subiendo..." : "Subir"}
              </button>
            </div>
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
