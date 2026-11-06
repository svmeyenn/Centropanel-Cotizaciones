"use client";

import { useState, type DragEvent, type KeyboardEvent } from "react";

// Reordenar las lineas de una tabla arrastrandolas. Se toma la fila por su asa (no por toda la fila, para que los
// campos de la linea se sigan pudiendo seleccionar y escribir) y se suelta sobre otra: la linea queda en ese lugar.
// Con el teclado, el asa enfocada sube y baja la linea con las flechas.
export function useArrastrarFilas(mover: (desde: number, hasta: number) => void, total: number) {
  const [desde, setDesde] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  function limpiar() {
    setDesde(null);
    setSobre(null);
  }

  const fila = (i: number) => ({
    onDragOver: (e: DragEvent<HTMLTableRowElement>) => {
      if (desde == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (sobre !== i) setSobre(i);
    },
    onDrop: (e: DragEvent<HTMLTableRowElement>) => {
      e.preventDefault();
      if (desde != null && desde !== i) mover(desde, i);
      limpiar();
    },
    // Linea de destino marcada arriba o abajo segun hacia donde se mueve; la que se arrastra, atenuada.
    className:
      desde === i
        ? "opacity-40"
        : sobre === i && desde != null
          ? desde < i
            ? "shadow-[inset_0_-2px_0_0_#1D4E4A]"
            : "shadow-[inset_0_2px_0_0_#1D4E4A]"
          : "",
  });

  const asa = (i: number) => ({
    draggable: true,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `Mover la linea ${i + 1}: arrastre, o use las flechas arriba y abajo`,
    title: "Arrastre para cambiar el orden",
    onDragStart: (e: DragEvent<HTMLSpanElement>) => {
      setDesde(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
      const tr = e.currentTarget.closest("tr");
      if (tr) e.dataTransfer.setDragImage(tr, 20, 12);
    },
    onDragEnd: limpiar,
    onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === "ArrowUp" && i > 0) {
        e.preventDefault();
        mover(i, i - 1);
      } else if (e.key === "ArrowDown" && i < total - 1) {
        e.preventDefault();
        mover(i, i + 1);
      }
    },
    className:
      "inline-flex items-center justify-center w-5 h-6 cursor-grab active:cursor-grabbing text-gray-400 hover:text-verde rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-verde select-none",
  });

  return { fila, asa };
}

// Mueve un elemento de una posicion a otra en una copia del arreglo.
export function moverEn<T>(lista: T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  const [x] = copia.splice(desde, 1);
  copia.splice(hasta, 0, x);
  return copia;
}

// Seis puntos: el icono habitual de "tomar y arrastrar".
export function IconoAsa() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" fill="currentColor">
      <circle cx="2.5" cy="3" r="1.5" />
      <circle cx="7.5" cy="3" r="1.5" />
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="7.5" cy="8" r="1.5" />
      <circle cx="2.5" cy="13" r="1.5" />
      <circle cx="7.5" cy="13" r="1.5" />
    </svg>
  );
}
