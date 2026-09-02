"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { pesos, porcentaje, unidades, conIva } from "@/lib/formato";
import BarraNavegacion from "@/components/BarraNavegacion";
import {
  calcularPanel,
  guardarPanel,
  type ResultadoPanel,
} from "@/app/configurador/acciones";

export interface MateriaVenta {
  id: number;
  nombre: string;
  tipo: string;
  etiqueta: string | null;
  espesor_nominal: number | null;
}

export default function Configurador({
  materias,
  esAdmin,
  puedeCrear,
  margenObjetivo,
  iva,
}: {
  materias: MateriaVenta[];
  esAdmin: boolean;
  puedeCrear: boolean;
  margenObjetivo: number;
  iva: number;
}) {
  const [eps, setEps] = useState("");
  const [placaA, setPlacaA] = useState("");
  const [placaB, setPlacaB] = useState("");
  // Precio neto, PVP y margen son tres caras del mismo numero. Se guarda uno
  // solo --el neto-- y los otros dos se derivan; asi tocar cualquiera mueve a
  // los demas sin que puedan quedar contradiciendose.
  const [precioTocado, setPrecioTocado] = useState<number | null>(null);
  // Mientras se escribe en un campo se respeta lo tecleado; los otros dos se
  // muestran ya derivados.
  const [enFoco, setEnFoco] = useState<"neto" | "pvp" | "margen" | null>(null);
  const [tecleado, setTecleado] = useState("");
  const [res, setRes] = useState<ResultadoPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const listaEps = useMemo(
    () => materias.filter((m) => m.tipo === "EPS"),
    [materias],
  );
  const listaPlacas = useMemo(
    () => materias.filter((m) => m.tipo === "Placa"),
    [materias],
  );

  // Recalcula cada vez que cambia la combinacion o el margen, igual que
  // CfgRecalcular en Access: el aviso de duplicado aparece mientras se elige,
  // no recien al intentar guardar.
  useEffect(() => {
    setError(null);
    setExito(null);
    setPrecioTocado(null);
    if (!eps || !placaA) {
      setRes(null);
      return;
    }
    let cancelado = false;
    empezar(async () => {
      const r = await calcularPanel(
        {
          id_eps: Number(eps),
          id_placa_a: Number(placaA),
          id_placa_b: placaB ? Number(placaB) : null,
        },
        null,
      );
      if (cancelado) return;
      if ("error" in r) {
        setError(r.error);
        setRes(null);
      } else {
        setRes(r);
      }
    });
    return () => {
      cancelado = true;
    };
    // Cambiar la composicion es cambiar de panel: el precio escrito a mano
    // para el anterior no tiene por que seguir valiendo.
  }, [eps, placaA, placaB]);

  function onGuardar() {
    setError(null);
    setAviso(null);
    setExito(null);
    empezar(async () => {
      const r = await guardarPanel(
        {
          id_eps: Number(eps),
          id_placa_a: Number(placaA),
          id_placa_b: placaB ? Number(placaB) : null,
        },
        precioTocado,
      );
      if (r.error) setError(r.error);
      else if (r.aviso) setAviso(r.aviso);
      else if (r.ok) setExito("Panel guardado en el catalogo.");
    });
  }

  const sel = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const yaExiste = res?.existe_id != null;

  // El neto manda; el PVP y el margen se derivan de el y del costo.
  const neto = precioTocado ?? res?.precio ?? 0;
  const pvp = conIva(neto, iva);
  const costoActual = res?.costo ?? null;
  const margenActual =
    costoActual != null && neto > 0 ? (neto - costoActual) / neto : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <BarraNavegacion>
        <Link
          href="/productos"
          className="border border-verde text-verde text-xs px-2.5 py-1 rounded hover:bg-white"
        >
          Catalogo
        </Link>
      </BarraNavegacion>

      {/* composicion */}
      <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
        <div className="text-sm font-semibold text-verde">
          Composicion del panel
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">
              Plancha EPS
            </span>
            <select
              className={sel}
              value={eps}
              onChange={(e) => setEps(e.target.value)}
            >
              <option value="">-- elija --</option>
              {listaEps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">
              Placa cara A
            </span>
            <select
              className={sel}
              value={placaA}
              onChange={(e) => setPlacaA(e.target.value)}
            >
              <option value="">-- elija --</option>
              {listaPlacas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">
              Placa cara B
            </span>
            <select
              className={sel}
              value={placaB}
              onChange={(e) => setPlacaB(e.target.value)}
            >
              <option value="">(sin placa: panel de una cara)</option>
              {listaPlacas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {aviso && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded p-3">
          {aviso}
        </div>
      )}
      {exito && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
          {exito}
        </div>
      )}

      {/* resultado */}
      {res && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
            PANEL RESULTANTE
          </div>
          <div className="p-4 space-y-3">
            <div>
              <div className="text-xs text-gray-500">Descripcion</div>
              <div className="text-base font-bold text-verde">
                {res.descripcion ?? "--"}
              </div>
              {res.espesor_total != null && (
                <div className="text-xs text-gray-500">
                  Espesor total: {unidades(res.espesor_total)} mm
                </div>
              )}
            </div>

            {yaExiste && (
              <div
                className={`text-sm rounded p-3 border ${
                  res.misma_config
                    ? "bg-blue-50 border-blue-200 text-blue-900"
                    : "bg-amber-50 border-amber-300 text-amber-900"
                }`}
              >
                {res.misma_config ? (
                  <>
                    <strong>Ya existe en el catalogo</strong> con esta misma
                    configuracion. No hace falta guardarlo de nuevo.
                  </>
                ) : (
                  <>
                    <strong>Ojo:</strong> ya existe un panel llamado igual (
                    {res.descripcion_existente}) pero hecho con otras materias
                    primas. Guardarlo cambiaria el costo de ese producto.
                  </>
                )}
              </div>
            )}

            {/* Cuatro columnas: las cuatro cifras del panel se leen de una
                sola pasada, sin que el margen caiga a una segunda linea. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Costo y margen van a todos los perfiles: el desglose de abajo,
                  que Stephan pidio abrir, ya los muestra. */}
              <Dato titulo="Costo unitario" valor={pesos(res.costo)} />
              <Dato
                titulo="Precio de venta neto"
                valor={pesos(neto)}
                destacado
              />
              <Dato
                titulo={`PVP (IVA ${Math.round(iva * 100)}%)`}
                valor={pesos(pvp)}
              />
              {margenActual != null && (
                <Dato
                  titulo="Margen resultante"
                  valor={`${porcentaje(margenActual * 100)} %`}
                />
              )}
            </div>

            {/* Resumen de como se llego al costo: EPS + caras + adhesivo. */}
            {res.costeo && res.costeo.length > 0 && (
              <details className="border border-gray-200 rounded" open>
                <summary className="cursor-pointer bg-gray-50 px-3 py-2 text-xs font-semibold text-dorado-osc">
                  COMO SE CALCULA ESTE COSTO
                </summary>
                <table className="w-full text-xs">
                  <tbody>
                    {res.costeo.map((l) => (
                      <tr key={l.concepto} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 w-32 text-gray-700">
                          {l.concepto}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 text-xs">
                          {l.detalle}
                        </td>
                        <td className="px-3 py-1.5 text-right w-28">
                          {pesos(l.monto)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td className="px-3 py-1.5" colSpan={2}>
                        COSTO TOTAL
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {pesos(res.costo)}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-100 text-gray-600">
                      <td className="px-3 py-1.5" colSpan={2}>
                        Precio = costo / (1 - margen), con margen{" "}
                        {margenActual != null
                          ? porcentaje(margenActual * 100)
                          : "--"}{" "}
                        % sobre el precio
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-verde">
                        {pesos(neto)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </details>
            )}

            {esAdmin && (
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="grid md:grid-cols-3 gap-3">
                  <label className="text-sm">
                    <span className="block text-dorado-osc font-semibold mb-1">
                      Precio de venta neto
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={sel}
                      value={enFoco === "neto" ? tecleado : pesos(neto)}
                      onFocus={() => {
                        setEnFoco("neto");
                        setTecleado(pesos(neto));
                      }}
                      onBlur={() => setEnFoco(null)}
                      onChange={(e) => {
                        const v =
                          Number(e.target.value.replace(/\D/g, "")) || 0;
                        setTecleado(pesos(v));
                        setPrecioTocado(v);
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-dorado-osc font-semibold mb-1">
                      PVP (IVA {Math.round(iva * 100)}%)
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={sel}
                      value={enFoco === "pvp" ? tecleado : pesos(pvp)}
                      onFocus={() => {
                        setEnFoco("pvp");
                        setTecleado(pesos(pvp));
                      }}
                      onBlur={() => setEnFoco(null)}
                      onChange={(e) => {
                        const v =
                          Number(e.target.value.replace(/\D/g, "")) || 0;
                        setTecleado(pesos(v));
                        setPrecioTocado(Math.round(v / (1 + iva)));
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-dorado-osc font-semibold mb-1">
                      Margen (%)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={sel}
                      value={
                        enFoco === "margen"
                          ? tecleado
                          : margenActual != null
                            ? porcentaje(margenActual * 100)
                            : ""
                      }
                      onFocus={() => {
                        setEnFoco("margen");
                        setTecleado(
                          margenActual != null
                            ? porcentaje(margenActual * 100)
                            : "",
                        );
                      }}
                      onBlur={() => setEnFoco(null)}
                      onChange={(e) => {
                        const txt = e.target.value.replace(/[^0-9,.-]/g, "");
                        setTecleado(txt);
                        const m = Number(txt.replace(",", ".")) / 100;
                        // Margen sobre el precio: al 100% el precio se iria al
                        // infinito, asi que ahi no se recalcula nada.
                        if (Number.isFinite(m) && m < 1) {
                          if (costoActual != null) {
                            setPrecioTocado(Math.round(costoActual / (1 - m)));
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="text-xs text-gray-500">
                    Los tres van juntos: al cambiar uno se recalculan los otros.
                    El margen es sobre el precio, no sobre el costo.
                  </span>
                  {precioTocado != null && (
                    <button
                      onClick={() => setPrecioTocado(null)}
                      className="border border-verde text-verde text-xs px-2.5 py-1 rounded"
                      title={`Vuelve al margen del sistema (${Math.round(margenObjetivo * 100)} %)`}
                    >
                      Volver al precio automatico
                    </button>
                  )}
                </div>
              </div>
            )}

            {puedeCrear && (
              <div className="pt-2">
                <button
                  onClick={onGuardar}
                  disabled={pendiente || (yaExiste && res.misma_config)}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-40"
                >
                  {pendiente ? "Guardando..." : "Guardar en el catalogo"}
                </button>
                {yaExiste && res.misma_config && (
                  <span className="text-xs text-gray-500 ml-3">
                    Ya esta en el catalogo.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!res && !error && (
        <div className="bg-white border border-gray-200 rounded p-6 text-center text-sm text-gray-500">
          Elija la plancha EPS y la placa de la cara A para ver el panel.
        </div>
      )}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className={`rounded p-3 ${destacado ? "bg-crema" : "bg-gray-50"}`}>
      <div className="text-xs text-gray-500">{titulo}</div>
      <div
        className={`font-bold ${destacado ? "text-verde text-lg" : "text-gray-800"}`}
      >
        {valor}
      </div>
    </div>
  );
}
