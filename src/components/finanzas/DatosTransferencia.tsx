"use client";

import { useState } from "react";
import Ventana from "@/components/Ventana";
import { pesos } from "@/lib/formato";
import {
  etiquetaInterlocutor,
  type CuentaInterlocutor,
  type Interlocutor,
  type Movimiento,
} from "@/lib/finanzas/tipos";

// Los datos con que se paga un egreso pendiente, uno al lado de su boton de
// copiar. En el formulario del banco se pega campo por campo --el RUT en el
// RUT, la cuenta en la cuenta--, asi que copiar todo junto no sirve de nada.
//
// Lo que se copia no siempre es lo que se muestra: el monto se ve como
// $1.234.567 y se copia 1234567, y el RUT se ve con puntos y se copia
// 12345678-9. Es lo que aceptan los formularios del banco.
export default function DatosTransferencia({
  movimiento,
  interlocutor,
  cuentas,
  alCerrar,
}: {
  movimiento: Movimiento;
  interlocutor: Interlocutor | null;
  cuentas: CuentaInterlocutor[];
  alCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);

  // El portapapeles moderno necesita permiso y contexto seguro, y hay
  // navegadores --o pestanas sin foco-- donde simplemente se niega. El
  // textarea con execCommand es feo pero funciona en todos, y aqui el trabajo
  // es justamente copiar: si falla, la pantalla no sirve para nada.
  async function copiar(clave: string, valor: string) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(valor);
      ok = true;
    } catch {
      try {
        const caja = document.createElement("textarea");
        caja.value = valor;
        caja.setAttribute("readonly", "");
        caja.style.position = "fixed";
        caja.style.opacity = "0";
        document.body.appendChild(caja);
        caja.select();
        ok = document.execCommand("copy");
        caja.remove();
      } catch {
        ok = false;
      }
    }
    setFalla(!ok);
    if (!ok) return;
    setCopiado(clave);
    setTimeout(() => setCopiado((x) => (x === clave ? null : x)), 1500);
  }

  // Sin puntos y con guion: es el formato que aceptan los formularios de los
  // bancos. Con puntos varios lo rechazan.
  const rutLimpio = (v: string | null) => {
    const d = (v ?? "").replace(/[^0-9kK]/gi, "").toUpperCase();
    if (d.length < 2) return d;
    return `${d.slice(0, -1)}-${d.slice(-1)}`;
  };

  const nombre = interlocutor
    ? etiquetaInterlocutor(
        interlocutor.razon_social,
        interlocutor.nombre_referencia
      )
    : (movimiento.origen_destino ?? "");

  const monto = String(Math.round(Number(movimiento.monto)));

  return (
    <Ventana
      titulo="Datos para transferir"
      subtitulo={nombre}
      onCerrar={alCerrar}
      ancho="max-w-xl"
    >
      <div className="space-y-1.5">
        <Dato
          rotulo="Destinatario"
          muestra={interlocutor?.razon_social ?? nombre}
          copia={interlocutor?.razon_social ?? nombre}
          copiado={copiado}
          copiar={copiar}
        />
        <Dato
          rotulo="RUT"
          muestra={interlocutor?.rut ?? "sin RUT"}
          copia={rutLimpio(interlocutor?.rut ?? null)}
          copiado={copiado}
          copiar={copiar}
        />
        <Dato
          rotulo="Monto"
          muestra={pesos(movimiento.monto)}
          copia={monto}
          copiado={copiado}
          copiar={copiar}
        />
        {movimiento.documento && (
          <Dato
            rotulo="Documento"
            muestra={movimiento.documento}
            copia={movimiento.documento}
            copiado={copiado}
            copiar={copiar}
          />
        )}

        {cuentas.length === 0 ? (
          <p className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded px-3 py-2 mt-2">
            Este destinatario no tiene cuenta bancaria registrada. Cargue sus
            datos en su ficha, en Cuentas, proyectos y categorias.
          </p>
        ) : (
          cuentas.map((c, i) => (
            <div
              key={c.id_int_cuenta}
              className="border border-gray-200 rounded p-2 mt-2 space-y-1.5"
            >
              {cuentas.length > 1 && (
                <div className="text-[11px] font-semibold text-dorado-osc">
                  Cuenta {i + 1} de {cuentas.length}
                </div>
              )}
              <Dato
                rotulo="Banco"
                muestra={c.banco}
                copia={c.banco}
                copiado={copiado}
                copiar={copiar}
              />
              <Dato
                rotulo="Tipo de cuenta"
                muestra={c.tipo_cuenta}
                copia={c.tipo_cuenta}
                copiado={copiado}
                copiar={copiar}
              />
              <Dato
                rotulo="Numero de cuenta"
                muestra={c.numero_cuenta}
                copia={c.numero_cuenta.replace(/[^0-9]/g, "")}
                copiado={copiado}
                copiar={copiar}
              />
              <Dato
                rotulo="Correo"
                muestra={c.email}
                copia={c.email}
                copiado={copiado}
                copiar={copiar}
              />
            </div>
          ))
        )}
      </div>

      {falla && (
        <p className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded px-3 py-2 mt-2">
          El navegador no dejo copiar. Seleccione el texto y copielo con
          Ctrl+C.
        </p>
      )}

      <div className="flex justify-end pt-3">
        <button
          type="button"
          onClick={alCerrar}
          className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
        >
          Cerrar
        </button>
      </div>
    </Ventana>
  );
}

function Dato({
  rotulo,
  muestra,
  copia,
  copiado,
  copiar,
}: {
  rotulo: string;
  muestra: string;
  copia: string;
  copiado: string | null;
  copiar: (clave: string, valor: string) => void;
}) {
  const vacio = copia.trim() === "";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-gray-500">{rotulo}</span>
      <span
        className={`flex-1 truncate font-semibold ${
          vacio ? "text-gray-400 font-normal" : "text-negro"
        }`}
        title={muestra}
      >
        {muestra}
      </span>
      <button
        type="button"
        disabled={vacio}
        onClick={() => copiar(rotulo, copia)}
        className="border border-gray-300 bg-white text-gray-700 font-semibold px-2 py-0.5 rounded w-16 disabled:opacity-40"
      >
        {copiado === rotulo ? "listo" : "copiar"}
      </button>
    </div>
  );
}
