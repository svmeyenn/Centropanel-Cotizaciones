"use client";

import { useState } from "react";
import Ventana from "@/components/Ventana";
import { cambiosDe } from "@/app/bitacora/acciones";
import {
  cuandoLegible,
  etiquetaCampo,
  valorLegible,
  type Anotacion,
} from "@/lib/bitacora";

// El enlace al historial de un documento. Va abajo a la derecha, discreto: casi
// nunca se mira, y cuando se mira es porque algo no cuadra.
//
// El historial no viaja con la pantalla: se pide al abrirlo. Un documento con
// cien ediciones no tiene por que hacer mas lenta la carga de todos los demas.
export default function Bitacora({
  tabla,
  id,
  etiqueta = "Ver historial de cambios",
}: {
  tabla: string;
  id: number | string;
  etiqueta?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anotaciones, setAnotaciones] = useState<Anotacion[] | null>(null);

  async function abrir() {
    setAbierta(true);
    if (anotaciones) return;
    setCargando(true);
    setError(null);
    const r = await cambiosDe(tabla, id);
    setCargando(false);
    if ("error" in r && r.error) setError(r.error);
    else setAnotaciones(r.anotaciones ?? []);
  }

  return (
    <>
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={abrir}
          className="text-[11px] text-gray-500 underline hover:text-verde"
          title="Quien lo cambio, cuando y que cambio"
        >
          {etiqueta}
        </button>
      </div>

      {abierta && (
        <Ventana
          titulo="Historial de cambios"
          subtitulo="Lo mas reciente arriba"
          onCerrar={() => setAbierta(false)}
        >
          {cargando && <p className="text-xs text-gray-500">Buscando...</p>}

          {error && (
            <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
              {error}
            </p>
          )}

          {anotaciones && anotaciones.length === 0 && (
            <p className="text-xs text-gray-500">
              Todavia no hay cambios anotados. El historial empieza a correr desde que
              se puso en marcha: lo anterior a eso no quedo registrado.
            </p>
          )}

          {anotaciones && anotaciones.length > 0 && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {anotaciones.map((a) => (
                <div key={a.id} className="border border-gray-200 rounded">
                  <div className="flex flex-wrap gap-x-2 items-baseline bg-crema px-2 py-1 text-[11px]">
                    <span className="font-semibold text-dorado-osc">
                      {cuandoLegible(a.hecho_en)}
                    </span>
                    <span className="text-gray-700">{a.quien}</span>
                    <span className="text-gray-500">
                      {a.accion === "creado"
                        ? "lo creo"
                        : a.accion === "borrado"
                          ? "lo borro"
                          : "lo modifico"}
                    </span>
                  </div>

                  {a.accion === "modificado" ? (
                    <table className="w-full text-xs">
                      <tbody>
                        {Object.entries(a.cambios).map(([campo, v]) => {
                          const par = v as { antes?: unknown; ahora?: unknown };
                          return (
                            <tr key={campo} className="border-t border-gray-100">
                              <td className="px-2 py-1 font-semibold w-44">
                                {etiquetaCampo(campo)}
                              </td>
                              <td className="px-2 py-1 text-gray-500 line-through">
                                {valorLegible(campo, par.antes)}
                              </td>
                              <td className="px-2 py-1 text-gray-400 w-4">&rarr;</td>
                              <td className="px-2 py-1">
                                {valorLegible(campo, par.ahora)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody>
                        {Object.entries(a.cambios)
                          .filter(([, v]) => v !== null && v !== "")
                          .map(([campo, v]) => (
                            <tr key={campo} className="border-t border-gray-100">
                              <td className="px-2 py-1 font-semibold w-44">
                                {etiquetaCampo(campo)}
                              </td>
                              <td className="px-2 py-1">{valorLegible(campo, v)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </Ventana>
      )}
    </>
  );
}
