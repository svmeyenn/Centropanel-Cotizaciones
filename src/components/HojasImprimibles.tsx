"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

// Reparte la cotizacion en hojas al imprimir. El navegador corta solo donde se
// acaba el papel y la segunda hoja salia sin cabecera; aqui se miden las partes
// al ancho del papel y se arma cada hoja con su cabecera, el folio y
// "(Pagina n de m)" cuando hay mas de una. En pantalla se ve el documento entero.

const PaginaCtx = createContext<{ n: number; de: number } | null>(null);

// Va junto al folio; no dibuja nada si el documento cabe en una hoja.
export function NumeroPagina() {
  const p = useContext(PaginaCtx);
  if (!p || p.de < 2) return null;
  return (
    <span className="ml-1.5 text-[11px] font-normal align-middle">
      (Página {p.n} de {p.de})
    </span>
  );
}

// Carta a 96 ppp mide 816 x 1056 px. La hoja lleva 14 mm de margen por lado
// (unos 53 px), y se dejan 8 px de holgura por si el navegador redondea distinto.
const ANCHO_UTIL = 816 - 2 * 53;
const ALTO_UTIL = 1056 - 2 * 53 - 8;

type Hoja = { filas: number[]; cola: number[] };

export default function HojasImprimibles({
  cabecera,
  datos,
  encabezado,
  filas,
  cola,
}: {
  cabecera: ReactNode;
  // Cliente, ejecutivo y distintivo: solo en la primera hoja.
  datos: ReactNode;
  // La fila de titulos de la tabla y sus filas, ya armadas.
  encabezado: ReactNode;
  filas: ReactNode[];
  // Lo que sigue a la tabla (totales, condiciones), en el orden en que va.
  cola: ReactNode[];
}) {
  const medidor = useRef<HTMLDivElement>(null);
  const [hojas, setHojas] = useState<Hoja[] | null>(null);

  useEffect(() => {
    const calcular = () => {
      const m = medidor.current;
      if (!m) return;
      const alto = (sel: string) => (m.querySelector(sel) as HTMLElement | null)?.offsetHeight ?? 0;
      const hCab = alto("[data-parte=cabecera]");
      const hDatos = alto("[data-parte=datos]");
      const hFilas = Array.from(m.querySelectorAll("[data-parte=tabla] tbody > tr")).map((f) => (f as HTMLElement).offsetHeight);
      // Titulos de la tabla y su margen: lo que mide la tabla sin sus filas.
      const hTabla = alto("[data-parte=tabla]") - hFilas.reduce((a, b) => a + b, 0);
      const hCola = Array.from(m.querySelectorAll("[data-parte=cola]")).map((c) => (c as HTMLElement).offsetHeight);

      const out: Hoja[] = [];
      let act: Hoja = { filas: [], cola: [] };
      let usado = hCab + hDatos + hTabla;
      hFilas.forEach((h, i) => {
        if (usado + h > ALTO_UTIL && act.filas.length > 0) {
          out.push(act);
          act = { filas: [], cola: [] };
          usado = hCab + hTabla;
        }
        act.filas.push(i);
        usado += h;
      });
      hCola.forEach((h, i) => {
        if (usado + h > ALTO_UTIL && (act.filas.length > 0 || act.cola.length > 0)) {
          out.push(act);
          act = { filas: [], cola: [] };
          usado = hCab;
        }
        act.cola.push(i);
        usado += h;
      });
      out.push(act);
      flushSync(() => setHojas(out));
    };

    let vivo = true;
    (document.fonts?.ready ?? Promise.resolve()).then(() => vivo && calcular());
    window.addEventListener("beforeprint", calcular);
    return () => {
      vivo = false;
      window.removeEventListener("beforeprint", calcular);
    };
  }, []);

  const tabla = (indices: number[]) => (
    <table className="w-full table-fixed text-[11px] mb-5">
      <thead>{encabezado}</thead>
      <tbody>{indices.map((i) => filas[i])}</tbody>
    </table>
  );
  const todas = filas.map((_, i) => i);

  return (
    <>
      {/* En pantalla, y al imprimir mientras no se hayan medido las hojas. */}
      <div className={`mx-auto bg-white text-[#1A1A1A] p-10 max-w-[820px] print:max-w-none print:p-[14mm] ${hojas ? "print:hidden" : ""}`}>
        {cabecera}
        {datos}
        {tabla(todas)}
        {cola.map((c, i) => (
          <div key={i} className="flow-root">{c}</div>
        ))}
      </div>

      {hojas && (
        <div className="hidden print:block">
          {hojas.map((h, i) => (
            <PaginaCtx.Provider key={i} value={{ n: i + 1, de: hojas.length }}>
              <div
                className="bg-white text-[#1A1A1A] p-[14mm]"
                style={{ breakAfter: i < hojas.length - 1 ? "page" : "auto" }}
              >
                {cabecera}
                {i === 0 && datos}
                {(i === 0 || h.filas.length > 0) && tabla(h.filas)}
                {h.cola.map((k) => (
                  <div key={k} className="flow-root">{cola[k]}</div>
                ))}
              </div>
            </PaginaCtx.Provider>
          ))}
        </div>
      )}

      {/* Medidor: las mismas partes al ancho util del papel, fuera de la vista. */}
      <div
        ref={medidor}
        aria-hidden
        className="print:hidden text-[#1A1A1A]"
        style={{ position: "fixed", left: -10000, top: 0, width: ANCHO_UTIL, visibility: "hidden", pointerEvents: "none" }}
      >
        <div data-parte="cabecera" className="flow-root">{cabecera}</div>
        <div data-parte="datos" className="flow-root">{datos}</div>
        <div data-parte="tabla" className="flow-root">{tabla(todas)}</div>
        {cola.map((c, i) => (
          <div key={i} data-parte="cola" className="flow-root">{c}</div>
        ))}
      </div>
    </>
  );
}
