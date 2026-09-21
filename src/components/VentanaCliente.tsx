"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import CampoTelefono from "@/components/CampoTelefono";
import { actualizarCliente, type DatosCliente } from "@/app/clientes/acciones";
import { faltantesCliente } from "@/lib/validacion";
import { rut as fmtRut } from "@/lib/formato";

// Ficha del cliente abierta desde una cotizacion o un pedido: para completar
// el correo, la comuna o el telefono en el momento en que hacen falta, sin
// salir del documento ni perder lo que se estaba haciendo.
export interface FichaCliente {
  id: number;
  razon_social: string | null;
  rut: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  id_pais: number | null;
}

export default function VentanaCliente({
  cliente,
  etiquetaId = "RUT",
  prefijo = "+56",
  onCerrar,
}: {
  cliente: FichaCliente;
  etiquetaId?: string;
  prefijo?: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DatosCliente>({
    razon_social: cliente.razon_social ?? "",
    rut: cliente.rut ?? "",
    contacto: cliente.contacto ?? "",
    email: cliente.email ?? "",
    telefono: cliente.telefono ?? "",
    direccion: cliente.direccion ?? "",
    comuna: cliente.comuna ?? "",
    ciudad: cliente.ciudad ?? "",
    id_pais: cliente.id_pais,
  });
  const faltan = faltantesCliente(form);
  const cls = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  function grabar() {
    setError(null);
    empezar(async () => {
      const r = await actualizarCliente(cliente.id, form);
      if (r?.error) {
        setError(r.error);
        return;
      }
      // El documento que esta detras muestra los datos del cliente: se
      // refresca para que tome los nuevos. Lo que se estaba editando en la
      // pantalla no se pierde, React conserva el estado.
      router.refresh();
      onCerrar();
    });
  }

  const campo = (
    rotulo: string,
    clave: keyof DatosCliente,
    extra?: { placeholder?: string; onBlur?: (v: string) => string }
  ) => (
    <label className="text-sm">
      <span className="block text-dorado-osc font-semibold mb-1">{rotulo}</span>
      <input
        className={cls}
        value={String(form[clave] ?? "")}
        placeholder={extra?.placeholder}
        onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
        onBlur={
          extra?.onBlur
            ? (e) => setForm({ ...form, [clave]: extra.onBlur!(e.target.value) })
            : undefined
        }
      />
    </label>
  );

  return (
    <Ventana
      titulo="Datos del cliente"
      subtitulo={form.razon_social}
      onCerrar={onCerrar}
    >
      <div className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          {campo("Razon social *", "razon_social")}
          {campo(etiquetaId, "rut", { placeholder: "12.345.678-9", onBlur: fmtRut })}
          {campo("Contacto *", "contacto")}
          {campo("Correo", "email")}
          <label className="text-sm">
            <span className="block text-dorado-osc font-semibold mb-1">Telefono *</span>
            <CampoTelefono
              valor={form.telefono}
              onChange={(v) => setForm({ ...form, telefono: v })}
              prefijo={prefijo}
              className={cls}
              requerido
            />
          </label>
          {campo("Direccion", "direccion")}
          {campo("Comuna", "comuna")}
          {campo("Ciudad *", "ciudad")}
        </div>

        {faltan.length > 0 && (
          <div className="text-xs text-gray-500">
            Falta{faltan.length > 1 ? "n" : ""}: {faltan.join(", ")}.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={grabar}
            disabled={pendiente || faltan.length > 0}
            className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
          >
            {pendiente ? "Grabando..." : "Grabar"}
          </button>
          <button
            onClick={onCerrar}
            className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Ventana>
  );
}
