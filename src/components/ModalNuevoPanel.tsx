"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { pesos, unidades } from "@/lib/formato";
import {
  calcularPanel,
  guardarPanel,
  productoParaCotizar,
  type ResultadoPanel,
} from "@/app/configurador/acciones";
import type { MateriaVenta } from "@/components/Configurador";
import type { ProductoVenta } from "@/components/EditorCotizacion";

// Configurador reducido, en ventana emergente sobre el cotizador. Existe para
// no tener que abandonar la cotizacion en curso cuando el panel pedido no esta
// en el catalogo: al vivir dentro del mismo componente, el estado del editor
// (cliente, items, descuento) no se toca y nada se pierde.
//
// Deliberadamente no repite el desglose de costos ni el margen del configurador
// completo: aqui lo unico que importa es obtener el panel y seguir cotizando.
export default function ModalNuevoPanel({
  materias,
  onCreado,
  onCerrar,
}: {
  materias: MateriaVenta[];
  onCreado: (p: ProductoVenta) => void;
  onCerrar: () => void;
}) {
  const [eps, setEps] = useState("");
  const [placaA, setPlacaA] = useState("");
  const [placaB, setPlacaB] = useState("");
  const [res, setRes] = useState<ResultadoPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const listaEps = useMemo(
    () => materias.filter((m) => m.tipo === "EPS"),
    [materias]
  );
  const listaPlacas = useMemo(
    () => materias.filter((m) => m.tipo === "Placa"),
    [materias]
  );

  // Escape cierra, como cualquier dialogo.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar]);

  useEffect(() => {
    setError(null);
    if (!eps || !placaA) {
      setRes(null);
      return;
    }
    let cancelado = false;
    empezar(async () => {
      const r = await calcularPanel({
        id_eps: Number(eps),
        id_placa_a: Number(placaA),
        id_placa_b: placaB ? Number(placaB) : null,
      });
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
  }, [eps, placaA, placaB]);

  // Si el panel ya existe con esta misma combinacion no se crea otro: se toma
  // el que ya esta. Es lo mismo que hace el configurador, pero aqui ademas
  // resuelve el caso practico de "no lo encontre en la lista" por buscar mal.
  const yaEsta = res?.existe_id != null && res.misma_config;

  function usar() {
    setError(null);
    empezar(async () => {
      let id = yaEsta ? (res?.existe_id as number) : null;

      if (id == null) {
        const r = await guardarPanel({
          id_eps: Number(eps),
          id_placa_a: Number(placaA),
          id_placa_b: placaB ? Number(placaB) : null,
        });
        if (r.error) {
          setError(r.error);
          return;
        }
        // guardarPanel devuelve el id existente cuando avisa por duplicado,
        // asi que ese caso tambien termina agregando el producto correcto.
        if (r.id == null) {
          setError(r.aviso ?? "No se pudo crear el panel.");
          return;
        }
        id = r.id;
      }

      const prod = await productoParaCotizar(id);
      if (!prod) {
        setError("El panel se creo, pero no se pudo leer del catalogo.");
        return;
      }
      onCreado(prod);
    });
  }

  const sel = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded shadow-lg w-full max-w-xl mt-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-verde text-white px-4 py-2.5 rounded-t flex items-center justify-between">
          <span className="text-sm font-semibold">Crear panel sin salir</span>
          <button
            onClick={onCerrar}
            className="text-white/80 hover:text-white text-lg leading-none"
            title="Cerrar (Esc)"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            La cotizacion que esta armando no se pierde: al aceptar, el panel
            queda en el catalogo y se agrega como item.
          </p>

          <label className="text-sm block">
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

          <div className="grid grid-cols-2 gap-3">
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
                <option value="">(sin placa: una cara)</option>
                {listaPlacas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2">
              {error}
            </div>
          )}

          {res && (
            <div className="border border-gray-200 rounded p-3 bg-crema">
              <div className="text-sm font-bold text-verde">
                {res.descripcion ?? "--"}
              </div>
              <div className="text-xs text-gray-600">
                Precio de venta: <strong>{pesos(res.precio)}</strong>
                {res.espesor_total != null &&
                  ` · ${unidades(res.espesor_total)} mm`}
              </div>
              {yaEsta && (
                <div className="mt-2 text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded p-2">
                  Este panel <strong>ya esta en el catalogo</strong>. No se crea
                  otro: se agrega el existente.
                </div>
              )}
              {res.existe_id != null && !res.misma_config && (
                <div className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded p-2">
                  Ya hay un panel con este nombre pero hecho con otras materias
                  primas. No se puede crear desde aqui: reviselo en Catalogo de
                  productos.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={usar}
              disabled={
                pendiente ||
                !res ||
                (res.existe_id != null && !res.misma_config)
              }
              className="bg-verde text-white text-sm font-semibold px-4 py-1.5 rounded disabled:opacity-40"
            >
              {pendiente
                ? "Trabajando..."
                : yaEsta
                  ? "Agregar el existente"
                  : "Crear y agregar"}
            </button>
            <button
              onClick={onCerrar}
              className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
