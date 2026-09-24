"use client";

import BotonExportar from "@/components/BotonExportar";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  crearProveedor,
  actualizarProveedor,
  cambiarActivoProveedor,
  type DatosProveedor,
} from "@/app/proveedores/acciones";
import type { Pais } from "@/types/database";
import Ventana from "@/components/Ventana";
import { faltantesProveedor } from "@/lib/validacion";
import { rut as fmtRut } from "@/lib/formato";
import CampoTelefono from "@/components/CampoTelefono";

interface Fila {
  id: number;
  razon_social: string;
  rut: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  id_pais: number | null;
  activo: boolean;
  items: number;
}

const vacio = (pais: number | null): DatosProveedor => ({
  id_pais: pais,
  razon_social: "",
  rut: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  activo: true,
});

export default function GestorProveedores({
  proveedores,
  paises,
  esAdminGeneral,
}: {
  proveedores: Fila[];
  paises: Pais[];
  esAdminGeneral: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  // Quien trabaja un solo mercado no elige: su pais viene puesto. El
  // administrador general, que alcanza los dos, tiene que decidir.
  const paisPorDefecto = paises.length === 1 ? paises[0].id : null;

  const [editando, setEditando] = useState<number | "nuevo" | null>(null);
  const [form, setForm] = useState<DatosProveedor>(vacio(paisPorDefecto));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const paisDelForm = paises.find((x) => x.id === form.id_pais) ?? paises[0];
  const prefijo = paisDelForm?.prefijo_telefono ?? "+56";
  const etiquetaId = paisDelForm?.etiqueta_id ?? "RUT";
  // En la lista: el del mercado activo, o los dos en la vista Todos.
  const etiquetaLista =
    paises.length === 1
      ? paises[0].etiqueta_id
      : [...new Set(paises.map((x) => x.etiqueta_id))].join(" / ") || "RUT";
  const faltan = faltantesProveedor(form, etiquetaId);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return proveedores.filter(
      (p) =>
        (!soloActivos || p.activo) &&
        (!q || p.razon_social.toLowerCase().includes(q))
    );
  }, [busca, soloActivos, proveedores]);

  function abrirFicha(p: {
    id: number;
    razon_social: string;
    rut: string | null;
    contacto: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
    id_pais: number | null;
    activo: boolean;
  }) {
    setError(null);
    setEditando(p.id);
    setForm({
      razon_social: p.razon_social,
      rut: p.rut ?? "",
      contacto: p.contacto ?? "",
      email: p.email ?? "",
      telefono: p.telefono ?? "",
      direccion: p.direccion ?? "",
      id_pais: p.id_pais,
      activo: p.activo,
    });
  }

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
        setForm(vacio(paisPorDefecto));
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
        <BotonExportar
          nombre="proveedores"
          columnas={[
            { titulo: "Razon social", valor: (p) => p.razon_social },
            { titulo: "RUT", valor: (p) => p.rut },
            { titulo: "Contacto", valor: (p) => p.contacto },
            { titulo: "Correo", valor: (p) => p.email },
            { titulo: "Items en maestra", valor: (p) => p.items },
            { titulo: "Estado", valor: (p) => (p.activo ? "Activo" : "Inactivo") },
          ]}
          filas={filtrados}
          className="ml-auto"
        />
        <span className="text-sm text-gray-500">
          {filtrados.length} de {proveedores.length}
        </span>
        <button
          onClick={() => {
            setError(null);
            setForm(vacio(paisPorDefecto));
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
        <Ventana
          titulo={editando === "nuevo" ? "Nuevo proveedor" : "Ficha del proveedor"}
          subtitulo={form.razon_social}
          onCerrar={() => { setEditando(null); setForm(vacio(paisPorDefecto)); }}
        >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-verde">
              {editando === "nuevo" ? "Nuevo proveedor" : "Modificar proveedor"}
            </div>
            {editando !== "nuevo" && (
              <Link
                href={`/proveedores/${editando}`}
                className="text-xs text-verde underline"
              >
                Abrir la ficha completa (items que provee)
              </Link>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Campo
              label="Razon social *"
              value={form.razon_social}
              onChange={(v) => setForm({ ...form, razon_social: v })}
              cls={input}
            />
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                {etiquetaId} *
              </span>
              <input
                className={input}
                value={form.rut}
                placeholder="12.345.678-9"
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
                onBlur={(e) => setForm({ ...form, rut: fmtRut(e.target.value) })}
              />
            </label>
            <Campo
              label="Contacto *"
              value={form.contacto}
              onChange={(v) => setForm({ ...form, contacto: v })}
              cls={input}
            />
            <Campo
              label="Correo *"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              cls={input}
            />
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Telefono *
              </span>
              <CampoTelefono
                valor={form.telefono}
                onChange={(v) => setForm({ ...form, telefono: v })}
                prefijo={prefijo}
                className={input}
                requerido
              />
            </label>
            <Campo
              label="Direccion *"
              value={form.direccion}
              onChange={(v) => setForm({ ...form, direccion: v })}
              cls={input}
            />
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Pais *
              </span>
              <select
                className={input}
                value={form.id_pais ?? ""}
                disabled={!esAdminGeneral}
                onChange={(e) =>
                  setForm({ ...form, id_pais: Number(e.target.value) || null })
                }
              >
                {esAdminGeneral && <option value="">-- elija --</option>}
                {paises.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {faltan.length > 0 && (
            <div className="text-xs text-gray-500">
              Al proveedor no le puede faltar ninguno. Falta
              {faltan.length > 1 ? "n" : ""}: {faltan.join(", ")}.
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={pendiente || faltan.length > 0}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
            >
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button
              onClick={() => {
                setEditando(null);
                setForm(vacio(paisPorDefecto));
              }}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
        </Ventana>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Razon social</th>
                <th className="text-left px-3 py-2">{etiquetaLista}</th>
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
                    <button
                      onClick={() => abrirFicha(p)}
                      className="text-verde font-semibold underline text-left"
                      title="Ver la ficha del proveedor"
                    >
                      {p.razon_social}
                    </button>
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
                      onClick={() => abrirFicha(p)}
                      className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                    >
                      editar
                    </button>
                    <button
                      onClick={() =>
                        empezar(async () => {
                          await cambiarActivoProveedor(p.id, !p.activo);
                        })
                      }
                      className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
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
