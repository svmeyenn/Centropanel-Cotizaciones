"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pesos, porcentaje, conIva } from "@/lib/formato";
import {
  crearProductoServicio,
  type DatosProductoNuevo,
} from "@/app/productos/acciones";

const VACIO: DatosProductoNuevo = {
  descripcion: "",
  precio_venta: 0,
  costo_unitario: null,
};

// Alta de productos que no son paneles: fletes, mano de obra, servicios. Va en
// ventana emergente y no en la propia tabla para poder ofrecerse desde la barra
// de navegacion, al lado de "Configurar panel", que es la otra forma de sumar
// algo al catalogo.
export default function BotonNuevoProducto({ iva }: { iva: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<DatosProductoNuevo>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [abierto]);

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await crearProductoServicio(form);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setAbierto(false);
      setForm(VACIO);
      router.refresh();
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setForm(VACIO);
          setAbierto(true);
        }}
        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
        title="Fletes, mano de obra y otros servicios. Los paneles se crean en el configurador."
      >
        Nuevo producto
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setAbierto(false)}
        >
          <div
            className="bg-white rounded shadow-lg w-full max-w-xl mt-10 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-verde text-white px-4 py-2.5 rounded-t flex items-center justify-between">
              <span className="text-sm font-semibold">Nuevo producto</span>
              <button
                onClick={() => setAbierto(false)}
                className="text-white/80 hover:text-white text-lg leading-none"
                title="Cerrar (Esc)"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Para fletes, mano de obra y otros servicios. Un panel SIP se crea
                en el configurador, que arma su descripcion y su costo desde la
                composicion.
              </p>

              <label className="text-sm block">
                <span className="block text-dorado-osc font-semibold mb-1">
                  Descripcion
                </span>
                <input
                  className={input}
                  autoFocus
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                />
              </label>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Precio de venta neto
                  </span>
                  <input
                    type="number"
                    className={input}
                    value={form.precio_venta}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        precio_venta: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="text-xs text-gray-500">
                    PVP: {pesos(conIva(form.precio_venta, iva))}
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Costo (opcional)
                  </span>
                  <input
                    type="number"
                    className={input}
                    value={form.costo_unitario ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        costo_unitario: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                  {form.precio_venta > 0 && form.costo_unitario != null && (
                    <span className="text-xs text-gray-500">
                      Margen resultante:{" "}
                      {porcentaje(
                        ((form.precio_venta - form.costo_unitario) /
                          form.precio_venta) *
                          100
                      )}{" "}
                      %
                    </span>
                  )}
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={guardar}
                  disabled={pendiente || !form.descripcion.trim()}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                >
                  {pendiente ? "Grabando..." : "Crear producto"}
                </button>
                <button
                  onClick={() => setAbierto(false)}
                  className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
