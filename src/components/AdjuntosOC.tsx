"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fecha } from "@/lib/formato";
import { EXTENSIONES_PROHIBIDAS } from "@/lib/leads";
import { BUCKET_OC, nombreSeguro } from "@/lib/finanzas/almacen";
import { quitarAdjuntoOC, registrarAdjuntoOC, urlAdjuntoOC } from "@/app/compras/acciones";

export interface AdjuntoOC {
  id: number;
  nombre: string;
  tamano: number | null;
  subido_en: string;
}

const TOPE = 25 * 1024 * 1024;

const peso = (b: number | null) =>
  b == null
    ? ""
    : b >= 1024 * 1024
      ? `${(b / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(b / 1024)).toLocaleString("es-CL")} KB`;

// Archivos de la orden: cotizacion del proveedor, orden firmada, guia, lo que respalde la compra. Sube el
// navegador directo al deposito privado; para abrirlos se pide un enlace que dura diez minutos.
export default function AdjuntosOC({ idOc, adjuntos, puedeEditar }: { idOc: number; adjuntos: AdjuntoOC[]; puedeEditar: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [pendiente, empezar] = useTransition();

  async function subir(lista: File[]) {
    if (!puedeEditar || lista.length === 0) return;
    setError("");
    setSubiendo(true);
    const supabase = createClient();
    const fallas: string[] = [];
    for (const f of lista) {
      if (EXTENSIONES_PROHIBIDAS.test(f.name)) fallas.push(`"${f.name}": ese tipo de archivo no se puede subir.`);
      else if (f.size === 0) fallas.push(`"${f.name}": el archivo esta vacio.`);
      else if (f.size > TOPE) fallas.push(`"${f.name}": pesa mas de 25 MB.`);
      else {
        const ruta = `ordenes/${idOc}/${crypto.randomUUID()}-${nombreSeguro(f.name)}`;
        const { error: e } = await supabase.storage.from(BUCKET_OC).upload(ruta, f, { contentType: f.type || undefined, upsert: false });
        if (e) fallas.push(`"${f.name}": ${e.message}`);
        else {
          const r = await registrarAdjuntoOC(idOc, { ruta, nombre: f.name, tipo_mime: f.type, tamano: f.size });
          if (r.error) fallas.push(`"${f.name}": ${r.error}`);
        }
      }
    }
    if (entrada.current) entrada.current.value = "";
    setSubiendo(false);
    if (fallas.length) setError(fallas.join(" "));
    router.refresh();
  }

  async function abrir(id: number) {
    setError("");
    // La pestana se abre antes de pedir el enlace: si no, el navegador la toma por ventana emergente.
    const ventana = window.open("", "_blank");
    const r = await urlAdjuntoOC(idOc, id);
    if (r.url && ventana) ventana.location.href = r.url;
    else {
      ventana?.close();
      setError(r.error ?? "No se pudo abrir el archivo.");
    }
  }

  function quitar(id: number) {
    setError("");
    empezar(async () => {
      const r = await quitarAdjuntoOC(idOc, id);
      setConfirmando(null);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <section className="bg-white border border-gray-200 rounded">
      <h2 className="bg-verde text-white text-[11px] font-semibold px-3 py-0.5 flex justify-between rounded-t">
        <span>ARCHIVOS ADJUNTOS</span>
        <span className="font-normal">{adjuntos.length}</span>
      </h2>
      <div className="p-3 space-y-2 text-xs">
        {puedeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={entrada}
              id="oc-adjuntos-archivo"
              type="file"
              multiple
              disabled={subiendo}
              className="text-xs"
              onChange={(e) => subir(Array.from(e.target.files ?? []))}
            />
            {subiendo && <span className="text-gray-500">Subiendo...</span>}
            <span className="text-gray-500">Hasta 25 MB por archivo.</span>
          </div>
        )}
        {error && <p className="text-red-700">{error}</p>}
        {adjuntos.length === 0 ? (
          <p className="text-gray-500">Esta orden no tiene archivos adjuntos.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {adjuntos.map((a) => (
              <li key={a.id} className="py-1.5 flex flex-wrap items-center gap-2">
                <button type="button" className="text-verde font-semibold underline text-left" onClick={() => abrir(a.id)}>
                  {a.nombre}
                </button>
                <span className="text-gray-500">
                  {peso(a.tamano)} · {fecha(a.subido_en)}
                </span>
                {puedeEditar &&
                  (confirmando === a.id ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-gray-600">quitar?</span>
                      <button type="button" className="text-red-700 font-semibold disabled:opacity-40" disabled={pendiente} onClick={() => quitar(a.id)}>
                        si
                      </button>
                      <button type="button" className="text-gray-600" onClick={() => setConfirmando(null)}>
                        no
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="text-gray-500 hover:text-red-700" onClick={() => setConfirmando(a.id)}>
                      quitar
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
