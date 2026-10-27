"use client";

import { useEffect, useState, useTransition } from "react";
import Ventana from "@/components/Ventana";
import { crearMateriaDesdeNecesidad, listasMateria, type ItemBuscado, type ListasMateria } from "@/app/necesidades/acciones";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";

// Ventana para dar de alta una materia prima sin salir de la necesidad. Entra con costo cero --lo fija la
// cotizacion o quien administra la maestra de materias primas--; al guardar, vuelve a la necesidad con el item
// listo para agregarse.
export default function VentanaNuevaMateria({
  idPais,
  nombreInicial,
  alCrear,
  alCerrar,
}: {
  idPais: number;
  nombreInicial: string;
  alCrear: (item: ItemBuscado) => void;
  alCerrar: () => void;
}) {
  const [listas, setListas] = useState<ListasMateria | null>(null);
  const [nombre, setNombre] = useState(nombreInicial);
  const [tipo, setTipo] = useState("");
  const [unidad, setUnidad] = useState("");
  const [familia, setFamilia] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    let vigente = true;
    listasMateria(idPais).then((l) => vigente && setListas(l));
    return () => {
      vigente = false;
    };
  }, [idPais]);

  function guardar() {
    setError(null);
    if (nombre.trim().length < 3) return setError("Escriba la descripcion (al menos 3 letras).");
    if (!tipo) return setError("Elija el tipo.");
    empezar(async () => {
      const r = await crearMateriaDesdeNecesidad({ id_pais: idPais, nombre, tipo, unidad, familia, etiqueta });
      if (!r.ok || !r.item) return setError(r.error ?? "No se pudo crear.");
      alCrear(r.item);
    });
  }

  return (
    <Ventana titulo="Nueva materia prima" subtitulo="Queda en la maestra y se agrega a esta necesidad" onCerrar={alCerrar} ancho="max-w-lg">
      <form
        className="space-y-3 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <div>
          <label htmlFor="mp-nombre" className={ROTULO}>Descripcion</label>
          <input id="mp-nombre" className={CAMPO} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={150} autoFocus required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mp-tipo" className={ROTULO}>Tipo</label>
            <select id="mp-tipo" className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)} required>
              <option value="">{listas ? "-- elija --" : "Cargando..."}</option>
              {(listas?.tipos ?? []).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mp-unidad" className={ROTULO}>Unidad</label>
            <input id="mp-unidad" className={CAMPO} value={unidad} onChange={(e) => setUnidad(e.target.value)} list="mp-unidades" maxLength={20} placeholder="un, kg, m2..." />
            <datalist id="mp-unidades">
              {(listas?.unidades ?? []).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="mp-familia" className={ROTULO}>Familia (opcional)</label>
            <input id="mp-familia" className={CAMPO} value={familia} onChange={(e) => setFamilia(e.target.value)} list="mp-familias" maxLength={60} />
            <datalist id="mp-familias">
              {(listas?.familias ?? []).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="mp-etiqueta" className={ROTULO}>Etiqueta (opcional)</label>
            <input id="mp-etiqueta" className={CAMPO} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} list="mp-etiquetas" maxLength={60} />
            <datalist id="mp-etiquetas">
              {(listas?.etiquetas ?? []).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
        </div>
        <p className="text-gray-600">Entra con costo cero: el costo lo fija la cotizacion del proveedor o quien administra la maestra de materias primas.</p>
        {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={alCerrar} disabled={pendiente} className="border border-gray-300 bg-white text-[11px] font-semibold px-2 py-1 rounded">
            Cancelar
          </button>
          <button type="submit" disabled={pendiente} className="bg-verde text-white text-[11px] font-semibold px-2.5 py-1 rounded disabled:opacity-50">
            {pendiente ? "Creando..." : "Crear y agregar"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
