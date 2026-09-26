"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import {
  guardarFormatoCartola,
  inspeccionarArchivo,
  olvidarFormatoCartola,
  type Resultado,
} from "@/app/conciliacion/acciones";
import type {
  FormatoCartola as Formato,
  InspeccionCartola,
} from "@/lib/finanzas/cartola-banco";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white disabled:opacity-50";

// Como se lee la cartola de esta cuenta. Se configura una vez, con un archivo
// de muestra a la vista, y rige hasta que se cambie: el banco puede titular
// sus columnas como quiera.
export default function FormatoCartola({
  idCuenta,
  nombreCuenta,
  formato,
  alCerrar,
}: {
  idCuenta: number;
  nombreCuenta: string;
  formato: Formato | null;
  alCerrar: (mensaje?: string) => void;
}) {
  const router = useRouter();
  const [enCurso, comenzar] = useTransition();
  const [inspeccion, setInspeccion] = useState<InspeccionCartola | null>(null);
  const [aviso, setAviso] = useState("");
  const [leyendo, setLeyendo] = useState(false);

  // Con una sola columna de monto no hay cargo ni abono, y al contrario.
  const [unaColumna, setUnaColumna] = useState(Boolean(formato?.col_monto));

  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    guardarFormatoCartola,
    null
  );

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  async function mirarArchivo(archivo: File | null) {
    if (!archivo) return;
    setLeyendo(true);
    setAviso("");
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);
    const r = await inspeccionarArchivo(cuerpo);
    setLeyendo(false);

    if (!r.ok) {
      setAviso(r.mensaje);
      return;
    }

    setInspeccion(r.inspeccion);
    // Si el archivo no trae columnas separadas de cargo y abono, se propone la
    // de monto unico.
    if (!r.inspeccion.propuesta.cargo && !r.inspeccion.propuesta.abono)
      setUnaColumna(Boolean(r.inspeccion.propuesta.monto));
  }

  function olvidar() {
    comenzar(async () => {
      const r = await olvidarFormatoCartola(idCuenta);
      if (r.ok) {
        router.refresh();
        alCerrar(r.mensaje);
      } else setAviso(r.mensaje ?? "");
    });
  }

  // Cada campo se elige de los titulos del archivo; sin archivo cargado se
  // muestra lo que ya estaba configurado.
  const titulos = inspeccion?.titulos.filter((t) => t !== "") ?? [];
  const opciones = (actual: string | null | undefined) => {
    const lista = [...titulos];
    if (actual && !lista.includes(actual)) lista.unshift(actual);
    return lista;
  };

  const Selector = ({
    campo,
    rotulo,
    actual,
    obligatorio,
    nota,
  }: {
    campo: string;
    rotulo: string;
    actual: string | null | undefined;
    obligatorio?: boolean;
    nota?: string;
  }) => (
    <div>
      <label className={ROTULO}>
        {rotulo} {obligatorio && "*"}
      </label>
      <select
        name={campo}
        className={CAMPO}
        defaultValue={actual ?? ""}
        required={obligatorio}
        disabled={titulos.length === 0 && !actual}
      >
        <option value="">{obligatorio ? "Elija la columna" : "No la trae"}</option>
        {opciones(actual).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {nota && <p className="text-[11px] text-gray-600 mt-0.5">{nota}</p>}
    </div>
  );

  return (
    <Ventana
      titulo={`Formato de la cartola de ${nombreCuenta}`}
      subtitulo="Se configura una vez y rige hasta que se cambie"
      onCerrar={() => alCerrar()}
      ancho="max-w-3xl"
    >
      <div className="space-y-4">
        <p className="bg-crema border border-gray-200 rounded px-3 py-2 text-xs text-gray-700">
          Suba una cartola de muestra de esta cuenta: se leen sus titulos y usted
          dice cual es cual. No se carga ningun movimiento, solo se mira el
          archivo.
        </p>

        <div>
          <label className={ROTULO}>Cartola de muestra</label>
          <input
            type="file"
            className={CAMPO}
            accept=".csv,.txt,.xlsx"
            onChange={(e) => mirarArchivo(e.target.files?.[0] ?? null)}
          />
          {leyendo && (
            <p className="text-[11px] text-gray-600 mt-0.5">Mirando el archivo...</p>
          )}
        </div>

        {inspeccion && inspeccion.muestra.length > 0 && (
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-verde text-white">
                <tr>
                  {inspeccion.titulos.map((t, i) => (
                    <th key={i} className="text-left px-2 py-1 whitespace-nowrap">
                      {t || <span className="text-white/60">(sin titulo)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspeccion.muestra.map((fila, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {fila.map((c, j) => (
                      <td key={j} className="px-2 py-1 whitespace-nowrap text-gray-700">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={enviar} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id_cuenta" value={idCuenta} />

          <Selector
            campo="col_fecha"
            rotulo="Fecha del movimiento"
            actual={inspeccion?.propuesta.fecha ?? formato?.col_fecha}
            obligatorio
            nota="Si trae fecha de transaccion y fecha contable, use la de transaccion."
          />

          <Selector
            campo="col_descripcion"
            rotulo="Descripcion o glosa"
            actual={inspeccion?.propuesta.descripcion ?? formato?.col_descripcion}
          />

          <Selector
            campo="col_documento"
            rotulo="Numero de documento"
            actual={inspeccion?.propuesta.documento ?? formato?.col_documento}
            nota="Ayuda a cuadrar, pero muchos bancos no lo traen."
          />

          <label className="flex items-start gap-2 text-xs bg-crema border border-gray-200 rounded px-3 py-2 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={unaColumna}
              onChange={(e) => setUnaColumna(e.target.checked)}
            />
            <span>
              La plata viene en una sola columna
              <span className="block text-[11px] text-gray-600">
                Marque esto si el archivo trae un solo monto con signo. Si trae
                cargos y abonos en columnas separadas, dejelo sin marcar.
              </span>
            </span>
          </label>

          {unaColumna ? (
            <>
              <Selector
                campo="col_monto"
                rotulo="Monto con signo"
                actual={inspeccion?.propuesta.monto ?? formato?.col_monto}
                obligatorio
              />
              <label className="flex items-start gap-2 text-xs bg-crema border border-gray-200 rounded px-3 py-2">
                <input
                  type="checkbox"
                  name="monto_invertido"
                  className="mt-0.5"
                  defaultChecked={formato?.monto_invertido ?? false}
                />
                <span>
                  Los egresos vienen en positivo
                  <span className="block text-[11px] text-gray-600">
                    Solo si el banco escribe los pagos sin signo menos.
                  </span>
                </span>
              </label>
            </>
          ) : (
            <>
              <Selector
                campo="col_cargo"
                rotulo="Cargo (lo que sale)"
                actual={inspeccion?.propuesta.cargo ?? formato?.col_cargo}
              />
              <Selector
                campo="col_abono"
                rotulo="Abono (lo que entra)"
                actual={inspeccion?.propuesta.abono ?? formato?.col_abono}
              />
            </>
          )}

          {(aviso || (estado && !estado.ok)) && (
            <p
              className={`sm:col-span-2 text-xs rounded px-3 py-2 border ${
                estado && !estado.ok
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-crema border-gray-200 text-gray-700"
              }`}
            >
              {estado && !estado.ok ? estado.mensaje : aviso}
            </p>
          )}

          <div className="sm:col-span-2 flex flex-wrap gap-2 justify-end pt-1">
            {formato && (
              <button
                type="button"
                className={`${BOTON_CLARO} text-red-700 mr-auto`}
                onClick={olvidar}
                disabled={enCurso || pendiente}
              >
                Borrar configuracion
              </button>
            )}
            <button
              type="button"
              className={BOTON_CLARO}
              onClick={() => alCerrar()}
              disabled={pendiente}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
              disabled={pendiente}
            >
              {pendiente ? "Guardando..." : "Guardar formato"}
            </button>
          </div>
        </form>
      </div>
    </Ventana>
  );
}
