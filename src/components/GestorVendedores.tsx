"use client";

import { useState, useTransition } from "react";
import { actualizarVendedor, type DatosVendedor } from "@/app/vendedores/acciones";
import type { Rol, Vendedor } from "@/types/database";

// Perfiles predefinidos, los mismos tres de Access. Vive en el cliente porque
// es logica pura: en un archivo "use server" toda exportacion debe ser async.
function privilegiosDeRol(rol: Rol) {
  switch (rol) {
    case "Administrador":
      return { puede_ver: true, puede_crear: true, puede_editar: true, puede_admin: true };
    case "Vendedor":
      return { puede_ver: true, puede_crear: true, puede_editar: true, puede_admin: false };
    case "Consulta":
      return { puede_ver: true, puede_crear: false, puede_editar: false, puede_admin: false };
  }
}

export default function GestorVendedores({
  vendedores,
  miId,
}: {
  vendedores: Vendedor[];
  miId: number;
}) {
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<DatosVendedor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, empezar] = useTransition();

  function editar(v: Vendedor) {
    setEditando(v.id);
    setError(null);
    setOk(false);
    setForm({
      nombre: v.nombre,
      cargo: v.cargo ?? "",
      email: v.email ?? "",
      telefono: v.telefono ?? "",
      rol: v.rol,
      puede_ver: v.puede_ver,
      puede_crear: v.puede_crear,
      puede_editar: v.puede_editar,
      puede_admin: v.puede_admin,
      activo: v.activo,
    });
  }

  function cambiarRol(rol: Rol) {
    if (!form) return;
    // Al elegir un perfil se aplican sus privilegios; despues se pueden afinar
    // uno a uno, igual que en frmPrivilegios.
    setForm({ ...form, rol, ...privilegiosDeRol(rol) });
  }

  function guardar() {
    if (!form || editando == null) return;
    setError(null);
    setOk(false);
    empezar(async () => {
      const r = await actualizarVendedor(editando, form);
      if (r?.error) setError(r.error);
      else {
        setOk(true);
        setEditando(null);
        setForm(null);
      }
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 text-sm rounded p-3">
        El perfil define que puede hacer cada persona. <strong>Administrador</strong>{" "}
        ve costos y parametros; <strong>Vendedor</strong> cotiza sin ver costos;{" "}
        <strong>Consulta</strong> solo mira. Las contrasenas no se gestionan aqui:
        cada uno la cambia desde su correo con &quot;olvide mi contrasena&quot;.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {ok && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
          Cambios guardados.
        </div>
      )}

      {form && editando != null && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">
            Modificar vendedor
            {editando === miId && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                (es su propia cuenta)
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Campo
              label="Nombre"
              value={form.nombre}
              onChange={(v) => setForm({ ...form, nombre: v })}
              cls={input}
            />
            <Campo
              label="Cargo"
              value={form.cargo}
              onChange={(v) => setForm({ ...form, cargo: v })}
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
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Perfil</span>
              <select
                className={input}
                value={form.rol}
                onChange={(e) => cambiarRol(e.target.value as Rol)}
              >
                <option value="Administrador">Administrador</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Consulta">Consulta</option>
              </select>
            </label>
            <label className="text-sm flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              <span className="text-gray-700">Cuenta activa</span>
            </label>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="text-xs text-dorado-osc font-semibold mb-2">
              PRIVILEGIOS
            </div>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["puede_ver", "Ver"],
                  ["puede_crear", "Crear"],
                  ["puede_editar", "Editar"],
                  ["puede_admin", "Administrar"],
                ] as const
              ).map(([k, etiqueta]) => (
                <label key={k} className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                  />
                  <span className="text-gray-700">{etiqueta}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Un Administrador tiene acceso total aunque alguna casilla quede sin
              marcar: el perfil manda sobre los privilegios sueltos.
            </p>
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
              className="border border-verde text-verde text-xs px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">Cargo</th>
                <th className="text-left px-3 py-2">Correo</th>
                <th className="text-left px-3 py-2 w-32">Perfil</th>
                <th className="text-center px-3 py-2 w-40">Privilegios</th>
                <th className="text-left px-3 py-2 w-20">Estado</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-2 font-semibold">
                    {v.nombre}
                    {v.id === miId && (
                      <span className="ml-2 text-[10px] bg-dorado text-white px-1.5 py-0.5 rounded">
                        usted
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{v.cargo}</td>
                  <td className="px-3 py-2 text-gray-600">{v.email}</td>
                  <td className="px-3 py-2">{v.rol}</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-600">
                    {[
                      v.puede_ver && "Ver",
                      v.puede_crear && "Crear",
                      v.puede_editar && "Editar",
                      v.puede_admin && "Admin",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "sin privilegios"}
                  </td>
                  <td className="px-3 py-2">
                    {v.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => editar(v)}
                      className="text-verde text-xs underline"
                    >
                      editar
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
