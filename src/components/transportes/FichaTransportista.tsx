"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CampoTelefono from "@/components/CampoTelefono";
import { rut as fmtRut } from "@/lib/formato";
import {
  TIPOS_COBRO,
  TIPOS_VEHICULO,
  actualizarTransportista,
  eliminarTarifa,
  guardarTarifa,
  guardarVehiculo,
  type DatosTarifa,
  type DatosTransportista,
  type DatosVehiculo,
} from "@/app/transportistas/acciones";

interface Vehiculo extends DatosVehiculo {
  id: number;
}
interface Tarifa extends DatosTarifa {
  id: number;
}

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full bg-white";
const BTN = "bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40";
const BTN_CLARO = "border border-gray-300 bg-white text-gray-800 text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40";
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

const VEH_VACIO: DatosVehiculo = { tipo: "Camioneta", patente: "", descripcion: "", capacidad_kg: null, capacidad_m3: null, largo_carga_m: null, activo: true, notas: "" };
const tarifaVacia = (moneda: string): DatosTarifa => ({
  id_vehiculo: null, origen: "", destino: "", tipo_cobro: "Viaje", monto: 0, moneda, vigente_desde: "", vigente_hasta: "", activa: true, notas: "",
});

export default function FichaTransportista({
  id,
  datos,
  etiquetaId,
  prefijo,
  moneda,
  vehiculos,
  tarifas,
  usoPedidos,
  usoOC,
  puedeEditar,
}: {
  id: number;
  datos: Omit<DatosTransportista, "id_pais"> & { activo: boolean };
  etiquetaId: string;
  prefijo: string;
  moneda: string;
  vehiculos: Vehiculo[];
  tarifas: Tarifa[];
  usoPedidos: { id: number; num: string; fecha: string; flete: number | null; estado: string }[];
  usoOC: { id: number; num: string; fecha: string; estado: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<DatosTransportista & { activo: boolean }>({ ...datos });
  const [editaDatos, setEditaDatos] = useState(false);
  const [veh, setVeh] = useState<{ id: number | null; d: DatosVehiculo } | null>(null);
  const [tar, setTar] = useState<{ id: number | null; d: DatosTarifa } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function correr(fn: () => Promise<{ error?: string } | undefined>, ok: string, despues?: () => void) {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setAviso(ok);
        despues?.();
        router.refresh();
      }
    });
  }

  const nombreVeh = (idV: number | null) => {
    if (idV == null) return "Tarifa general";
    const x = vehiculos.find((y) => y.id === idV);
    return x ? `${x.tipo} ${x.patente}` : "—";
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="sticky top-2 z-10 shadow bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {aviso && (
        <div role="status" className="sticky top-2 z-10 shadow bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
          {aviso}
        </div>
      )}

      <section aria-labelledby="t-datos" className="bg-white border border-gray-200 rounded p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-datos" className="text-sm font-semibold text-verde">
            Datos {!datos.activo && <span className="text-gray-500 font-normal">· inactivo</span>}
          </h2>
          {puedeEditar && !editaDatos && (
            <button className={BTN} onClick={() => { setForm({ ...datos }); setEditaDatos(true); }}>
              editar
            </button>
          )}
        </div>
        {editaDatos ? (
          <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Campo label="Razon social *" value={form.razon_social} onChange={(v) => setForm({ ...form, razon_social: v })} />
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">{etiquetaId} *</span>
                <input className={input} value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} onBlur={(e) => setForm({ ...form, rut: fmtRut(e.target.value) })} />
              </label>
              <Campo label="Contacto" value={form.contacto} onChange={(v) => setForm({ ...form, contacto: v })} />
              <Campo label="Correo" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Telefono</span>
                <CampoTelefono valor={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} prefijo={prefijo} className={input} />
              </label>
              <Campo label="Direccion" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
              <div className="md:col-span-2">
                <Campo label="Zonas que cubre" value={form.cobertura} onChange={(v) => setForm({ ...form, cobertura: v })} />
              </div>
              <label className="text-sm flex items-end gap-2 pb-1">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                <span>Activo (se ofrece al elegir transportista)</span>
              </label>
              <div className="md:col-span-3">
                <Campo label="Notas" value={form.notas} onChange={(v) => setForm({ ...form, notas: v })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className={BTN} disabled={pendiente} onClick={() => correr(() => actualizarTransportista(id, form), "Datos guardados.", () => setEditaDatos(false))}>
                {pendiente ? "Grabando..." : "Grabar"}
              </button>
              <button className={BTN} onClick={() => setEditaDatos(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Dato t={etiquetaId} v={datos.rut} />
            <Dato t="Contacto" v={datos.contacto} />
            <Dato t="Telefono" v={datos.telefono} />
            <Dato t="Correo" v={datos.email} />
            <Dato t="Direccion" v={datos.direccion} />
            <Dato t="Zonas que cubre" v={datos.cobertura} ancho="lg:col-span-2" />
            <Dato t="Notas" v={datos.notas} />
          </dl>
        )}
        <p className="text-xs text-gray-500">
          Tambien es proveedor: sus facturas se cargan como egresos con este mismo nombre. Si ademas vende materiales, su maestra esta en{" "}
          <Link href={`/proveedores/${id}`} className="underline text-verde">Proveedores</Link>.
        </p>
      </section>

      <section aria-labelledby="t-veh" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-veh" className="text-sm font-semibold text-verde">Camiones y camionetas</h2>
          {puedeEditar && !veh && (
            <button className={BTN} onClick={() => setVeh({ id: null, d: { ...VEH_VACIO } })}>+ Agregar vehiculo</button>
          )}
        </div>
        {veh && (
          <div key={veh.id ?? "nuevo"} className="border border-dorado bg-crema rounded p-4 space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Tipo</span>
                <select className={input} value={veh.d.tipo} onChange={(e) => setVeh({ ...veh, d: { ...veh.d, tipo: e.target.value } })}>
                  {TIPOS_VEHICULO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <Campo label="Patente *" value={veh.d.patente} onChange={(v) => setVeh({ ...veh, d: { ...veh.d, patente: v.toUpperCase() } })} />
              <Campo label="Descripcion" value={veh.d.descripcion} placeholder="Marca, modelo, color" onChange={(v) => setVeh({ ...veh, d: { ...veh.d, descripcion: v } })} />
              <Numero label="Capacidad (kg)" value={veh.d.capacidad_kg} onChange={(n) => setVeh({ ...veh, d: { ...veh.d, capacidad_kg: n } })} />
              <Numero label="Volumen (m³)" value={veh.d.capacidad_m3} onChange={(n) => setVeh({ ...veh, d: { ...veh.d, capacidad_m3: n } })} />
              <Numero label="Largo de carga (m)" value={veh.d.largo_carga_m} onChange={(n) => setVeh({ ...veh, d: { ...veh.d, largo_carga_m: n } })} ayuda="Un panel mide 2,44 m" />
              <Campo label="Notas" value={veh.d.notas} onChange={(v) => setVeh({ ...veh, d: { ...veh.d, notas: v } })} />
              <label className="text-sm flex items-end gap-2 pb-1">
                <input type="checkbox" checked={veh.d.activo} onChange={(e) => setVeh({ ...veh, d: { ...veh.d, activo: e.target.checked } })} />
                <span>Disponible</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button className={BTN} disabled={pendiente} onClick={() => correr(() => guardarVehiculo(id, veh.id, veh.d), "Vehiculo guardado.", () => setVeh(null))}>
                {pendiente ? "Grabando..." : "Grabar vehiculo"}
              </button>
              <button className={BTN} onClick={() => setVeh(null)}>Cancelar</button>
            </div>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2">Vehiculo</th>
                  <th scope="col" className="text-left px-3 py-2">Patente</th>
                  <th scope="col" className="text-right px-3 py-2">Capacidad (kg)</th>
                  <th scope="col" className="text-right px-3 py-2">Volumen (m³)</th>
                  <th scope="col" className="text-right px-3 py-2">Largo de carga (m)</th>
                  <th scope="col" className="text-left px-3 py-2">Estado</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {vehiculos.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Sin vehiculos registrados.</td></tr>
                )}
                {vehiculos.map((x) => (
                  <tr key={x.id} className={`border-t border-gray-100 hover:bg-crema ${x.activo ? "" : "text-gray-500"}`}>
                    <th scope="row" className="text-left px-3 py-1.5 font-semibold">
                      {x.tipo}
                      {x.descripcion && <div className="font-normal text-gray-500">{x.descripcion}</div>}
                    </th>
                    <td className="px-3 py-1.5 tabular-nums">{x.patente}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{x.capacidad_kg == null ? "—" : num(x.capacidad_kg)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{x.capacidad_m3 == null ? "—" : num(x.capacidad_m3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{x.largo_carga_m == null ? "—" : num(x.largo_carga_m)}</td>
                    <td className="px-3 py-1.5">{x.activo ? "Disponible" : "No disponible"}</td>
                    <td className="px-2 py-1.5 text-right">
                      {puedeEditar && <button className={BTN} onClick={() => setVeh({ id: x.id, d: { ...x } })}>editar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="t-tar" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-tar" className="text-sm font-semibold text-verde">Tarifas</h2>
          {puedeEditar && !tar && (
            <button className={BTN} onClick={() => setTar({ id: null, d: tarifaVacia(moneda) })}>+ Agregar tarifa</button>
          )}
        </div>
        <p className="text-xs text-gray-600 max-w-3xl">
          Una tarifa puede ser de un vehiculo en particular o general del transportista. Al elegirlo en un pedido, se
          ofrece primero la del vehiculo y, si no hay, la general. Sin origen o destino, vale para cualquier ruta.
        </p>
        {tar && (
          <div key={tar.id ?? "nueva"} className="border border-dorado bg-crema rounded p-4 space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Aplica a</span>
                <select className={input} value={tar.d.id_vehiculo ?? ""} onChange={(e) => setTar({ ...tar, d: { ...tar.d, id_vehiculo: e.target.value ? Number(e.target.value) : null } })}>
                  <option value="">Tarifa general (todos sus vehiculos)</option>
                  {vehiculos.map((x) => <option key={x.id} value={x.id}>{x.tipo} {x.patente}</option>)}
                </select>
              </label>
              <Campo label="Origen" value={tar.d.origen} placeholder="Ej: Bodega Centro Panel" onChange={(v) => setTar({ ...tar, d: { ...tar.d, origen: v } })} />
              <Campo label="Destino" value={tar.d.destino} placeholder="Ej: Region Metropolitana" onChange={(v) => setTar({ ...tar, d: { ...tar.d, destino: v } })} />
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Como se cobra</span>
                <select className={input} value={tar.d.tipo_cobro} onChange={(e) => setTar({ ...tar, d: { ...tar.d, tipo_cobro: e.target.value } })}>
                  {TIPOS_COBRO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <Numero label={`Monto (${tar.d.moneda}) *`} value={tar.d.monto} onChange={(n) => setTar({ ...tar, d: { ...tar.d, monto: n ?? 0 } })} />
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Vigente desde</span>
                <input type="date" className={input} value={tar.d.vigente_desde} onChange={(e) => setTar({ ...tar, d: { ...tar.d, vigente_desde: e.target.value } })} />
              </label>
              <label className="text-sm">
                <span className="block text-dorado-osc font-semibold mb-1">Vigente hasta</span>
                <input type="date" className={input} value={tar.d.vigente_hasta} onChange={(e) => setTar({ ...tar, d: { ...tar.d, vigente_hasta: e.target.value } })} />
              </label>
              <label className="text-sm flex items-end gap-2 pb-1">
                <input type="checkbox" checked={tar.d.activa} onChange={(e) => setTar({ ...tar, d: { ...tar.d, activa: e.target.checked } })} />
                <span>Activa</span>
              </label>
              <div className="lg:col-span-4">
                <Campo label="Notas" value={tar.d.notas} onChange={(v) => setTar({ ...tar, d: { ...tar.d, notas: v } })} placeholder="Ej: incluye descarga, no incluye peajes" />
              </div>
            </div>
            <div className="flex gap-2">
              <button className={BTN} disabled={pendiente} onClick={() => correr(() => guardarTarifa(id, tar.id, tar.d), "Tarifa guardada.", () => setTar(null))}>
                {pendiente ? "Grabando..." : "Grabar tarifa"}
              </button>
              <button className={BTN} onClick={() => setTar(null)}>Cancelar</button>
            </div>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2">Aplica a</th>
                  <th scope="col" className="text-left px-3 py-2">Ruta</th>
                  <th scope="col" className="text-left px-3 py-2">Se cobra</th>
                  <th scope="col" className="text-right px-3 py-2">Monto</th>
                  <th scope="col" className="text-left px-3 py-2">Vigencia</th>
                  <th scope="col" className="text-left px-3 py-2">Estado</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {tarifas.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Sin tarifas registradas.</td></tr>
                )}
                {tarifas.map((t) => (
                  <tr key={t.id} className={`border-t border-gray-100 hover:bg-crema ${t.activa ? "" : "text-gray-500"}`}>
                    <th scope="row" className="text-left px-3 py-1.5 font-semibold">{nombreVeh(t.id_vehiculo)}</th>
                    <td className="px-3 py-1.5">
                      {t.origen || t.destino ? `${t.origen || "Cualquier origen"} → ${t.destino || "cualquier destino"}` : "Cualquier ruta"}
                      {t.notas && <div className="text-gray-500">{t.notas}</div>}
                    </td>
                    <td className="px-3 py-1.5">{t.tipo_cobro}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{t.moneda} {num(t.monto)}</td>
                    <td className="px-3 py-1.5">{t.vigente_desde || t.vigente_hasta ? `${t.vigente_desde || "…"} a ${t.vigente_hasta || "…"}` : "Sin fecha"}</td>
                    <td className="px-3 py-1.5">{t.activa ? "Activa" : "Inactiva"}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {puedeEditar && (
                        <>
                          <button className={`${BTN} mr-1`} onClick={() => setTar({ id: t.id, d: { ...t } })}>editar</button>
                          <button
                            className={BTN_CLARO}
                            disabled={pendiente}
                            onClick={() => window.confirm("Eliminar esta tarifa?") && correr(() => eliminarTarifa(id, t.id), "Tarifa eliminada.")}
                          >
                            quitar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="t-uso" className="space-y-2">
        <h2 id="t-uso" className="text-sm font-semibold text-verde">Donde se ha usado</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <ListaUso titulo="Pedidos" vacio="Ningun pedido lo tiene asignado." filas={usoPedidos.map((p) => ({ clave: p.id, href: `/pedidos/${p.id}`, texto: p.num, detalle: `${p.fecha} · ${p.estado}${p.flete != null ? ` · flete ${num(p.flete)}` : ""}` }))} />
          <ListaUso titulo="Ordenes de compra (retiros)" vacio="Ninguna orden de compra lo tiene asignado." filas={usoOC.map((o) => ({ clave: o.id, href: `/compras/${o.id}`, texto: o.num, detalle: `${o.fecha} · ${o.estado}` }))} />
        </div>
      </section>
    </div>
  );
}

function ListaUso({ titulo, vacio, filas }: { titulo: string; vacio: string; filas: { clave: number; href: string; texto: string; detalle: string }[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <div className="text-xs font-semibold text-dorado-osc mb-1">{titulo}</div>
      {filas.length === 0 ? (
        <p className="text-xs text-gray-500">{vacio}</p>
      ) : (
        <ul className="text-xs space-y-1">
          {filas.map((f) => (
            <li key={f.clave}>
              <Link href={f.href} className="text-verde underline font-semibold">{f.texto}</Link> <span className="text-gray-500">{f.detalle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Dato({ t, v, ancho }: { t: string; v: string; ancho?: string }) {
  return (
    <div className={ancho}>
      <dt className="text-xs text-dorado-osc font-semibold">{t}</dt>
      <dd className="text-gray-800">{v || <span className="text-gray-500">—</span>}</dd>
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

function Numero({ label, value, onChange, ayuda }: { label: string; value: number | null; onChange: (n: number | null) => void; ayuda?: string }) {
  return (
    <label className="text-sm">
      <span className="block text-dorado-osc font-semibold mb-1">{label}</span>
      <input
        inputMode="decimal"
        className={input}
        defaultValue={value == null ? "" : String(value).replace(".", ",")}
        onChange={(e) => {
          const t = e.target.value.trim();
          onChange(t === "" ? null : Number(t.replace(/\./g, "").replace(",", ".")));
        }}
      />
      {ayuda && <span className="block text-[11px] text-gray-500 mt-0.5">{ayuda}</span>}
    </label>
  );
}
