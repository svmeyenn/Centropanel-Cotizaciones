"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearMateria, type DatosMateria } from "@/app/materias-primas/acciones";

const VACIO: DatosMateria = {
  nombre: "",
  tipo: "Placa",
  familia: "",
  etiqueta: "",
  ancho_mm: null,
  largo_mm: null,
  espesor_mm: null,
  espesor_nominal: null,
  costo: 0,
  unidad: "",
};

// Alta de insumos. A diferencia del formulario de modificacion, aqui se piden
// tambien tipo y medidas: son los que definen como entra la materia prima al
// costeo y al nombre del panel, y despues cambiarlos alteraria paneles ya
// creados.
export default function ModalNuevaMateria({
  etiquetas,
  familias,
}: {
  etiquetas: string[];
  familias: string[];
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
  const esAdhesivo = form.tipo === "Adhesivo";

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
            className="bg-white rounded shadow-lg w-full max-w-2xl mt-10 text-left"
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
                  Nombre
                </span>
                <input
                  className={input}
                  autoFocus
                  placeholder="Placa OSB APA PROTEC 1220x2440x11,1 mm"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>

              <div className="grid md:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Tipo
                  </span>
                  <select
                    className={input}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="Placa">Placa</option>
                    <option value="EPS">EPS</option>
                    <option value="Adhesivo">Adhesivo</option>
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
                  <span className="text-xs text-gray-500">
                    {esAdhesivo
                      ? "No se usa en el nombre del panel."
                      : "Es la que aparece en el nombre del panel."}
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Familia
                  </span>
                  <input
                    className={input}
                    list="familias-mp"
                    value={form.familia}
                    onChange={(e) =>
                      setForm({ ...form, familia: e.target.value })
                    }
                  />
                  <datalist id="familias-mp">
                    {familias.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </label>
              </div>

              {!esAdhesivo && (
                <div className="grid md:grid-cols-4 gap-3">
                  <Num
                    label="Ancho (mm)"
                    value={form.ancho_mm}
                    onChange={(v) => setForm({ ...form, ancho_mm: v })}
                    cls={input}
                  />
                  <Num
                    label="Largo (mm)"
                    value={form.largo_mm}
                    onChange={(v) => setForm({ ...form, largo_mm: v })}
                    cls={input}
                  />
                  <Num
                    label="Espesor real (mm)"
                    value={form.espesor_mm}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        espesor_mm: v,
                        // El nominal acompana al real salvo que se toque a mano:
                        // es el que usaban los nombres antiguos.
                        espesor_nominal:
                          form.espesor_nominal == null && v != null
                            ? Math.round(v)
                            : form.espesor_nominal,
                      })
                    }
                    cls={input}
                    ayuda="El que sale en el nombre del panel."
                  />
                  <Num
                    label="Espesor nominal"
                    value={form.espesor_nominal}
                    onChange={(v) => setForm({ ...form, espesor_nominal: v })}
                    cls={input}
                  />
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <Num
                  label="Costo neto"
                  value={form.costo}
                  onChange={(v) => setForm({ ...form, costo: v ?? 0 })}
                  cls={input}
                />
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Unidad
                  </span>
                  <input
                    className={input}
                    placeholder="plancha, balde..."
                    value={form.unidad}
                    onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                  />
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
                  {error}
                </div>
              )}

              <p className="text-xs text-gray-500">
                El insumo nuevo queda disponible en el configurador de paneles.
                No recostea nada por si solo: para eso esta &quot;Solo recalcular
                catalogo&quot;.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={guardar}
                  disabled={pendiente || !form.nombre.trim()}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                >
                  {pendiente ? "Grabando..." : "Crear insumo"}
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

function Num({
  label,
  value,
  onChange,
  cls,
  ayuda,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  cls: string;
  ayuda?: string;
}) {
  return (
    <label className="text-sm">
      <span className="block text-dorado-osc font-semibold mb-1">{label}</span>
      <input
        type="number"
        step="any"
        className={cls}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
      {ayuda && <span className="text-xs text-gray-500">{ayuda}</span>}
    </label>
  );
}
