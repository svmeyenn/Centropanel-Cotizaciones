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
  const [margen, setMargen] = useState<string>("");
  const [precioManual, setPrecioManual] = useState<string>("");
  const [res, setRes] = useState<ResultadoPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const listaEps = useMemo(
    () => materias.filter((m) => m.tipo === "EPS"),
    [materias]
  );
  const listaPlacas = useMemo(
    () => materias.filter((m) => m.tipo === "Placa"),
    [materias]
  );

  // Recalcula cada vez que cambia la combinacion o el margen, igual que
  // CfgRecalcular en Access: el aviso de duplicado aparece mientras se elige,
  // no recien al intentar guardar.
  useEffect(() => {
    setError(null);
    setExito(null);
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
        margen ? Number(margen) : null
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
  }, [eps, placaA, placaB, margen]);

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
        precioManual ? Number(precioManual) : null
      );
      if (r.error) setError(r.error);
      else if (r.aviso) setAviso(r.aviso);
      else if (r.ok) setExito("Panel guardado en el catalogo.");
    });
  }

  const sel = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const yaExiste = res?.existe_id != null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <BarraNavegacion>
        <Link
          href="/productos"
          className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded hover:bg-white"
        >
          Catalogo
        </Link>
      </BarraNavegacion>

      {/* composicion */}
      <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
        <div className="text-sm font-semibold text-verde">Composicion del panel</div>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">
              Plancha EPS
            </span>
            <select className={sel} value={eps} onChange={(e) => setEps(e.target.value)}>
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

            <div className="grid md:grid-cols-3 gap-3">
              {/* Costo y margen van a todos los perfiles: el desglose de abajo,
                  que Stephan pidio abrir, ya los muestra. */}
              <Dato titulo="Costo unitario" valor={pesos(res.costo)} />
              <Dato titulo="Precio de venta neto" valor={pesos(res.precio)} destacado />
              <Dato
                titulo={`PVP (IVA ${Math.round(iva * 100)}%)`}
                valor={pesos(conIva(res.precio, iva))}
              />
              {res.margen != null && (
                <Dato
                  titulo="Margen resultante"
                  valor={`${porcentaje(res.margen * 100)} %`}
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
                      <td className="px-3 py-1.5 text-right">{pesos(res.costo)}</td>
                    </tr>
                    <tr className="border-t border-gray-100 text-gray-600">
                      <td className="px-3 py-1.5" colSpan={2}>
                        Precio = costo / (1 - margen), con margen{" "}
                        {res.margen != null ? porcentaje(res.margen * 100) : "--"} %
                        sobre el precio
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-verde">
                        {pesos(res.precio)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </details>
            )}

            {esAdmin && (
              <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Margen objetivo (%)
                  </span>
                  <input
                    type="number"
                    className={sel}
                    placeholder={String(Math.round(margenObjetivo * 100))}
                    value={margen}
                    onChange={(e) => setMargen(e.target.value)}
                  />
                  <span className="text-xs text-gray-500">
                    Vacio usa el margen del sistema (
                    {Math.round(margenObjetivo * 100)} %). El margen es sobre el
                    precio, no sobre el costo.
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Precio manual (opcional)
                  </span>
                  <input
                    type="number"
                    className={sel}
                    placeholder="dejar vacio para usar el calculado"
                    value={precioManual}
                    onChange={(e) => setPrecioManual(e.target.value)}
                  />
                </label>
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
