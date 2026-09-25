"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buscarInterlocutores, type Interlocutor } from "@/lib/finanzas/tipos";

const MAX_SUGERENCIAS = 8;

// Campo unico de origen/destino: se escribe dentro del mismo campo y la lista
// se va acotando con lo tecleado. Lo que viaja al servidor es el id, nunca el
// texto: el nombre lo resuelve el servidor desde la base.
//
// Crear uno nuevo todavia no se puede desde aqui; eso llega con la pantalla de
// cuentas, proyectos y categorias.
export default function SelectorInterlocutor({
  interlocutores,
  valorInicial,
  etiqueta,
}: {
  interlocutores: Interlocutor[];
  valorInicial: number | null;
  etiqueta: string;
}) {
  // Los borrados no se ofrecen, salvo el que este movimiento ya tenia: editarlo
  // no puede obligar a cambiarle el origen.
  const disponibles = useMemo(
    () =>
      interlocutores.filter(
        (i) => !i.borrado || i.id_interlocutor === valorInicial
      ),
    [interlocutores, valorInicial]
  );

  const inicial =
    disponibles.find((i) => i.id_interlocutor === valorInicial) ?? null;

  const [elegido, setElegido] = useState<number | null>(
    inicial?.id_interlocutor ?? null
  );
  const [texto, setTexto] = useState(inicial?.nombre_referencia ?? "");
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const filtrados = useMemo(
    () => buscarInterlocutores(disponibles, texto),
    [disponibles, texto]
  );

  const seleccionado =
    disponibles.find((i) => i.id_interlocutor === elegido) ?? null;
  // Si se toco el texto despues de elegir, la seleccion ya no corresponde.
  const valido =
    seleccionado !== null && seleccionado.nombre_referencia === texto;

  function elegir(i: Interlocutor) {
    setElegido(i.id_interlocutor);
    setTexto(i.nombre_referencia);
    setAbierto(false);
  }

  return (
    <div ref={caja} className="relative">
      <label className="etiqueta">{etiqueta} *</label>

      <input type="hidden" name="id_interlocutor" value={valido ? elegido! : ""} />

      <input
        className="campo"
        value={texto}
        placeholder="Escriba para buscar..."
        autoComplete="off"
        onChange={(e) => {
          setTexto(e.target.value);
          setElegido(null);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
      />

      {!valido && texto.trim() !== "" && !abierto && (
        <p className="text-xs text-red-700 mt-1">
          Elija uno de la lista: no basta con escribir el nombre.
        </p>
      )}

      {abierto && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gris-suave rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {filtrados.slice(0, MAX_SUGERENCIAS).map((i) => (
            <button
              key={i.id_interlocutor}
              type="button"
              className="block w-full text-left px-3 py-2 text-sm hover:bg-crema border-b border-gris-suave last:border-0"
              onClick={() => elegir(i)}
            >
              <span className="font-medium">{i.nombre_referencia}</span>
              {i.razon_social !== i.nombre_referencia && (
                <span className="text-gris text-xs"> — {i.razon_social}</span>
              )}
            </button>
          ))}

          {filtrados.length > MAX_SUGERENCIAS && (
            <p className="px-3 py-1 text-xs text-gris">
              y {filtrados.length - MAX_SUGERENCIAS} mas: siga escribiendo para
              acotar
            </p>
          )}

          {filtrados.length === 0 && (
            <p className="px-3 py-2 text-xs text-gris">
              Ninguno coincide con «{texto}».
            </p>
          )}
        </div>
      )}
    </div>
  );
}
