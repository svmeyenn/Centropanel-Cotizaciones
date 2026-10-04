"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  abrirCorrida,
  cerrarCorrida,
  guardarLote,
  guardarLoteLeads,
  guardarLoteOportunidades,
  type TablaClientify,
} from "@/app/leads/acciones";
import { leadsDeHoja } from "@/lib/importarLeads";
import { esPlanillaDeOportunidades, oportunidadesDeHoja } from "@/lib/importarOportunidades";

const LOTE = 100;

// Sube a la base la lista de contactos de Clientify desde un archivo (.json o .xlsx). Se hace
// de a lotes desde el navegador: un solo envio con los 6.000 superaria el tope
// de tamano de la peticion, y asi ademas se ve el avance.
export default function CargarContactosClientify() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const trabajando = avance !== null;

  // La planilla (.xlsx) que se descarga de Clientify: agrega los leads que faltan
  // y completa los que ya estan, sin borrar nada.
  // La planilla de oportunidades: completa las que ya estan y agrega las que
  // faltan, con su etapa y con por que se gano o se perdio.
  async function cargarOportunidades(filas: unknown[][]) {
    const r = oportunidadesDeHoja(filas);
    if (r.error) {
      setMensaje({ texto: r.error, error: true });
      return;
    }
    const lista = r.oportunidades;
    if (lista.length === 0) {
      setMensaje({ texto: "La planilla no trae oportunidades.", error: true });
      return;
    }
    setAvance({ hechos: 0, total: lista.length });
    let nuevas = 0;
    let actualizadas = 0;
    for (let i = 0; i < lista.length; i += 200) {
      const x = await guardarLoteOportunidades(lista.slice(i, i + 200));
      if (x.error) {
        setAvance(null);
        setMensaje({ texto: x.error, error: true });
        return;
      }
      nuevas += x.nuevas ?? 0;
      actualizadas += x.actualizadas ?? 0;
      setAvance({ hechos: Math.min(i + 200, lista.length), total: lista.length });
    }
    setAvance(null);
    setMensaje({
      texto: `Listo: ${nuevas} oportunidades nuevas y ${actualizadas} al dia.`,
      error: false,
    });
    router.refresh();
  }

  async function cargarPlanilla(archivo: File) {
    setMensaje(null);
    let leads;
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const filas = (await readSheet(archivo)) as unknown[][];
      // El mismo boton sirve para las dos planillas del CRM: se reconocen por
      // sus columnas.
      if (esPlanillaDeOportunidades(filas)) return cargarOportunidades(filas);
      const r = leadsDeHoja(filas);
      if (r.error) {
        setMensaje({ texto: r.error, error: true });
        return;
      }
      leads = r.leads;
    } catch {
      setMensaje({ texto: "No se pudo leer la planilla. Verifique que sea un archivo .xlsx.", error: true });
      return;
    }
    if (leads.length === 0) {
      setMensaje({ texto: "La planilla no trae contactos.", error: true });
      return;
    }
    setAvance({ hechos: 0, total: leads.length });
    const corrida = await abrirCorrida();
    if (corrida.error || !corrida.id || !corrida.inicio) {
      setAvance(null);
      setMensaje({ texto: corrida.error ?? "No se pudo iniciar la importacion.", error: true });
      return;
    }
    let nuevos = 0;
    let actualizados = 0;
    for (let i = 0; i < leads.length; i += 200) {
      const r = await guardarLoteLeads(corrida.inicio, leads.slice(i, i + 200));
      if (r.error) {
        await cerrarCorrida(corrida.id, corrida.inicio, nuevos + actualizados, null, r.error);
        setAvance(null);
        setMensaje({ texto: r.error, error: true });
        return;
      }
      nuevos += r.nuevos ?? 0;
      actualizados += r.actualizados ?? 0;
      setAvance({ hechos: Math.min(i + 200, leads.length), total: leads.length });
    }
    // Sin cantidad esperada: la planilla nunca quita leads.
    const cierre = await cerrarCorrida(corrida.id, corrida.inicio, nuevos + actualizados, null);
    setAvance(null);
    setMensaje(
      cierre.error
        ? { texto: cierre.error, error: true }
        : {
            texto: `Listo: ${nuevos} leads nuevos y ${actualizados} al dia; ${cierre.enlazados ?? 0} enlazados con su cliente.`,
            error: false,
          }
    );
    router.refresh();
  }

  async function cargar(archivo: File) {
    if (/\.xlsx$/i.test(archivo.name)) return cargarPlanilla(archivo);
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
            texto: `Listo: ${cierre.leidos} contactos, ${leidos.oportunidades} oportunidades y ${actividad.length} contactos con conversacion; ${cierre.quitados} contactos quitados por ya no estar en el archivo; ${cierre.enlazados ?? 0} leads enlazados con su cliente.`,
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
        accept=".json,application/json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
        {trabajando ? "Importando..." : "Importar desde Clientify"}
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
