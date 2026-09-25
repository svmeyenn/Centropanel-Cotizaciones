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
//
// Va aparte del formulario de filtros y se aplica solo: es el que mas se usa y
// no tiene por que arrastrar a los demas.
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
  const caja = useRef<HTMLDivElement>(null);

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
    <div ref={caja} className="relative">
      <label className="etiqueta">Origen / Destino</label>

      <div className="relative">
        <input
          className="campo pr-7"
          value={texto}
          placeholder="(todos) — escriba y presione Enter"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gris text-sm leading-none"
            onClick={limpiar}
          >
            ×
          </button>
        )}
      </div>

      {valorTexto && !abierto && (
        <p className="text-xs text-gris mt-1">
          Mostrando todos los que coinciden con «{valorTexto}».
        </p>
      )}

      {abierto && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gris-suave rounded-lg shadow-lg max-h-72 overflow-y-auto">
          <button
            type="button"
            className="block w-full text-left px-3 py-2 text-sm text-gris hover:bg-crema border-b border-gris-suave"
            onClick={() => {
              limpiar();
              setAbierto(false);
            }}
          >
            (todos)
          </button>

          {consulta !== "" && filtrados.length > 0 && (
            <button
              type="button"
              className="block w-full text-left px-3 py-2 text-sm font-medium text-celeste-borde hover:bg-crema border-b border-gris-suave"
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
              className="block w-full text-left px-3 py-2 text-sm hover:bg-crema border-b border-gris-suave last:border-0"
              onClick={() => elegirUno(i)}
            >
              {etiquetaInterlocutor(i.razon_social, i.nombre_referencia)}
            </button>
          ))}

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
