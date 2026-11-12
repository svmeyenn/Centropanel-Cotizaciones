"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearMateria, type DatosMateria } from "@/app/materias-primas/acciones";
import type { Pais, TipoMateria } from "@/types/database";
import CamposMateria, { type ReglaM3 } from "@/components/CamposMateria";
import { monedaDelPais } from "@/lib/formato";

const vacio = (pais: number | null): DatosMateria => ({
  nombre: "",
  tipo: "",
  familia: "",
  etiqueta: "",
  ancho_mm: null,
  largo_mm: null,
  espesor_mm: null,
  espesor_nominal: null,
  peso_kg: null,
  densidad_kg_m3: null,
  costo: 0,
  unidad: "",
  activo: true,
  id_pais: pais,
});

// Alta de un insumo con los mismos datos que su ficha: categorizacion, medidas, peso y costo, y los
// parametros que salen de las medidas. Con un costo por m3 y las tres medidas, el costo de la unidad se calcula.
export default function ModalNuevaMateria({
  etiquetas,
  familias = [],
  unidades = [],
  tipos,
  paises = [],
  eligePais,
  reglasM3 = [],
  proveedores = [],
}: {
  etiquetas: string[];
  familias?: string[];
  unidades?: string[];
  // Los tipos vienen de la tabla, no del codigo: agregar uno nuevo --sellos,
  // cintas, herrajes-- no deberia requerir tocar el programa.
  tipos: TipoMateria[];
  paises?: Pais[];
  eligePais?: boolean;
  reglasM3?: ReglaM3[];
  proveedores?: { id: number; nombre: string; id_pais: number | null }[];
}) {
  // Quien trabaja un solo mercado no elige: su pais viene puesto. El
  // administrador general, que alcanza los dos, tiene que decidir.
  const paisPorDefecto = paises.length === 1 ? paises[0].id : null;

  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<DatosMateria>(vacio(paisPorDefecto));
  const [regla, setRegla] = useState<ReglaM3 | null>(null);
  const [proveedor, setProveedor] = useState<number | null>(null);
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
      const r = await crearMateria({ ...form, id_proveedor_maestra: proveedor });
      if (r?.error) {
        setError(r.error);
        return;
      }
      if (r && "aviso" in r && r.aviso) {
        setError(r.aviso);
        router.refresh();
        return;
      }
      setAbierto(false);
      setForm(vacio(paisPorDefecto));
      setRegla(null);
      setProveedor(null);
      router.refresh();
    });
  }

  const moneda = monedaDelPais(form.id_pais ?? paisPorDefecto);

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setForm(vacio(paisPorDefecto));
          setRegla(null);
          setProveedor(null);
          setAbierto(true);
        }}
        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ml-auto"
      >
        Nueva materia prima
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setAbierto(false)}>
          <div role="dialog" aria-modal="true" aria-label="Nueva materia prima" className="bg-white rounded shadow-lg w-full max-w-3xl mt-6 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="bg-verde text-white px-4 py-2.5 rounded-t flex items-center justify-between">
              <span className="text-sm font-semibold">Nueva materia prima</span>
              <button onClick={() => setAbierto(false)} className="text-white/80 hover:text-white text-lg leading-none" title="Cerrar (Esc)" aria-label="Cerrar">
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              <CamposMateria
                prefijo="nueva-mp"
                form={form}
                setForm={setForm}
                tipos={tipos}
                etiquetas={etiquetas}
                familias={familias}
                unidades={unidades}
                moneda={moneda}
                paises={paises}
                eligePais={eligePais}
                conPais
                reglasM3={reglasM3}
                onReglaUsada={(r) => { setRegla(r); if (r) setProveedor(r.id_proveedor); }}
              />

              <div className="bg-white border border-gray-200 rounded p-2">
                <label htmlFor="nueva-mp-proveedor" className="block text-xs font-semibold text-gray-700">Proveedor</label>
                <select
                  id="nueva-mp-proveedor"
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  value={proveedor ?? ""}
                  onChange={(e) => setProveedor(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Sin proveedor por ahora</option>
                  {proveedores
                    .filter((p) => !form.id_pais || !p.id_pais || p.id_pais === form.id_pais)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                </select>
                <span className="block text-[11px] text-gray-500 mt-1">
                  {proveedor
                    ? `Entra a la maestra del proveedor como preferente y el costo de arriba (${form.costo > 0 ? "neto" : "aun en 0"}) queda como su primer costo.`
                    : "Sin proveedor, el costo queda solo en la ficha del insumo. Se puede vincular despues desde la ficha."}
                  {regla && proveedor === regla.id_proveedor && " Su regla por m³ mantiene el costo al dia."}
                </span>
              </div>

              <label className="text-sm flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                <span className="text-gray-700">
                  Activo
                  <span className="block text-[11px] text-gray-500">Un insumo inactivo no se ofrece en el configurador ni al pedir materiales.</span>
                </span>
              </label>

              {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">{error}</div>}

              <div className="flex gap-2 pt-1">
                <button onClick={guardar} disabled={pendiente || !form.nombre.trim()} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40">
                  {pendiente ? "Grabando..." : "Crear"}
                </button>
                <button onClick={() => setAbierto(false)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
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
