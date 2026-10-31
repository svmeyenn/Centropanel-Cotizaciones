"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarDatosCarga } from "@/app/datos-carga/acciones";

export interface FilaCarga {
  clase: "producto" | "materia";
  id: number;
  nombre: string;
  familia: string;
  ancho: number | null;
  largo: number | null;
  alto: number | null; // espesor en materias primas
  peso: number | null;
  densidad: number | null;
  pesoEfectivo: number | null;
  origen: string;
}

const input = "border border-gray-300 rounded px-1.5 py-1 text-xs w-20 text-right bg-white";
const txt = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
const aNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

function Fila({ f, puedeEditar, alGuardar }: { f: FilaCarga; puedeEditar: boolean; alGuardar: () => void }) {
  const [v, setV] = useState({ ancho: txt(f.ancho), largo: txt(f.largo), alto: txt(f.alto), peso: txt(f.peso), densidad: txt(f.densidad) });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const sucio = v.ancho !== txt(f.ancho) || v.largo !== txt(f.largo) || v.alto !== txt(f.alto) || v.peso !== txt(f.peso) || v.densidad !== txt(f.densidad);
  const campo = (k: keyof typeof v, etiqueta: string) => (
    <input aria-label={`${etiqueta} de ${f.nombre}`} inputMode="decimal" className={input} disabled={!puedeEditar} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
  );
  return (
    <tr className="border-t border-gray-100 hover:bg-crema align-top">
      <th scope="row" className="text-left px-3 py-2 font-normal">
        {f.nombre}
        <div className="text-[11px] text-gray-500">{f.clase === "producto" ? "Producto" : "Materia prima"} · {f.familia}</div>
      </th>
      <td className="px-2 py-2">{campo("ancho", "Ancho")}</td>
      <td className="px-2 py-2">{campo("largo", "Largo")}</td>
      <td className="px-2 py-2">{campo("alto", f.clase === "producto" ? "Alto" : "Espesor")}</td>
      <td className="px-2 py-2">{campo("peso", "Peso")}</td>
      <td className="px-2 py-2">{f.clase === "materia" ? campo("densidad", "Densidad") : <span className="text-gray-400">—</span>}</td>
      <td className="px-3 py-2 tabular-nums">
        {f.pesoEfectivo != null ? `${f.pesoEfectivo.toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg` : <span className="text-red-700">Falta</span>}
        <div className="text-[11px] text-gray-500">{f.origen === "calculado" ? "calculado de sus componentes" : f.origen === "catalogo" ? "del catalogo" : "sin dato"}</div>
      </td>
      <td className="px-3 py-2">
        {puedeEditar && sucio && (
          <button
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
            disabled={pendiente}
            onClick={() =>
              empezar(async () => {
                const r = await guardarDatosCarga(f.clase, f.id, { ancho_mm: aNum(v.ancho), largo_mm: aNum(v.largo), alto_mm: aNum(v.alto), peso_kg: aNum(v.peso), densidad_kg_m3: f.clase === "materia" ? aNum(v.densidad) : undefined });
                if (r.error) setError(r.error);
                else {
                  setError(null);
                  alGuardar();
                }
              })
            }
          >
            Guardar
          </button>
        )}
        {error && <div role="alert" className="text-[11px] text-red-700 mt-1 max-w-40">{error}</div>}
      </td>
    </tr>
  );
}

export default function DatosCargaTabla({ filas, puedeEditar }: { filas: FilaCarga[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [clase, setClase] = useState<"todas" | "producto" | "materia">("todas");
  const [soloFaltan, setSoloFaltan] = useState(true);

  const visibles = useMemo(
    () =>
      filas.filter(
        (f) =>
          (clase === "todas" || f.clase === clase) &&
          (!soloFaltan || f.pesoEfectivo == null) &&
          (q.trim() === "" || `${f.nombre} ${f.familia}`.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    [filas, q, clase, soloFaltan]
  );
  const faltan = filas.filter((f) => f.pesoEfectivo == null).length;
  const grupos = [...new Set(visibles.map((f) => f.familia))];

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600 max-w-3xl">
        El flete se cotiza con estos datos. Los paneles SIP calculan su peso desde sus componentes (placas y poliestireno): cargue peso a las placas y densidad al
        poliestireno y el panel queda resuelto. Hoy faltan datos de peso en <strong>{faltan}</strong> de {filas.length} items.
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          Buscar
          <input id="dc-q" className="border border-gray-300 rounded px-2 py-1 w-56 bg-white" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="flex items-center gap-1">
          Tipo
          <select id="dc-clase" className="border border-gray-300 rounded px-2 py-1 bg-white" value={clase} onChange={(e) => setClase(e.target.value as typeof clase)}>
            <option value="todas">Productos y materias primas</option>
            <option value="producto">Productos</option>
            <option value="materia">Materias primas</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input id="dc-faltan" type="checkbox" checked={soloFaltan} onChange={(e) => setSoloFaltan(e.target.checked)} />
          Solo con datos faltantes
        </label>
      </div>
      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th scope="col" className="text-left px-3 py-2">Item</th>
              <th scope="col" className="text-right px-2 py-2">Ancho (mm)</th>
              <th scope="col" className="text-right px-2 py-2">Largo (mm)</th>
              <th scope="col" className="text-right px-2 py-2">Alto / espesor (mm)</th>
              <th scope="col" className="text-right px-2 py-2">Peso (kg)</th>
              <th scope="col" className="text-right px-2 py-2">Densidad (kg/m³)</th>
              <th scope="col" className="text-left px-3 py-2">Peso usado</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          {visibles.length === 0 && (
            <tbody><tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No hay items con esos filtros.</td></tr></tbody>
          )}
          {grupos.map((g) => (
            <tbody key={g}>
              <tr className="bg-crema"><th colSpan={8} scope="colgroup" className="text-left px-3 py-1 text-dorado-osc font-semibold">{g}</th></tr>
              {visibles.filter((f) => f.familia === g).map((f) => (
                <Fila key={`${f.clase}-${f.id}-${f.peso}-${f.ancho}-${f.largo}-${f.alto}-${f.densidad}`} f={f} puedeEditar={puedeEditar} alGuardar={() => router.refresh()} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
