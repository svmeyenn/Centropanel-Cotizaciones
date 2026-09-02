"use client";

import { useMemo, useState, useTransition } from "react";
import {
  actualizarCliente,
  cambiarActivoCliente,
  type DatosCliente,
} from "@/app/clientes/acciones";
import ModalNuevoCliente from "@/components/ModalNuevoCliente";
import type { Cliente } from "@/types/database";
import { useRouter } from "next/navigation";

const VACIO: DatosCliente = {
  razon_social: "",
  rut: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
};

export default function GestorClientes({
  clientes,
  puedeEditar,
}: {
  clientes: Cliente[];
  puedeEditar: boolean;
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
              label="Razon social"
              value={form.razon_social}
              onChange={(v) => setForm({ ...form, razon_social: v })}
              cls={inputCls}
            />
            <Campo
              label="RUT"
              value={form.rut}
              onChange={(v) => setForm({ ...form, rut: v })}
              cls={inputCls}
            />
            <Campo
              label="Contacto"
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
            <Campo
              label="Telefono"
              value={form.telefono}
              onChange={(v) => setForm({ ...form, telefono: v })}
              cls={inputCls}
            />
            <Campo
              label="Direccion"
              value={form.direccion}
              onChange={(v) => setForm({ ...form, direccion: v })}
              cls={inputCls}
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
              onClick={() => setEditando(null)}
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
                        className="text-verde text-xs underline mr-2"
                      >
                        editar
                      </button>
                      <button
                        onClick={() =>
                          empezar(async () => {
                            await cambiarActivoCliente(c.id, !c.activo);
                          })
                        }
                        className="text-gray-500 text-xs underline"
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
