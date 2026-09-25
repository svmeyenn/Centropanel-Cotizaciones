"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buscarInterlocutores, type Interlocutor } from "@/lib/finanzas/tipos";
import FormularioInterlocutor from "./FormularioInterlocutor";

const MAX_SUGERENCIAS = 8;

// Campo unico de origen/destino: se escribe dentro del mismo campo y la lista
// se va acotando con lo tecleado. Lo que viaja al servidor es el id, nunca el
// texto: el nombre lo resuelve el servidor desde la base.
//
// Si no esta en la lista se crea aqui mismo, sin perder lo que se llevaba
// escrito del movimiento.
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

  const [nuevos, setNuevos] = useState<Interlocutor[]>([]);
  const [elegido, setElegido] = useState<number | null>(
    inicial?.id_interlocutor ?? null
  );
  const [texto, setTexto] = useState(inicial?.nombre_referencia ?? "");
  const [abierto, setAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const todos = useMemo(() => [...nuevos, ...disponibles], [nuevos, disponibles]);

  const filtrados = useMemo(
    () => buscarInterlocutores(todos, texto),
    [todos, texto]
  );

  const seleccionado = todos.find((i) => i.id_interlocutor === elegido) ?? null;
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
      <label className="block text-xs font-semibold text-dorado-osc mb-0.5">
        {etiqueta} *
      </label>

      <input type="hidden" name="id_interlocutor" value={valido ? elegido! : ""} />

      <input
        className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white"
        value={texto}
        placeholder="Escriba para buscar"
        autoComplete="off"
        onChange={(e) => {
          setTexto(e.target.value);
          setElegido(null);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
      />

      {!valido && texto.trim() !== "" && !abierto && (
        <p className="text-[11px] text-red-700 mt-0.5">
          Elija uno de la lista: no basta con escribir el nombre.
        </p>
      )}

      {abierto && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-64 overflow-y-auto">
          {filtrados.slice(0, MAX_SUGERENCIAS).map((i) => (
            <button
              key={i.id_interlocutor}
              type="button"
              className="block w-full text-left px-2 py-1.5 text-xs hover:bg-crema border-b border-gray-100 last:border-0"
              onClick={() => elegir(i)}
            >
              <span className="font-semibold">{i.nombre_referencia}</span>
              {i.razon_social !== i.nombre_referencia && (
                <span className="text-gray-500"> - {i.razon_social}</span>
              )}
            </button>
          ))}

          {filtrados.length > MAX_SUGERENCIAS && (
            <p className="px-2 py-1 text-[11px] text-gray-500">
              y {filtrados.length - MAX_SUGERENCIAS} mas: siga escribiendo para
              acotar
            </p>
          )}

          {filtrados.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-gray-500">
              Ninguno coincide con «{texto}».
            </p>
          )}

          <button
            type="button"
            className="block w-full text-left px-2 py-1.5 text-xs font-semibold text-verde border-t border-gray-200 hover:bg-crema"
            onClick={() => {
              setAbierto(false);
              setCreando(true);
            }}
          >
            + Crear{texto.trim() ? ` «${texto.trim()}»` : " uno nuevo"}
          </button>
        </div>
      )}

      {/* La ficha sale por un portal: este campo vive dentro del formulario
          del movimiento, y un formulario dentro de otro no es HTML valido. */}
      {creando &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded shadow-lg w-full max-w-3xl my-6">
              <div className="bg-verde text-white px-4 py-3 rounded-t">
                <div className="text-sm font-semibold">Nuevo interlocutor</div>
                <div className="text-[11px] text-white/80">
                  Queda disponible de inmediato para este movimiento
                </div>
              </div>
              <div className="p-4">
                <FormularioInterlocutor
                  interlocutor={null}
                  cuentas={[]}
                  nombreSugerido={texto.trim()}
                  alCancelar={() => setCreando(false)}
                  alGuardar={(id, nombre) => {
                    const creado: Interlocutor = {
                      id_interlocutor: id,
                      id_pais: 0,
                      razon_social: nombre,
                      nombre_referencia: nombre,
                      rut: null,
                      con_transferencia: false,
                      borrado: false,
                    };
                    setNuevos((n) => [creado, ...n]);
                    setElegido(id);
                    setTexto(nombre);
                    setCreando(false);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
