"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { pesos } from "@/lib/formato";
import {
  actualizarMateria,
  cambiarActivoMateria,
  cargarCostos,
  recalcularCatalogo,
  type DatosMateria,
  type FilaCarga,
} from "@/app/materias-primas/acciones";
import type { MateriaPrima } from "@/types/database";
import ModalNuevaMateria from "@/components/ModalNuevaMateria";

interface Resumen {
  actualizados: number;
  sinCambio: number;
  noEncontrados: string[];
  recalculados: number;
  detalle: { nombre: string; antes: number; ahora: number }[];
}

export default function GestorMateriasPrimas({
  materias,
  etiquetas,
}: {
  materias: MateriaPrima[];
  etiquetas: string[];
}) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<DatosMateria | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [pendiente, empezar] = useTransition();
  const archivoRef = useRef<HTMLInputElement>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return materias.filter(
      (m) =>
        (!tipo || m.tipo === tipo) &&
        (!q ||
          m.nombre.toLowerCase().includes(q) ||
          (m.etiqueta ?? "").toLowerCase().includes(q))
    );
  }, [busca, tipo, materias]);

  function editar(m: MateriaPrima) {
    setEditando(m.id);
    setError(null);
    setForm({
      nombre: m.nombre,
      tipo: m.tipo,
      familia: m.familia ?? "",
      etiqueta: m.etiqueta ?? "",
      ancho_mm: m.ancho_mm,
      largo_mm: m.largo_mm,
      espesor_mm: m.espesor_mm,
      espesor_nominal: m.espesor_nominal,
      costo: m.costo,
      unidad: m.unidad ?? "",
    });
  }

  function guardar() {
    if (!form || editando == null) return;
    setError(null);
    empezar(async () => {
      const r = await actualizarMateria(editando, form);
      if (r?.error) setError(r.error);
      else {
        setEditando(null);
        setForm(null);
      }
    });
  }

  // Lee un CSV con columnas nombre y costo. Se acepta separador ; o , porque
  // Excel en configuracion regional chilena exporta con punto y coma.
  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResumen(null);

    const lector = new FileReader();
    lector.onload = () => {
      try {
        const texto = String(lector.result ?? "");
        const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
        if (!lineas.length) {
          setError("El archivo esta vacio.");
          return;
        }
        const sep = lineas[0].includes(";") ? ";" : ",";
        const cab = lineas[0].split(sep).map((c) => c.trim().toLowerCase());
        const iNombre = cab.findIndex((c) => c.startsWith("nombre"));
        const iCosto = cab.findIndex((c) => c.startsWith("costo"));
        if (iNombre < 0 || iCosto < 0) {
          setError(
            'El archivo debe tener una fila de encabezado con las columnas "nombre" y "costo".'
          );
          return;
        }

        const filas: FilaCarga[] = [];
        for (const l of lineas.slice(1)) {
          const celdas = l.split(sep);
          const nombre = (celdas[iNombre] ?? "").trim().replace(/^"|"$/g, "");
          const crudo = (celdas[iCosto] ?? "").trim().replace(/^"|"$/g, "");
          if (!nombre) continue;
          // Formato chileno: 1.234,56 -> se quitan los puntos de miles y la
          // coma decimal pasa a punto.
          const num = Number(crudo.replace(/\./g, "").replace(",", "."));
          if (!Number.isFinite(num)) continue;
          filas.push({ nombre, costo: num });
        }

        if (!filas.length) {
          setError("No se encontro ninguna fila con nombre y costo validos.");
          return;
        }

        empezar(async () => {
          const r = await cargarCostos(filas);
          if (r?.error) setError(r.error);
          else if (r?.ok) setResumen(r as unknown as Resumen);
        });
      } catch {
        setError("No se pudo leer el archivo.");
      } finally {
        if (archivoRef.current) archivoRef.current.value = "";
      }
    };
    lector.readAsText(file, "utf-8");
  }

  function descargarPlantilla() {
    // La plantilla sale con los costos actuales: se edita la columna costo y se
    // vuelve a subir, que es como funcionaba la carga masiva en Access.
    const filas = [
      "nombre;costo",
      ...materias.map((m) => `"${m.nombre}";${m.costo}`),
    ];
    const blob = new Blob(["﻿" + filas.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "materias_primas_costos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <div className="space-y-4">
      {/* carga masiva */}
      <div className="bg-crema border border-dorado rounded p-4 space-y-2">
        <div className="text-sm font-semibold text-verde">
          Actualizacion masiva de costos
        </div>
        <p className="text-xs text-gray-600">
          Descargue la plantilla con los costos actuales, edite la columna{" "}
          <strong>costo</strong> y vuelva a subirla. Se actualiza por nombre y se
          recostean los paneles. Nunca se borra nada: un nombre que no exista se
          informa y se omite.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={descargarPlantilla}
            className="border border-verde text-verde text-xs font-semibold px-2.5 py-1 rounded"
          >
            Descargar plantilla
          </button>
          <label className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded cursor-pointer">
            Subir costos
            <input
              ref={archivoRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onArchivo}
            />
          </label>
          <button
            onClick={() =>
              empezar(async () => {
                const n = await recalcularCatalogo();
                setResumen({
                  actualizados: 0,
                  sinCambio: 0,
                  noEncontrados: [],
                  recalculados: n,
                  detalle: [],
                });
              })
            }
            className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded"
          >
            Solo recalcular catalogo
          </button>
          {pendiente && (
            <span className="text-xs text-gray-500">procesando...</span>
          )}
          <ModalNuevaMateria etiquetas={etiquetas} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {resumen && (
        <div className="bg-green-50 border border-green-200 text-green-900 text-sm rounded p-3 space-y-1">
          <div className="font-semibold">Carga terminada</div>
          <div>
            {resumen.actualizados} costos actualizados · {resumen.sinCambio} sin
            cambio · {resumen.recalculados} paneles recosteados
          </div>
          {resumen.noEncontrados.length > 0 && (
            <div className="text-amber-800">
              No se encontraron en la base ({resumen.noEncontrados.length}):{" "}
              {resumen.noEncontrados.slice(0, 5).join(", ")}
              {resumen.noEncontrados.length > 5 ? "..." : ""}
            </div>
          )}
          {resumen.detalle.length > 0 && (
            <ul className="text-xs mt-1 space-y-0.5">
              {resumen.detalle.map((d) => (
                <li key={d.nombre}>
                  {d.nombre}: {pesos(d.antes)} → <strong>{pesos(d.ahora)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
          placeholder="Buscar por nombre o etiqueta"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="EPS">EPS</option>
          <option value="Placa">Placa</option>
          <option value="Adhesivo">Adhesivo</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          {filtrados.length} de {materias.length}
        </span>
      </div>

      {/* formulario de edicion */}
      {form && editando != null && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">Modificar insumo</div>
          <div className="grid md:grid-cols-3 gap-3">
            <Campo
              label="Nombre"
              value={form.nombre}
              onChange={(v) => setForm({ ...form, nombre: v })}
              cls={input}
            />
            <Campo
              label="Etiqueta"
              value={form.etiqueta}
              onChange={(v) => setForm({ ...form, etiqueta: v })}
              cls={input}
            />
            <Campo
              label="Familia"
              value={form.familia}
              onChange={(v) => setForm({ ...form, familia: v })}
              cls={input}
            />
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Espesor nominal (mm)
              </span>
              <input
                type="number"
                className={input}
                value={form.espesor_nominal ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    espesor_nominal: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
              <span className="text-xs text-gray-500">
                Es el que usa el nombre del panel.
              </span>
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Costo</span>
              <input
                type="number"
                className={input}
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })}
              />
            </label>
            <Campo
              label="Unidad"
              value={form.unidad}
              onChange={(v) => setForm({ ...form, unidad: v })}
              cls={input}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button
              onClick={() => {
                setEditando(null);
                setForm(null);
              }}
              className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
            <span className="text-xs text-gray-500 self-center">
              Cambiar un costo no recostea solo: use &quot;Solo recalcular
              catalogo&quot;.
            </span>
          </div>
        </div>
      )}

      {/* tabla */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2 w-20">Tipo</th>
                <th className="text-left px-3 py-2 w-24">Etiqueta</th>
                <th className="text-right px-3 py-2 w-20">Esp.</th>
                <th className="text-right px-3 py-2 w-28">Costo</th>
                <th className="text-left px-3 py-2 w-20">Estado</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-2">{m.nombre}</td>
                  <td className="px-3 py-2 text-gray-600">{m.tipo}</td>
                  <td className="px-3 py-2 text-gray-600">{m.etiqueta}</td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {m.espesor_nominal ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {pesos(m.costo)}
                  </td>
                  <td className="px-3 py-2">
                    {m.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => editar(m)}
                      className="text-verde text-xs underline mr-2"
                    >
                      editar
                    </button>
                    <button
                      onClick={() =>
                        empezar(async () => {
                          await cambiarActivoMateria(m.id, !m.activo);
                        })
                      }
                      className="text-gray-500 text-xs underline"
                    >
                      {m.activo ? "desactivar" : "activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  cls,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cls: string;
}) {
  return (
    <label className="text-sm">
      <span className="block text-dorado-osc font-semibold mb-1">{label}</span>
      <input className={cls} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
