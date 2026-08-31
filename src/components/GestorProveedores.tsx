"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  crearProveedor,
  actualizarProveedor,
  cambiarActivoProveedor,
  type DatosProveedor,
} from "@/app/proveedores/acciones";

interface Fila {
  id: number;
  razon_social: string;
  rut: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
  items: number;
}

const VACIO: DatosProveedor = {
  razon_social: "",
  rut: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  activo: true,
};

export default function GestorProveedores({
  proveedores,
}: {
  proveedores: Fila[];
}) {
  const [busca, setBusca] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [editando, setEditando] = useState<number | "nuevo" | null>(null);
  const [form, setForm] = useState<DatosProveedor>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return proveedores.filter(
      (p) =>
        (!soloActivos || p.activo) &&
        (!q || p.razon_social.toLowerCase().includes(q))
    );
  }, [busca, soloActivos, proveedores]);

  function guardar() {
    setError(null);
    empezar(async () => {
      const r =
        editando === "nuevo"
          ? await crearProveedor(form)
          : await actualizarProveedor(editando as number, form);
      if (r?.error) setError(r.error);
      else {
        setEditando(null);
        setForm(VACIO);
      }
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
          placeholder="Buscar proveedor"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="text-sm text-gray-600 flex items-center gap-2">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo activos
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {filtrados.length} de {proveedores.length}
        </span>
        <button
          onClick={() => {
            setError(null);
            setForm(VACIO);
            setEditando("nuevo");
          }}
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
        >
          Nuevo proveedor
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {editando != null && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">
            {editando === "nuevo" ? "Nuevo proveedor" : "Modificar proveedor"}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Campo
              label="Razon social"
              value={form.razon_social}
              onChange={(v) => setForm({ ...form, razon_social: v })}
              cls={input}
            />
            <Campo
              label="RUT"
              value={form.rut}
              onChange={(v) => setForm({ ...form, rut: v })}
              cls={input}
            />
            <Campo
              label="Contacto"
              value={form.contacto}
              onChange={(v) => setForm({ ...form, contacto: v })}
              cls={input}
            />
            <Campo
              label="Correo"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              cls={input}
            />
            <Campo
              label="Telefono"
              value={form.telefono}
              onChange={(v) => setForm({ ...form, telefono: v })}
              cls={input}
            />
            <Campo
              label="Direccion"
              value={form.direccion}
              onChange={(v) => setForm({ ...form, direccion: v })}
              cls={input}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={pendiente || !form.razon_social.trim()}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
            >
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button
              onClick={() => {
                setEditando(null);
                setForm(VACIO);
              }}
              className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Razon social</th>
                <th className="text-left px-3 py-2">RUT</th>
                <th className="text-left px-3 py-2">Contacto</th>
                <th className="text-left px-3 py-2">Correo</th>
                <th className="text-right px-3 py-2">Items</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">
                    Sin proveedores que coincidan.
                  </td>
                </tr>
              )}
              {filtrados.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-2">
                    <Link
                      href={`/proveedores/${p.id}`}
                      className="text-verde font-semibold underline"
                    >
                      {p.razon_social}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.rut ?? ""}</td>
                  <td className="px-3 py-2 text-gray-600">{p.contacto ?? ""}</td>
                  <td className="px-3 py-2 text-gray-600">{p.email ?? ""}</td>
                  <td className="px-3 py-2 text-right">
                    {p.items === 0 ? (
                      <span
                        className="text-amber-700"
                        title="Sin maestra: este proveedor no recibe solicitudes"
                      >
                        0
                      </span>
                    ) : (
                      p.items
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => {
                        setError(null);
                        setEditando(p.id);
                        setForm({
                          razon_social: p.razon_social,
                          rut: p.rut ?? "",
                          contacto: p.contacto ?? "",
                          email: p.email ?? "",
                          telefono: p.telefono ?? "",
                          direccion: p.direccion ?? "",
                          activo: p.activo,
                        });
                      }}
                      className="text-verde text-xs underline mr-2"
                    >
                      editar
                    </button>
                    <button
                      onClick={() =>
                        empezar(async () => {
                          await cambiarActivoProveedor(p.id, !p.activo);
                        })
                      }
                      className="text-gray-500 text-xs underline"
                    >
                      {p.activo ? "desactivar" : "activar"}
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
