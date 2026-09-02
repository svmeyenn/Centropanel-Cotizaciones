"use client";

import { useMemo, useState, useTransition } from "react";
import {
  actualizarCliente,
  cambiarActivoCliente,
  type DatosCliente,
} from "@/app/clientes/acciones";
import ModalNuevoCliente from "@/components/ModalNuevoCliente";
import type { Cliente, Pais } from "@/types/database";
import { faltantesCliente } from "@/lib/validacion";
import { rut as fmtRut } from "@/lib/formato";
import CampoTelefono from "@/components/CampoTelefono";
import { useRouter } from "next/navigation";

const VACIO: DatosCliente = {
  razon_social: "",
  rut: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  comuna: "",
  ciudad: "",
  id_pais: null,
};

export default function GestorClientes({
  clientes,
  puedeEditar,
  paises,
  esAdminGeneral,
}: {
  clientes: Cliente[];
  puedeEditar: boolean;
  paises: Pais[];
  esAdminGeneral: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<DatosCliente>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  // El alta va por la ventana emergente, la misma que usa el cotizador: un solo
  // camino de creacion y una sola comprobacion de duplicados. El formulario de
  // abajo queda para modificar.
  const [modalNuevo, setModalNuevo] = useState(false);
  const router = useRouter();

  // Filtrado en tiempo real sobre razon social, RUT y contacto: los mismos tres
  // campos que buscaba el cuadro de busqueda de frmClientes.
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.razon_social, c.rut, c.contacto]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q))
    );
  }, [busca, clientes]);

  function editar(c: Cliente) {
    setEditando(c.id);
    setError(null);
    setForm({
      razon_social: c.razon_social ?? "",
      rut: c.rut ?? "",
      contacto: c.contacto ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
      direccion: c.direccion ?? "",
      comuna: c.comuna ?? "",
      ciudad: c.ciudad ?? "",
      id_pais: c.id_pais ?? null,
    });
  }

  function guardar() {
    if (editando == null) return;
    setError(null);
    empezar(async () => {
      const r = await actualizarCliente(editando, form);
      if (r?.error) setError(r.error);
      else {
        setEditando(null);
        setForm(VACIO);
      }
    });
  }

  const paisDelForm =
    paises.find((x) => x.id === form.id_pais) ?? paises[0];
  const prefijo = paisDelForm?.prefijo_telefono ?? "+56";
  const etiquetaId = paisDelForm?.etiqueta_id ?? "RUT";
  const faltan = faltantesCliente(form);

  const inputCls = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-72"
          placeholder="Buscar por razon social, RUT o contacto"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {puedeEditar && (
          <button
            onClick={() => setModalNuevo(true)}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Nuevo cliente
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {editando !== null && (
        <div className="bg-white border border-dorado rounded p-4 space-y-3">
          <div className="text-sm font-semibold text-verde">Modificar cliente</div>
          <div className="grid md:grid-cols-2 gap-3">
            <Campo
              label="Razon social *"
              value={form.razon_social}
              onChange={(v) => setForm({ ...form, razon_social: v })}
              cls={inputCls}
            />
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                {etiquetaId}
              </span>
              <input
                className={inputCls}
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
              cls={inputCls}
            />
            <Campo
              label="Correo"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              cls={inputCls}
            />
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Telefono *
              </span>
              <CampoTelefono
                valor={form.telefono}
                onChange={(v) => setForm({ ...form, telefono: v })}
                prefijo={prefijo}
                className={inputCls}
                requerido
              />
            </label>
            <Campo
              label="Direccion"
              value={form.direccion}
              onChange={(v) => setForm({ ...form, direccion: v })}
              cls={inputCls}
            />
            <Campo
              label="Comuna"
              value={form.comuna}
              onChange={(v) => setForm({ ...form, comuna: v })}
              cls={inputCls}
            />
            <Campo
              label="Ciudad *"
              value={form.ciudad}
              onChange={(v) => setForm({ ...form, ciudad: v })}
              cls={inputCls}
            />
            <label className="text-sm">
              <span className="block text-dorado-osc font-semibold mb-1">
                Pais *
              </span>
              <select
                className={inputCls}
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
              {!esAdminGeneral && (
                <span className="block text-[11px] text-gray-500 mt-0.5">
                  Solo el administrador general puede cambiar de mercado.
                </span>
              )}
            </label>
          </div>
          {faltan.length > 0 && (
            <div className="text-xs text-gray-500">
              Falta{faltan.length > 1 ? "n" : ""}: {faltan.join(", ")}.
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={pendiente || faltan.length > 0}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Grabando..." : "Grabar"}
            </button>
            <button
              onClick={() => setEditando(null)}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
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
                <th className="text-left px-3 py-2">Razon social</th>
                <th className="text-left px-3 py-2 w-32">RUT</th>
                <th className="text-left px-3 py-2">Contacto</th>
                <th className="text-left px-3 py-2">Correo</th>
                <th className="text-left px-3 py-2 w-32">Telefono</th>
                <th className="text-left px-3 py-2 w-20">Estado</th>
                {puedeEditar && <th className="w-28" />}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">
                    Sin clientes que coincidan.
                  </td>
                </tr>
              )}
              {filtrados.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-2 font-semibold">{c.razon_social}</td>
                  <td className="px-3 py-2">{c.rut}</td>
                  <td className="px-3 py-2">{c.contacto}</td>
                  <td className="px-3 py-2">{c.email}</td>
                  <td className="px-3 py-2">{c.telefono}</td>
                  <td className="px-3 py-2">
                    {c.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                  {puedeEditar && (
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => editar(c)}
                        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                      >
                        editar
                      </button>
                      <button
                        onClick={() =>
                          empezar(async () => {
                            await cambiarActivoCliente(c.id, !c.activo);
                          })
                        }
                        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                      >
                        {c.activo ? "desactivar" : "activar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalNuevo && (
        <ModalNuevoCliente
          paises={paises}
          eligePais={esAdminGeneral}
          onCerrar={() => setModalNuevo(false)}
          onCreado={() => {
            setModalNuevo(false);
            // Aqui si conviene recargar: la tabla la trae el servidor y no hay
            // nada a medio escribir que se pueda perder.
            router.refresh();
          }}
        />
      )}
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
