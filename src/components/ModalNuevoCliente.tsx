"use client";

import { useEffect, useState, useTransition } from "react";
import {
  crearCliente,
  buscarClienteDuplicado,
  type DatosCliente,
  type ClienteChoque,
} from "@/app/clientes/acciones";
import type { Cliente } from "@/types/database";

const VACIO: DatosCliente = {
  razon_social: "",
  rut: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
};

// Alta de cliente en ventana emergente. Se usa desde el cotizador (donde
// abandonar la pantalla costaria la cotizacion en curso) y desde Clientes, de
// modo que la creacion tiene un solo camino y una sola comprobacion.
//
// El duplicado se avisa mientras se escribe y bloquea el boton de grabar; el
// servidor lo vuelve a comprobar y la base tiene indices unicos detras. Tres
// capas porque la de pantalla sola no resiste dos usuarios grabando a la vez.
export default function ModalNuevoCliente({
  onCreado,
  onCerrar,
}: {
  onCreado: (c: Cliente) => void;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState<DatosCliente>(VACIO);
  const [choque, setChoque] = useState<ClienteChoque | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar]);

  // Comprobacion en vivo, con una pausa para no consultar en cada tecla.
  useEffect(() => {
    const razon = form.razon_social.trim();
    const rut = form.rut.trim();
    if (!razon && !rut) {
      setChoque(null);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      const r = await buscarClienteDuplicado(razon, rut);
      if (!cancelado) setChoque(r);
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [form.razon_social, form.rut]);

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await crearCliente(form);
      if (r?.error) {
        setError(r.error);
        if (r.duplicado) setChoque(r.duplicado);
        return;
      }
      if (r?.cliente) onCreado(r.cliente as Cliente);
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const bloqueado = choque != null || !form.razon_social.trim();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded shadow-lg w-full max-w-xl mt-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-verde text-white px-4 py-2.5 rounded-t flex items-center justify-between">
          <span className="text-sm font-semibold">Nuevo cliente</span>
          <button
            onClick={onCerrar}
            className="text-white/80 hover:text-white text-lg leading-none"
            title="Cerrar (Esc)"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
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

          {choque && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded p-3">
              <strong>Este cliente ya existe.</strong>{" "}
              {choque.motivo === "rut" ? (
                <>
                  El RUT {choque.rut} ya esta registrado como &quot;
                  {choque.razon_social}&quot;.
                </>
              ) : (
                <>
                  Ya hay un cliente llamado &quot;{choque.razon_social}&quot;
                  {choque.rut ? ` (RUT ${choque.rut})` : ""}.
                </>
              )}{" "}
              No se puede crear otro igual.
              {!choque.activo && (
                <>
                  {" "}
                  Ademas esta desactivado: reactivelo en Clientes en vez de crear
                  uno nuevo.
                </>
              )}
            </div>
          )}

          {error && !choque && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={guardar}
              disabled={pendiente || bloqueado}
              className="bg-verde text-white text-sm font-semibold px-4 py-1.5 rounded disabled:opacity-40"
            >
              {pendiente ? "Grabando..." : "Crear cliente"}
            </button>
            <button
              onClick={onCerrar}
              className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded"
            >
              Cancelar
            </button>
            {!form.razon_social.trim() && (
              <span className="text-xs text-gray-500 self-center">
                La razon social es obligatoria.
              </span>
            )}
          </div>
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
