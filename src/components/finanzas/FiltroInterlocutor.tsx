"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buscarInterlocutores,
  etiquetaInterlocutor,
  type Interlocutor,
} from "@/lib/finanzas/tipos";

// Filtro de origen/destino. Filtra de dos maneras, y por eso son dos
// parametros distintos en la direccion:
//
//   - destino=<texto>: todos los que coincidan. Escribir "termo" trae
//     Termoaislante, Supertermo y cualquier otro, en un solo listado.
//   - interlocutor=<id>: uno solo, el que se eligio de la lista.
//
// No se pueden unificar. Si al elegir "Sodimac" se guardara su texto, el
// filtro traeria tambien a "Sodimex", que se le parece lo suficiente como para
// coincidir. Elegir uno tiene que significar exactamente ese.
export default function FiltroInterlocutor({
  interlocutores,
  valorId,
  valorTexto,
}: {
  interlocutores: Interlocutor[];
  valorId: string;
  valorTexto: string;
}) {
  const elegidoInicial =
    interlocutores.find((i) => String(i.id_interlocutor) === valorId) ?? null;

  const [elegido, setElegido] = useState<number | null>(
    elegidoInicial?.id_interlocutor ?? null
  );
  const [texto, setTexto] = useState(
    elegidoInicial
      ? etiquetaInterlocutor(
          elegidoInicial.razon_social,
          elegidoInicial.nombre_referencia
        )
      : valorTexto
  );
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLLabelElement>(null);

  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();

  // Se navega al aceptar, no al teclear: escribir solo acota la lista.
  function aplicar(clave: "interlocutor" | "destino" | null, valor?: string) {
    const nuevo = new URLSearchParams(params.toString());
    nuevo.delete("interlocutor");
    nuevo.delete("destino");
    if (clave && valor) nuevo.set(clave, valor);
    const cola = nuevo.toString();
    router.push(cola ? `${ruta}?${cola}` : ruta);
  }

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const disponibles = useMemo(
    () => interlocutores.filter((i) => !i.borrado || i.id_interlocutor === elegido),
    [interlocutores, elegido]
  );

  const filtrados = useMemo(
    () => (elegido !== null ? disponibles : buscarInterlocutores(disponibles, texto)),
    [disponibles, texto, elegido]
  );

  const consulta = texto.trim();

  function limpiar() {
    setElegido(null);
    setTexto("");
    aplicar(null);
  }

  function verTodosLosQueCoinciden() {
    if (consulta === "") return;
    setElegido(null);
    setAbierto(false);
    aplicar("destino", consulta);
  }

  function elegirUno(i: Interlocutor) {
    setElegido(i.id_interlocutor);
    setTexto(etiquetaInterlocutor(i.razon_social, i.nombre_referencia));
    setAbierto(false);
    aplicar("interlocutor", String(i.id_interlocutor));
  }

  return (
    <label className="text-xs relative" ref={caja}>
      <span className="block text-dorado-osc font-semibold mb-0.5">
        Origen / Destino
      </span>

      <div className="relative">
        <input
          className="border border-gray-300 rounded px-2 py-1 pr-6 text-xs w-full bg-white"
          value={texto}
          placeholder="Todos"
          autoComplete="off"
          onChange={(e) => {
            setTexto(e.target.value);
            setElegido(null);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              verTodosLosQueCoinciden();
            }
          }}
        />
        {texto !== "" && (
          <button
            type="button"
            aria-label="Quitar el filtro de origen o destino"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 leading-none"
            onClick={limpiar}
          >
            ×
          </button>
        )}
      </div>

      {valorTexto && !abierto && (
        <span className="block text-[10px] text-gray-500 mt-0.5">
          Todos los que coinciden con «{valorTexto}».
        </span>
      )}

      {abierto && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-72 overflow-y-auto">
          <button
            type="button"
            className="block w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-crema border-b border-gray-100"
            onClick={() => {
              limpiar();
              setAbierto(false);
            }}
          >
            Todos
          </button>

          {consulta !== "" && filtrados.length > 0 && (
            <button
              type="button"
              className="block w-full text-left px-2 py-1.5 text-xs font-semibold text-verde hover:bg-crema border-b border-gray-100"
              onClick={verTodosLosQueCoinciden}
            >
              Todos los que coincidan con «{consulta}» ({filtrados.length})
            </button>
          )}

          {/* Sin tope: son decenas, no miles, y la caja ya hace scroll. Un tope
              aqui esconderia justo lo que se esta buscando. */}
          {filtrados.map((i) => (
            <button
              key={i.id_interlocutor}
              type="button"
              className="block w-full text-left px-2 py-1.5 text-xs hover:bg-crema border-b border-gray-100 last:border-0"
              onClick={() => elegirUno(i)}
            >
              {etiquetaInterlocutor(i.razon_social, i.nombre_referencia)}
            </button>
          ))}

          {filtrados.length === 0 && (
            <span className="block px-2 py-1.5 text-xs text-gray-500">
              Ninguno coincide con «{texto}».
            </span>
          )}
        </div>
      )}
    </label>
  );
}
