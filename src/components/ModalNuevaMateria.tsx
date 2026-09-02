"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearMateria, type DatosMateria } from "@/app/materias-primas/acciones";
import type { Pais, TipoMateria } from "@/types/database";

const VACIO: DatosMateria = {
  nombre: "",
  tipo: "",
  familia: "",
  etiqueta: "",
  ancho_mm: null,
  largo_mm: null,
  espesor_mm: null,
  espesor_nominal: null,
  costo: 0,
  unidad: "",
  activo: true,
};

// Alta de un insumo: descripcion, tipo, etiqueta, espesor, costo y estado. Nada
// mas -- las medidas de la plancha no intervienen en el costeo, que trabaja con
// el costo de la unidad completa.
export default function ModalNuevaMateria({
  etiquetas,
  tipos,
  paises = [],
  eligePais,
}: {
  etiquetas: string[];
  // Los tipos vienen de la tabla, no del codigo: agregar uno nuevo --sellos,
  // cintas, herrajes-- no deberia requerir tocar el programa.
  tipos: TipoMateria[];
  paises?: Pais[];
  eligePais?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<DatosMateria>(VACIO);
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
      const r = await crearMateria(form);
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
        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ml-auto"
      >
        Nueva materia prima
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
              <span className="text-sm font-semibold">Nueva materia prima</span>
              <button
                onClick={() => setAbierto(false)}
                className="text-white/80 hover:text-white text-lg leading-none"
                title="Cerrar (Esc)"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              <label className="text-sm block">
                <span className="block text-dorado-osc font-semibold mb-1">
                  Descripcion
                </span>
                <input
                  className={input}
                  autoFocus
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Tipo
                  </span>
                  <select
                    className={input}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="">-- elija --</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.nombre}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Pais
                  </span>
                  <select
                    className={input}
                    value={form.id_pais ?? ""}
                    disabled={!eligePais}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        id_pais: Number(e.target.value) || null,
                      })
                    }
                  >
                    {eligePais && <option value="">-- elija --</option>}
                    {paises.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Etiqueta
                  </span>
                  <input
                    className={input}
                    list="etiquetas-mp"
                    placeholder="APA, Smart, EPS15..."
                    value={form.etiqueta}
                    onChange={(e) =>
                      setForm({ ...form, etiqueta: e.target.value })
                    }
                  />
                  <datalist id="etiquetas-mp">
                    {etiquetas.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Espesor (mm)
                  </span>
                  <input
                    type="number"
                    step="any"
                    className={input}
                    value={form.espesor_mm ?? ""}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      setForm({
                        ...form,
                        espesor_mm: v,
                        espesor_nominal: v == null ? null : Math.round(v),
                      });
                    }}
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Costo neto
                  </span>
                  <input
                    type="number"
                    className={input}
                    value={form.costo}
                    onChange={(e) =>
                      setForm({ ...form, costo: Number(e.target.value) || 0 })
                    }
                  />
                </label>
              </div>

              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                <span className="text-gray-700">Activo</span>
              </label>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={guardar}
                  disabled={pendiente || !form.nombre.trim()}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                >
                  {pendiente ? "Grabando..." : "Crear"}
                </button>
                <button
                  onClick={() => setAbierto(false)}
                  className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
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
