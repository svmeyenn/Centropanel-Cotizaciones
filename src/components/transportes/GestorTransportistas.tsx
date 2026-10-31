"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanderaDe } from "@/components/Bandera";
import Ventana from "@/components/Ventana";
import CampoTelefono from "@/components/CampoTelefono";
import { rut as fmtRut } from "@/lib/formato";
import ListaBuscable from "@/components/transportes/ListaBuscable";
import { crearTransportista, marcarProveedorTransportista, type DatosTransportista } from "@/app/transportistas/acciones";
import type { Pais } from "@/types/database";

interface Fila {
  id: number;
  razon_social: string;
  rut: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  id_pais: number | null;
  activo: boolean;
  cobertura: string | null;
  vehiculos: number;
  tarifas: number;
}

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

const vacio = (pais: number | null): DatosTransportista => ({
  razon_social: "",
  rut: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  cobertura: "",
  notas: "",
  id_pais: pais,
});

export default function GestorTransportistas({
  filas,
  proveedores,
  paises,
  esAdminGeneral,
  puedeEditar,
}: {
  filas: Fila[];
  proveedores: { id: number; razon_social: string }[];
  paises: Pais[];
  esAdminGeneral: boolean;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const paisPorDefecto = paises.length === 1 ? paises[0].id : null;
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState<DatosTransportista>(vacio(paisPorDefecto));
  const [existente, setExistente] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const pais = paises.find((p) => p.id === form.id_pais) ?? paises[0];

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((f) => (!soloActivos || f.activo) && (!q || f.razon_social.toLowerCase().includes(q)));
  }, [busca, soloActivos, filas]);

  function crear() {
    setError(null);
    empezar(async () => {
      const r = await crearTransportista(form);
      if (r?.error) setError(r.error);
      else if (r?.id) {
        setNuevo(false);
        setForm(vacio(paisPorDefecto));
        router.push(`/transportistas/${r.id}`);
      }
    });
  }

  function marcar() {
    if (!existente) return;
    setError(null);
    empezar(async () => {
      try {
        const r = await marcarProveedorTransportista(Number(existente));
        if (r?.error) setError(r.error);
        else router.push(`/transportistas/${existente}`);
      } catch {
        setError("No se pudo marcar al proveedor como transportista. Recargue la pagina e intente de nuevo.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          aria-label="Buscar transportista"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
          placeholder="Buscar transportista"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="text-sm text-gray-600 flex items-center gap-2">
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
          Solo activos
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {visibles.length} de {filas.length}
        </span>
        {puedeEditar && (
          <button
            onClick={() => {
              setError(null);
              setForm(vacio(paisPorDefecto));
              setNuevo(true);
            }}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Nuevo transportista
          </button>
        )}
      </div>

      {puedeEditar && proveedores.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span>¿Ya es proveedor?</span>
          <ListaBuscable
            etiqueta="Proveedor existente"
            placeholder="Escribir para buscar un proveedor"
            opciones={proveedores.map((p) => ({ id: p.id, texto: p.razon_social }))}
            valor={existente ? Number(existente) : null}
            onChange={(id) => setExistente(id == null ? "" : String(id))}
          />
          <button
            onClick={marcar}
            disabled={!existente || pendiente}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
          >
            Marcar como transportista
          </button>
        </div>
      )}

      {error && !nuevo && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {nuevo && (
        <Ventana titulo="Nuevo transportista" subtitulo={form.razon_social} onCerrar={() => setNuevo(false)}>
          <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Campo label="Razon social *" value={form.razon_social} onChange={(v) => setForm({ ...form, razon_social: v })} />
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">{pais?.etiqueta_id ?? "RUT"} *</span>
                <input
                  className={input}
                  value={form.rut}
                  onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  onBlur={(e) => setForm({ ...form, rut: fmtRut(e.target.value) })}
                />
              </label>
              <Campo label="Contacto" value={form.contacto} onChange={(v) => setForm({ ...form, contacto: v })} />
              <Campo label="Correo" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Telefono</span>
                <CampoTelefono
                  valor={form.telefono}
                  onChange={(v) => setForm({ ...form, telefono: v })}
                  prefijo={pais?.prefijo_telefono ?? "+56"}
                  className={input}
                />
              </label>
              <Campo label="Direccion" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Pais *</span>
                <select
                  className={input}
                  value={form.id_pais ?? ""}
                  disabled={!esAdminGeneral}
                  onChange={(e) => setForm({ ...form, id_pais: Number(e.target.value) || null })}
                >
                  {esAdminGeneral && <option value="">-- elija --</option>}
                  {paises.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2">
                <Campo
                  label="Zonas que cubre"
                  value={form.cobertura}
                  onChange={(v) => setForm({ ...form, cobertura: v })}
                  placeholder="Ej: Region Metropolitana, Valparaiso, ruta sur hasta Los Angeles"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Los vehiculos y las tarifas se cargan en la ficha, despues de grabar.</p>
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={crear}
                disabled={pendiente || (esAdminGeneral && !form.id_pais)}
                className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
              >
                {pendiente ? "Grabando..." : "Grabar"}
              </button>
              <button onClick={() => setNuevo(false)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
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
                <th scope="col" className="text-left px-3 py-2">Transportista</th>
                <th scope="col" className="text-left px-3 py-2">Contacto</th>
                <th scope="col" className="text-left px-3 py-2">Zonas que cubre</th>
                <th scope="col" className="text-right px-3 py-2">Vehiculos</th>
                <th scope="col" className="text-right px-3 py-2">Tarifas</th>
                <th scope="col" className="text-left px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-8">
                    Sin transportistas que coincidan.
                  </td>
                </tr>
              )}
              {visibles.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 hover:bg-crema">
                  <th scope="row" className="text-left px-3 py-2 font-normal">
                    <BanderaDe idPais={f.id_pais} />
                    <Link href={`/transportistas/${f.id}`} className="text-verde font-semibold underline">
                      {f.razon_social}
                    </Link>
                    <div className="text-gray-500">{f.rut}</div>
                  </th>
                  <td className="px-3 py-2 text-gray-600">
                    {f.contacto}
                    <div>{[f.telefono, f.email].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{f.cobertura}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.vehiculos === 0 ? <span className="text-amber-700" title="Sin vehiculos registrados">0</span> : f.vehiculos}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.tarifas === 0 ? <span className="text-amber-700" title="Sin tarifas registradas">0</span> : f.tarifas}
                  </td>
                  <td className="px-3 py-2">{f.activo ? <span className="text-green-700">Activo</span> : <span className="text-gray-500">Inactivo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-sm">
      <span className="block text-dorado-osc font-semibold mb-1">{label}</span>
      <input className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
