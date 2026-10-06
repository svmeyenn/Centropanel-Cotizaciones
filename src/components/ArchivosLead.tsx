"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fecha } from "@/lib/formato";
import { BUCKET_LEADS, EXTENSIONES_PROHIBIDAS, TOPE_ARCHIVO_LEAD } from "@/lib/leads";
import { nombreSeguro } from "@/lib/finanzas/almacen";
import { quitarArchivoLead, registrarArchivoLead, urlArchivoLead } from "@/app/leads/edicion-lead";

export interface ArchivoLead {
  id: number;
  nombre: string;
  tamano: number | null;
  creado_en: string;
  id_vendedor: number;
  vendedor: string | null;
}

const TITULO = "bg-verde text-white text-[10px] font-semibold px-3 py-0.5 flex justify-between";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";

const peso = (b: number | null) =>
  b == null
    ? ""
    : b >= 1024 * 1024
      ? `${(b / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(b / 1024)).toLocaleString("es-CL")} KB`;

// Los archivos de un lead --planos, fotos, presupuestos, lo que el cliente mande--.
// El navegador sube el archivo directo al deposito privado y despues se registra;
// para abrirlo se pide un enlace que dura poco. Sirve a cualquier lead, de la
// linea que sea.
export default function ArchivosLead({
  idLead,
  archivos,
  puedeEditar,
  esAdmin,
  yo,
  titulo = "ARCHIVOS",
  vacio = "Este lead todavia no tiene archivos.",
}: {
  idLead: number;
  archivos: ArchivoLead[];
  puedeEditar: boolean;
  esAdmin: boolean;
  yo: number;
  titulo?: string;
  vacio?: string;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [subidas, setSubidas] = useState<{ nombre: string; estado: "subiendo" | "listo" | "error"; detalle?: string }[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [, accionArchivo] = useTransition();

  async function subir(lista: File[]) {
    if (!puedeEditar || lista.length === 0) return;
    setErrorArchivo("");
    const supabase = createClient();
    setSubidas(lista.map((f) => ({ nombre: f.name, estado: "subiendo" as const })));

    const resultado = [...lista.map(() => ({ estado: "subiendo" as "subiendo" | "listo" | "error", detalle: "" }))];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      const falla = (detalle: string) => {
        resultado[i] = { estado: "error", detalle };
      };
      if (EXTENSIONES_PROHIBIDAS.test(f.name)) falla("Ese tipo de archivo no se puede subir.");
      else if (f.size === 0) falla("El archivo esta vacio.");
      else if (f.size > TOPE_ARCHIVO_LEAD) falla("Pesa mas de 25 MB.");
      else {
        const ruta = `${idLead}/${crypto.randomUUID()}-${nombreSeguro(f.name)}`;
        const { error } = await supabase.storage
          .from(BUCKET_LEADS)
          .upload(ruta, f, { contentType: f.type || undefined, upsert: false });
        if (error) falla(error.message);
        else {
          const r = await registrarArchivoLead(idLead, ruta, f.name, f.type, f.size);
          if (r.ok) resultado[i] = { estado: "listo", detalle: "" };
          else falla(r.mensaje ?? "No se pudo registrar.");
        }
      }
      setSubidas(lista.map((x, j) => ({ nombre: x.name, ...resultado[j] })));
    }
    if (entrada.current) entrada.current.value = "";
    router.refresh();
  }

  async function abrir(id: number) {
    setErrorArchivo("");
    // La pestana se abre antes de pedir el enlace: si no, el navegador la toma
    // por una ventana emergente y la bloquea.
    const ventana = window.open("", "_blank");
    const r = await urlArchivoLead(id);
    if (r.url && ventana) ventana.location.href = r.url;
    else {
      ventana?.close();
      setErrorArchivo(r.error ?? "No se pudo abrir el archivo.");
    }
  }

  function quitar(id: number) {
    setErrorArchivo("");
    accionArchivo(async () => {
      const r = await quitarArchivoLead(id, idLead);
      setConfirmando(null);
      if (!r.ok) setErrorArchivo(r.mensaje ?? "No se pudo quitar.");
      else router.refresh();
    });
  }

  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden">
      <h2 className={TITULO}>
        <span>{titulo}</span>
        <span className="font-normal">{archivos.length}</span>
      </h2>

      {puedeEditar && (
        <div className="p-3 pb-0">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              subir(Array.from(e.dataTransfer.files));
            }}
            className={`rounded border border-dashed px-3 py-3 text-center text-[11px] ${
              arrastrando ? "border-verde bg-crema" : "border-gray-300 bg-gray-50"
            }`}
          >
            <p className="text-gray-700">Arrastre aqui planos, fotos, presupuestos o lo que mande el cliente, o</p>
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className="mt-1 bg-verde text-white text-[11px] font-semibold px-3 py-1 rounded"
            >
              Elegir archivos
            </button>
            <input
              ref={entrada}
              type="file"
              multiple
              className="sr-only"
              aria-label="Elegir archivos del lead"
              onChange={(e) => subir(Array.from(e.target.files ?? []))}
            />
            <p className="mt-1 text-[10px] text-gray-500">Hasta 25 MB por archivo.</p>
          </div>
          {subidas.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px]" aria-live="polite">
              {subidas.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="truncate">{s.nombre}</span>
                  <span
                    className={
                      s.estado === "error" ? "text-red-600" : s.estado === "listo" ? "text-green-700" : "text-gray-500"
                    }
                  >
                    {s.estado === "subiendo" ? "Subiendo..." : s.estado === "listo" ? "Listo" : s.detalle}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {errorArchivo && (
        <p className="px-3 pt-2 text-[11px] text-red-600" role="alert">
          {errorArchivo}
        </p>
      )}

      {archivos.length === 0 ? (
        <p className="px-3 py-4 text-center text-[11px] text-gray-400">{vacio}</p>
      ) : (
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-crema text-dorado-osc">
              <tr>
                <th className="text-left px-3 py-0.5">Archivo</th>
                <th className="text-right px-3 py-0.5 w-20">Peso</th>
                <th className="text-left px-3 py-0.5 w-40">Subido por</th>
                <th className="text-left px-3 py-0.5 w-24">Fecha</th>
                <th className="px-3 py-0.5 w-32" />
              </tr>
            </thead>
            <tbody>
              {archivos.map((a) => (
                <tr key={a.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-0.5">
                    <button type="button" onClick={() => abrir(a.id)} className="text-verde underline text-left break-all">
                      {a.nombre}
                    </button>
                  </td>
                  <td className="px-3 py-0.5 text-right tabular-nums whitespace-nowrap">{peso(a.tamano)}</td>
                  <td className="px-3 py-0.5">{a.vendedor}</td>
                  <td className="px-3 py-0.5 whitespace-nowrap">{fecha(a.creado_en.slice(0, 10))}</td>
                  <td className="px-3 py-0.5 text-right whitespace-nowrap">
                    {puedeEditar &&
                      (esAdmin || a.id_vendedor === yo) &&
                      (confirmando === a.id ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-gray-700">¿Quitar?</span>
                          <button
                            type="button"
                            onClick={() => quitar(a.id)}
                            className="border border-red-300 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white"
                          >
                            Si
                          </button>
                          <button type="button" onClick={() => setConfirmando(null)} className={BOTON_CLARO}>
                            No
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmando(a.id)} className="text-red-700 underline">
                          Quitar
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
