"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { abrirCorrida, cerrarCorrida, guardarLote } from "@/app/clientify/acciones";

const LOTE = 100;

// Sube a la base la lista de contactos de Clientify desde un archivo. Se hace
// de a lotes desde el navegador: un solo envio con los 6.000 superaria el tope
// de tamano de la peticion, y asi ademas se ve el avance.
export default function CargarContactosClientify() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const trabajando = avance !== null;

  async function cargar(archivo: File) {
    setMensaje(null);
    let filas: unknown[];
    let esperados: number | null = null;
    try {
      const datos = JSON.parse(await archivo.text());
      if (Array.isArray(datos)) {
        filas = datos;
      } else if (datos && Array.isArray(datos.contactos)) {
        filas = datos.contactos;
        esperados = Number.isInteger(datos.total) ? datos.total : null;
      } else {
        throw new Error("formato");
      }
    } catch {
      setMensaje({ texto: "El archivo no es una lista de contactos valida.", error: true });
      return;
    }
    if (filas.length === 0) {
      setMensaje({ texto: "El archivo no trae contactos.", error: true });
      return;
    }

    setAvance({ hechos: 0, total: filas.length });
    const corrida = await abrirCorrida();
    if (corrida.error || !corrida.id || !corrida.inicio) {
      setAvance(null);
      setMensaje({ texto: corrida.error ?? "No se pudo iniciar la carga.", error: true });
      return;
    }

    let hechos = 0;
    for (let i = 0; i < filas.length; i += LOTE) {
      const r = await guardarLote(corrida.inicio, filas.slice(i, i + LOTE));
      if (r.error) {
        await cerrarCorrida(corrida.id, corrida.inicio, hechos, null, r.error);
        setAvance(null);
        setMensaje({
          texto: `Se detuvo despues de ${hechos} contactos: ${r.error}`,
          error: true,
        });
        router.refresh();
        return;
      }
      hechos += r.guardados ?? 0;
      setAvance({ hechos, total: filas.length });
    }

    const cierre = await cerrarCorrida(corrida.id, corrida.inicio, hechos, esperados);
    setAvance(null);
    setMensaje(
      cierre.error
        ? { texto: cierre.error, error: true }
        : {
            texto: `Listo: ${cierre.leidos} contactos cargados, ${cierre.quitados} quitados por ya no estar en Clientify.`,
            error: false,
          }
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={entrada}
        id="archivo-contactos"
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) cargar(archivo);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => entrada.current?.click()}
        disabled={trabajando}
        className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
      >
        {trabajando ? "Cargando..." : "Cargar archivo de contactos"}
      </button>
      {avance && (
        <span className="text-xs text-gray-600" role="status">
          {avance.hechos.toLocaleString("es-CL")} de {avance.total.toLocaleString("es-CL")}
        </span>
      )}
      {mensaje && (
        <span
          className={`text-xs ${mensaje.error ? "text-red-600" : "text-green-700"}`}
          role="status"
        >
          {mensaje.texto}
        </span>
      )}
    </div>
  );
}
