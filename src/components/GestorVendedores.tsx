"use client";

import { useMemo, useState, useTransition } from "react";
import {
  actualizarVendedor,
  crearVendedor,
  blanquearClave,
  type DatosVendedor,
} from "@/app/vendedores/acciones";
import type { Rol, Vendedor } from "@/types/database";
import CampoTelefono from "@/components/CampoTelefono";
import BotonExportar from "@/components/BotonExportar";

// Perfiles predefinidos, los mismos tres de Access. Vive en el cliente porque
// es logica pura: en un archivo "use server" toda exportacion debe ser async.
function privilegiosDeRol(rol: Rol) {
  switch (rol) {
    case "Administrador":
      return { puede_ver: true, puede_crear: true, puede_editar: true, puede_admin: true };
    // Todo lo del Administrador menos usuarios y claves.
    case "Supervisor":
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
  // "crear" cuando se esta dando de alta a alguien nuevo; el id cuando se
  // modifica a alguien existente.
  const [busca, setBusca] = useState("");
  const [rolFiltro, setRolFiltro] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [editando, setEditando] = useState<number | "crear" | null>(null);
  const [clave, setClave] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  // Blanqueo en curso: a quien y con que clave temporal, a la espera de confirmar.
  const [blanqueo, setBlanqueo] = useState<
    { id: number; nombre: string; clave: string } | null
  >(null);
  const [form, setForm] = useState<DatosVendedor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, empezar] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return vendedores.filter(
      (v) =>
        (!rolFiltro || v.rol === rolFiltro) &&
        (!soloActivos || v.activo) &&
        (!q ||
          v.nombre.toLowerCase().includes(q) ||
          (v.email ?? "").toLowerCase().includes(q))
    );
  }, [vendedores, busca, rolFiltro, soloActivos]);

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
      mercado: v.mercado ?? "Chile",
      puede_ver: v.puede_ver,
      puede_crear: v.puede_crear,
      puede_editar: v.puede_editar,
      puede_admin: v.puede_admin,
      activo: v.activo,
    });
  }

  function nuevo() {
    setEditando("crear");
    setError(null);
    setOk(false);
    setAviso(null);
    setClave(claveTemporal());
    setForm({
      nombre: "",
      cargo: "",
      email: "",
      telefono: "",
      rol: "Vendedor",
      mercado: "Chile",
      ...privilegiosDeRol("Vendedor"),
      activo: true,
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
    setAviso(null);
    empezar(async () => {
      if (editando === "crear") {
        const r = await crearVendedor(form, clave);
        if (r?.error) {
          setError(r.error);
          return;
        }
        setAviso(
          r?.confirmacionPendiente
            ? `${form.nombre} quedo creado. Le llego un correo a ${form.email} para confirmar la direccion; hasta que lo abra no podra entrar. Su clave temporal es ${clave}.`
            : `${form.nombre} quedo creado. Entregue la clave temporal ${clave}: el sistema le pedira cambiarla al entrar.`
        );
        setEditando(null);
        setForm(null);
        return;
      }
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
        <strong>Consulta</strong> solo mira. El <strong>mercado</strong> decide que
        clientes, productos y proveedores ve: Chile, Peru, o Ambos para quien
        trabaja los dos. Al crear a alguien se genera una clave temporal que
        usted le entrega; el sistema le pide cambiarla al entrar.
      </div>

      <div className="flex justify-end">
        <button
          onClick={nuevo}
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
        >
          + Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {aviso && (
        <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
          {aviso}
        </div>
      )}

      {blanqueo && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">
            Blanquear la clave de {blanqueo.nombre}
          </div>
          <p className="text-xs text-gray-600">
            Su clave actual deja de servir, se cierran sus sesiones abiertas y al
            entrar el sistema le pedira elegir una nueva.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-dorado-osc font-semibold">Clave temporal</span>
            <code className="bg-crema border border-dorado rounded px-2 py-1 text-sm">
              {blanqueo.clave}
            </code>
            <button
              type="button"
              onClick={() => setBlanqueo({ ...blanqueo, clave: claveTemporal() })}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              otra
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setError(null);
                  const r = await blanquearClave(blanqueo.id, blanqueo.clave);
                  if (r?.error) {
                    setError(r.error);
                    return;
                  }
                  setAviso(
                    `Clave de ${blanqueo.nombre} blanqueada. Entreguele la clave temporal ${blanqueo.clave}: al entrar el sistema le pedira cambiarla.`
                  );
                  setBlanqueo(null);
                })
              }
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
            >
              {pendiente ? "Blanqueando..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setBlanqueo(null)}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
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
            {editando === "crear" ? "Nuevo usuario" : "Modificar vendedor"}
            {editando === miId && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                (es su propia cuenta)
              </span>
            )}
          </div>

          {editando === "crear" && (
            <div className="bg-crema border border-dorado rounded p-3 text-xs space-y-1">
              <div className="text-dorado-osc font-semibold">
                Clave temporal
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-white border border-gray-200 rounded px-2 py-1 text-sm">
                  {clave}
                </code>
                <button
                  type="button"
                  onClick={() => setClave(claveTemporal())}
                  className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                >
                  otra
                </button>
              </div>
              <div className="text-gray-600">
                Antela o copiela ahora: despues de grabar no se vuelve a
                mostrar. El correo es con lo que entra al sistema.
              </div>
            </div>
          )}

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
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Telefono
              </span>
              <CampoTelefono
                valor={form.telefono}
                onChange={(v) => setForm({ ...form, telefono: v })}
                prefijo={form.mercado === "Peru" ? "+51" : "+56"}
                className={input}
              />
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">Perfil</span>
              <select
                className={input}
                value={form.rol}
                onChange={(e) => cambiarRol(e.target.value as Rol)}
              >
                <option value="Administrador">Administrador</option>
                <option value="Supervisor">Supervisor (sin gestion de usuarios)</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Consulta">Consulta</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Mercado
              </span>
              <select
                className={input}
                value={form.mercado}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mercado: e.target.value as "Chile" | "Peru" | "Ambos",
                  })
                }
              >
                <option value="Chile">Chile</option>
                <option value="Peru">Peru</option>
                <option value="Ambos">Ambos</option>
              </select>
              <span className="block text-[11px] text-gray-500 mt-0.5">
                Decide que clientes, productos e insumos ve. Administrador con
                Ambos es el administrador general.
              </span>
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
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
          placeholder="Buscar por nombre o correo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={rolFiltro}
          onChange={(e) => setRolFiltro(e.target.value)}
        >
          <option value="">Todos los perfiles</option>
          {[...new Set(vendedores.map((v) => v.rol))].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <label className="text-sm text-gray-600 flex items-center gap-2">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo activos
        </label>
        <BotonExportar
          nombre="vendedores"
          columnas={[
            { titulo: "Nombre", valor: (v) => v.nombre },
            { titulo: "Cargo", valor: (v) => v.cargo },
            { titulo: "Correo", valor: (v) => v.email },
            { titulo: "Telefono", valor: (v) => v.telefono },
            { titulo: "Perfil", valor: (v) => v.rol },
            { titulo: "Mercado", valor: (v) => v.mercado },
            { titulo: "Estado", valor: (v) => (v.activo ? "Activo" : "Inactivo") },
          ]}
          filas={filtrados}
          className="ml-auto"
        />
        <span className="text-sm text-gray-500">
          {filtrados.length} de {vendedores.length}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">Cargo</th>
                <th className="text-left px-3 py-2">Correo</th>
                <th className="text-left px-3 py-2 w-32">Perfil</th>
                <th className="text-left px-3 py-2 w-24">Mercado</th>
                <th className="text-center px-3 py-2 w-40">Privilegios</th>
                <th className="text-left px-3 py-2 w-20">Estado</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v) => (
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
                  <td className="px-3 py-2 text-gray-600">{v.mercado}</td>
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
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {v.id !== miId && v.user_id && (
                      <button
                        onClick={() => {
                          setError(null);
                          setAviso(null);
                          setBlanqueo({
                            id: v.id,
                            nombre: v.nombre,
                            clave: claveTemporal(),
                          });
                        }}
                        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                        title="Fija una clave temporal y obliga a cambiarla al entrar"
                      >
                        blanquear clave
                      </button>
                    )}
                    <button
                      onClick={() => editar(v)}
                      className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
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

// Clave de un solo uso para entrar la primera vez. Se muestra al administrador
// para que se la entregue; el sistema obliga a cambiarla al primer ingreso.
function claveTemporal() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minus = "abcdefghijkmnopqrstuvwxyz";
  const digitos = "23456789";
  const al = (s: string) => s[Math.floor(Math.random() * s.length)];
  return (
    al(letras) +
    Array.from({ length: 5 }, () => al(minus)).join("") +
    Array.from({ length: 3 }, () => al(digitos)).join("") +
    "!"
  );
}
