"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  abrirCorrida,
  cerrarCorrida,
  guardarLote,
  type TablaClientify,
} from "@/app/clientify/acciones";

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
    let contactos: unknown[];
    let oportunidades: unknown[] = [];
    let actividad: unknown[] = [];
    let esperados: number | null = null;
    let opEsperadas: number | null = null;
    try {
      const datos = JSON.parse(await archivo.text());
      if (Array.isArray(datos)) {
        contactos = datos;
      } else if (datos && Array.isArray(datos.contactos)) {
        contactos = datos.contactos;
        esperados = Number.isInteger(datos.total) ? datos.total : null;
        if (Array.isArray(datos.oportunidades)) {
          oportunidades = datos.oportunidades;
          opEsperadas = Number.isInteger(datos.total_oportunidades)
            ? datos.total_oportunidades
            : null;
        }
        if (Array.isArray(datos.actividad)) actividad = datos.actividad;
      } else {
        throw new Error("formato");
      }
    } catch {
      setMensaje({ texto: "El archivo no es una lista de contactos valida.", error: true });
      return;
    }
    if (contactos.length === 0) {
      setMensaje({ texto: "El archivo no trae contactos.", error: true });
      return;
    }

    const total = contactos.length + oportunidades.length + actividad.length;
    setAvance({ hechos: 0, total });
    const corrida = await abrirCorrida();
    if (corrida.error || !corrida.id || !corrida.inicio) {
      setAvance(null);
      setMensaje({ texto: corrida.error ?? "No se pudo iniciar la carga.", error: true });
      return;
    }

    // Contactos, luego oportunidades, luego conversaciones: cada grupo va en
    // lotes y el avance cuenta todo junto.
    const grupos: { tabla: TablaClientify; filas: unknown[] }[] = [
      { tabla: "contactos", filas: contactos },
      { tabla: "oportunidades", filas: oportunidades },
      { tabla: "actividad", filas: actividad },
    ];
    let hechos = 0;
    const leidos = { contactos: 0, oportunidades: 0 };
    for (const g of grupos) {
      const lote = g.tabla === "actividad" ? 20 : LOTE;
      for (let i = 0; i < g.filas.length; i += lote) {
        const trozo = g.filas.slice(i, i + lote);
        const r = await guardarLote(corrida.inicio, trozo, g.tabla);
        if (r.error) {
          await cerrarCorrida(corrida.id, corrida.inicio, leidos.contactos, null, r.error);
          setAvance(null);
          setMensaje({ texto: `Se detuvo en ${g.tabla}: ${r.error}`, error: true });
          router.refresh();
          return;
        }
        if (g.tabla === "contactos") leidos.contactos += r.guardados ?? 0;
        if (g.tabla === "oportunidades") leidos.oportunidades += r.guardados ?? 0;
        hechos += trozo.length;
        setAvance({ hechos, total });
      }
    }

    const cierre = await cerrarCorrida(
      corrida.id,
      corrida.inicio,
      leidos.contactos,
      esperados,
      undefined,
      opEsperadas ? { leidas: leidos.oportunidades, esperadas: opEsperadas } : undefined
    );
    setAvance(null);
    setMensaje(
      cierre.error
        ? { texto: cierre.error, error: true }
        : {
            texto: `Listo: ${cierre.leidos} contactos, ${leidos.oportunidades} oportunidades y ${actividad.length} contactos con conversacion; ${cierre.quitados} contactos quitados por ya no estar en Clientify; ${cierre.enlazados ?? 0} leads enlazados con su cliente.`,
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
