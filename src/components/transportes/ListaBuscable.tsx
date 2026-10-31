"use client";

import { useId, useMemo, useRef, useState } from "react";

interface Opcion {
  id: number;
  texto: string;
}

// Sin tildes ni mayusculas, para que "castillo transp" encuentre "Alfredo Castillo Transporte".
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Elegir una opcion escribiendo: cada palabra escrita debe aparecer en el nombre, en cualquier orden y posicion.
export default function ListaBuscable({
  etiqueta,
  opciones,
  valor,
  onChange,
  placeholder = "Escribir para buscar",
}: {
  etiqueta: string;
  opciones: Opcion[];
  valor: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}) {
  const idLista = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  const elegida = opciones.find((o) => o.id === valor) ?? null;
  const visibles = useMemo(() => {
    const palabras = normal(texto).split(/\s+/).filter(Boolean);
    return opciones.filter((o) => {
      const n = normal(o.texto);
      return palabras.every((p) => n.includes(p));
    });
  }, [texto, opciones]);

  function elegir(o: Opcion) {
    onChange(o.id);
    setTexto("");
    setAbierto(false);
  }

  return (
    <div
      ref={raiz}
      className="relative"
      onBlur={(e) => {
        if (!raiz.current?.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}
    >
      <div className="flex items-center gap-1">
        <input
          role="combobox"
          aria-label={etiqueta}
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white w-72"
          placeholder={elegida ? elegida.texto : placeholder}
          value={abierto || !elegida ? texto : elegida.texto}
          onFocus={() => setAbierto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(0);
            setAbierto(true);
            if (valor != null) onChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAbierto(true);
              setActivo((a) => Math.min(a + 1, visibles.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && abierto && visibles[activo]) {
              e.preventDefault();
              elegir(visibles[activo]);
            } else if (e.key === "Escape") setAbierto(false);
          }}
        />
        {elegida && (
          <button type="button" aria-label="Quitar la seleccion" className="text-gray-500 px-1" onClick={() => { onChange(null); setTexto(""); }}>
            ×
          </button>
        )}
      </div>
      {abierto && (
        <ul id={idLista} role="listbox" className="absolute z-20 mt-1 max-h-56 w-72 overflow-auto rounded border border-gray-300 bg-white shadow text-xs">
          {visibles.length === 0 && <li className="px-2 py-2 text-gray-500">Nada coincide con lo escrito.</li>}
          {visibles.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === valor}
              tabIndex={-1}
              className={`cursor-pointer px-2 py-1.5 ${i === activo ? "bg-crema" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(o)}
            >
              {o.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
