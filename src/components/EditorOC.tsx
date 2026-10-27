"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  anularOC,
  aprobarOC,
  borrarLineaOC,
  borrarOC,
  enviarAprobacion,
  facturarOC,
  actualizarCabeceraOC,
  guardarCabeceraOC,
  guardarLineaOC,
  marcarEnviadaOC,
  rechazarOC,
  recibirOC,
  solicitarPagoOC,
} from "@/app/compras/acciones";
import { dinero, fecha as fmtFecha, unidades as fmtUnid } from "@/lib/formato";

export interface OcDatos {
  id: number;
  num_oc: string;
  estado: string;
  fecha_entrega: string | null;
  direccion_entrega: string | null;
  condiciones_pago: string | null;
  notas: string | null;
  total: number;
  id_partida: number | null;
  motivo_rechazo: string | null;
  factura_numero: string | null;
  factura_fecha: string | null;
  factura_monto: number | null;
  moneda: string;
}
export interface Linea {
  id: number;
  descripcion: string;
  unidades: number;
  costo_unitario: number;
  recibido: number;
}

const input = "border border-gray-300 rounded px-2 py-1 text-xs w-full";
const boton = "bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40";
const botonGris = "bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1 rounded disabled:opacity-40";
const num = (t: string) => Number(t.replace(/\./g, "").replace(",", ".")) || 0;

export default function EditorOC({
  oc,
  lineas,
  partidas,
  recepciones,
  pagos,
  cuentas,
  categorias,
  puedeAprobar,
  puedeCrear,
  esAdmin,
}: {
  oc: OcDatos;
  lineas: Linea[];
  partidas: { id: number; nombre: string }[];
  recepciones: { id: number; fecha: string; cantidad: number; guia: string | null; descripcion: string }[];
  pagos: { id_mov: number; monto: number; fecha: string | null; estado_pago: string; documento: string | null }[];
  cuentas: { id: number; alias: string }[];
  categorias: { id: number; nombre: string }[];
  puedeAprobar: boolean;
  puedeCrear: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const m = oc.moneda;
  const borrador = oc.estado === "Borrador";
  // Emitida --pendiente, aprobada o enviada--: la entrega, la direccion y las notas aun se pueden corregir.
  const emitida = ["Pendiente aprobacion", "Aprobada", "Enviada"].includes(oc.estado);
  const editaCab = borrador || emitida;
  const [editando, setEditando] = useState(false);

  const [cab, setCab] = useState({
    id_partida: oc.id_partida ? String(oc.id_partida) : "",
    fecha_entrega: oc.fecha_entrega ?? "",
    direccion_entrega: oc.direccion_entrega ?? "",
    condiciones_pago: oc.condiciones_pago ?? "",
    notas: oc.notas ?? "",
  });
  const [nl, setNl] = useState({ id: 0, descripcion: "", unidades: "1", costo: "" });
  const [rec, setRec] = useState<Record<number, string>>({});
  const [guia, setGuia] = useState("");
  const [fac, setFac] = useState({ numero: "", fecha: "", monto: String(oc.total) });
  const solicitado = pagos.reduce((a, p) => a + p.monto, 0);
  const [pago, setPago] = useState({
    monto: String(Math.max(0, (oc.factura_monto ?? oc.total) - solicitado)),
    cuenta: "",
    categoria: "",
    documento: "",
  });

  function ejecutar(f: () => Promise<{ error?: string } | undefined>, despues?: () => void) {
    setError(null);
    empezar(async () => {
      const r = await f();
      if (r?.error) setError(r.error);
      else {
        despues?.();
        router.refresh();
      }
    });
  }

  const recibible = ["Aprobada", "Enviada", "Recibida parcial"].includes(oc.estado);
  const facturable = ["Recibida", "Recibida parcial"].includes(oc.estado);
  const pagable = ["Aprobada", "Enviada", "Recibida parcial", "Recibida", "Facturada"].includes(oc.estado);
  const anulable = ["Borrador", "Pendiente aprobacion", "Rechazada", "Aprobada", "Enviada"].includes(oc.estado);

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
      {oc.estado === "Rechazada" && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
          Rechazada: {oc.motivo_rechazo}. Anule esta orden y cree una nueva con los cambios.
        </div>
      )}
      {oc.estado === "Pendiente aprobacion" && !puedeAprobar && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3">
          Esperando la aprobacion de quien corresponde. No puede salir ni pagarse hasta entonces.
        </div>
      )}

      {/* acciones del flujo */}
      <div className="flex flex-wrap gap-2">
        {borrador && puedeCrear && (
          <button className={boton} disabled={pendiente} onClick={() => ejecutar(() => enviarAprobacion(oc.id))}>
            Enviar a aprobacion
          </button>
        )}
        {oc.estado === "Pendiente aprobacion" && puedeAprobar && (
          <>
            <button className={boton} disabled={pendiente} onClick={() => ejecutar(() => aprobarOC(oc.id))}>
              Aprobar
            </button>
            <button
              className={botonGris}
              disabled={pendiente}
              onClick={() => {
                const motivo = prompt("Motivo del rechazo:");
                if (motivo) ejecutar(() => rechazarOC(oc.id, motivo));
              }}
            >
              Rechazar
            </button>
          </>
        )}
        {oc.estado === "Aprobada" && puedeCrear && (
          <button className={boton} disabled={pendiente} onClick={() => ejecutar(() => marcarEnviadaOC(oc.id))}>
            Marcar como enviada al proveedor
          </button>
        )}
        {editaCab && puedeCrear && (
          <button className={botonGris} disabled={pendiente} onClick={() => setEditando(!editando)}>
            {editando ? "Cerrar edicion" : "Editar cabecera"}
          </button>
        )}
        {anulable && puedeCrear && (
          <button
            className={botonGris}
            disabled={pendiente}
            onClick={() => confirm("Anular la orden?") && ejecutar(() => anularOC(oc.id))}
          >
            Anular
          </button>
        )}
        {borrador && (esAdmin || puedeCrear) && (
          <button
            className="text-red-700 text-xs underline px-2"
            disabled={pendiente}
            onClick={() =>
              confirm("Eliminar el borrador?") && ejecutar(() => borrarOC(oc.id), () => router.push("/compras"))
            }
          >
            Eliminar borrador
          </button>
        )}
        <a href={`/compras/${oc.id}/pdf`} className={`${botonGris} inline-block`}>
          Ver / imprimir
        </a>
      </div>

      {/* datos */}
      <div className="bg-white border border-gray-200 rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="text-xs">
          <span className="block font-semibold mb-1">Partida</span>
          <select className={input} disabled={!(editando && borrador)} value={cab.id_partida} onChange={(e) => setCab({ ...cab, id_partida: e.target.value })}>
            <option value="">-- sin partida --</option>
            {partidas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block font-semibold mb-1">Fecha de entrega en destino</span>
          <input type="date" className={input} disabled={!(editando && editaCab)} value={cab.fecha_entrega} onChange={(e) => setCab({ ...cab, fecha_entrega: e.target.value })} />
        </label>
        <label className="text-xs md:col-span-2">
          <span className="block font-semibold mb-1">Direccion de destino</span>
          <input className={input} disabled={!(editando && editaCab)} value={cab.direccion_entrega} onChange={(e) => setCab({ ...cab, direccion_entrega: e.target.value })} maxLength={300} placeholder="Si queda vacia, se usa la de la obra" />
        </label>
        <label className="text-xs md:col-span-2">
          <span className="block font-semibold mb-1">Condiciones de pago</span>
          <input className={input} disabled={!(editando && borrador)} value={cab.condiciones_pago} onChange={(e) => setCab({ ...cab, condiciones_pago: e.target.value })} />
        </label>
        <label className="text-xs md:col-span-4">
          <span className="block font-semibold mb-1">Notas para el proveedor</span>
          <textarea className={input} rows={2} disabled={!(editando && editaCab)} value={cab.notas} onChange={(e) => setCab({ ...cab, notas: e.target.value })} />
        </label>
        {editando && emitida && (
          <div className="md:col-span-4 flex flex-wrap items-center gap-3">
            <button className={boton} disabled={pendiente} onClick={() => ejecutar(() => actualizarCabeceraOC(oc.id, { fecha_entrega: cab.fecha_entrega, direccion_entrega: cab.direccion_entrega, notas: cab.notas }), () => setEditando(false))}>
              Grabar entrega, direccion y notas
            </button>
            <span className="text-gray-500 text-xs">
              {oc.estado === "Enviada" ? "La orden ya se envio: si cambia algo, vuelva a enviarla al proveedor." : "Las condiciones de pago y la partida solo cambian en borrador."}
            </span>
          </div>
        )}
        {editando && borrador && (
          <div className="md:col-span-4">
            <button
              className={boton}
              disabled={pendiente}
              onClick={() =>
                ejecutar(() =>
                  guardarCabeceraOC(oc.id, { ...cab, id_partida: cab.id_partida ? Number(cab.id_partida) : null }),
                  () => setEditando(false)
                )
              }
            >
              Grabar datos
            </button>
          </div>
        )}
      </div>

      {/* lineas */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Descripcion</th>
                <th className="text-right px-3 py-2">Unidades</th>
                <th className="text-right px-3 py-2">Costo unit.</th>
                <th className="text-right px-3 py-2">Subtotal</th>
                <th className="text-right px-3 py-2">Recibido</th>
                {recibible && <th className="text-right px-3 py-2">Recibir ahora</th>}
                {borrador && <th className="px-3" />}
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{l.descripcion}</td>
                  <td className="px-3 py-2 text-right">{fmtUnid(l.unidades)}</td>
                  <td className="px-3 py-2 text-right">{dinero(l.costo_unitario, m)}</td>
                  <td className="px-3 py-2 text-right">{dinero(l.unidades * l.costo_unitario, m)}</td>
                  <td className="px-3 py-2 text-right">{fmtUnid(l.recibido)}</td>
                  {recibible && (
                    <td className="px-3 py-2 text-right">
                      {l.recibido < l.unidades ? (
                        <input
                          className={`${input} w-20 text-right`}
                          inputMode="decimal"
                          placeholder={fmtUnid(l.unidades - l.recibido)}
                          value={rec[l.id] ?? ""}
                          onChange={(e) => setRec({ ...rec, [l.id]: e.target.value })}
                        />
                      ) : (
                        "completa"
                      )}
                    </td>
                  )}
                  {borrador && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        className="text-verde hover:underline mr-3"
                        onClick={() =>
                          setNl({ id: l.id, descripcion: l.descripcion, unidades: String(l.unidades), costo: String(l.costo_unitario) })
                        }
                      >
                        Editar
                      </button>
                      <button className="text-red-700 hover:underline" onClick={() => ejecutar(() => borrarLineaOC(oc.id, l.id))}>
                        Borrar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {lineas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                    Sin lineas.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr className="border-t border-gray-200">
                <td colSpan={3} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="px-3 py-2 text-right">{dinero(oc.total, m)}</td>
                <td colSpan={1 + (recibible ? 1 : 0) + (borrador ? 1 : 0)} />
              </tr>
            </tfoot>
          </table>
        </div>
        {borrador && (
          <div className="border-t border-gray-200 p-3 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <label className="text-xs md:col-span-2">
              <span className="block font-semibold mb-1">{nl.id ? "Editar linea" : "Nueva linea"}</span>
              <input className={input} value={nl.descripcion} onChange={(e) => setNl({ ...nl, descripcion: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className="block font-semibold mb-1">Unidades</span>
              <input className={input} inputMode="decimal" value={nl.unidades} onChange={(e) => setNl({ ...nl, unidades: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className="block font-semibold mb-1">Costo unitario</span>
              <input className={input} inputMode="decimal" value={nl.costo} onChange={(e) => setNl({ ...nl, costo: e.target.value })} />
            </label>
            <button
              className={boton}
              disabled={pendiente}
              onClick={() =>
                ejecutar(
                  () => guardarLineaOC(oc.id, nl.id || null, { descripcion: nl.descripcion, unidades: num(nl.unidades), costo_unitario: num(nl.costo) }),
                  () => setNl({ id: 0, descripcion: "", unidades: "1", costo: "" })
                )
              }
            >
              {nl.id ? "Actualizar linea" : "Agregar linea"}
            </button>
          </div>
        )}
      </div>

      {recibible && puedeCrear && (
        <div className="bg-white border border-gray-200 rounded p-3 flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block font-semibold mb-1">Guia de despacho</span>
            <input className={input} value={guia} onChange={(e) => setGuia(e.target.value)} />
          </label>
          <button
            className={boton}
            disabled={pendiente}
            onClick={() => {
              const l = Object.entries(rec)
                .map(([id, c]) => ({ id_detalle: Number(id), cantidad: num(c) }))
                .filter((x) => x.cantidad > 0);
              if (l.length === 0) return setError("Anote las cantidades recibidas.");
              ejecutar(() => recibirOC(oc.id, l, guia), () => { setRec({}); setGuia(""); });
            }}
          >
            Registrar recepcion
          </button>
        </div>
      )}

      {recepciones.length > 0 && (
        <div className="bg-white border border-gray-200 rounded p-3 text-xs">
          <div className="font-semibold mb-1">Recepciones</div>
          {recepciones.map((r) => (
            <div key={r.id}>
              {fmtFecha(r.fecha)} · {fmtUnid(r.cantidad)} de {r.descripcion}
              {r.guia ? ` · guia ${r.guia}` : ""}
            </div>
          ))}
        </div>
      )}

      {facturable && puedeCrear && (
        <div className="bg-white border border-gray-200 rounded p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <label className="text-xs">
            <span className="block font-semibold mb-1">Factura del proveedor *</span>
            <input className={input} value={fac.numero} onChange={(e) => setFac({ ...fac, numero: e.target.value })} />
          </label>
          <label className="text-xs">
            <span className="block font-semibold mb-1">Fecha</span>
            <input type="date" className={input} value={fac.fecha} onChange={(e) => setFac({ ...fac, fecha: e.target.value })} />
          </label>
          <label className="text-xs">
            <span className="block font-semibold mb-1">Monto</span>
            <input className={input} inputMode="decimal" value={fac.monto} onChange={(e) => setFac({ ...fac, monto: e.target.value })} />
          </label>
          <button className={boton} disabled={pendiente} onClick={() => ejecutar(() => facturarOC(oc.id, fac.numero, fac.fecha, num(fac.monto)))}>
            Registrar factura
          </button>
        </div>
      )}
      {oc.factura_numero && (
        <div className="text-xs text-gray-700">
          Factura {oc.factura_numero}
          {oc.factura_fecha ? ` del ${fmtFecha(oc.factura_fecha)}` : ""} por {dinero(oc.factura_monto ?? 0, m)}.
        </div>
      )}

      {pagable && (
        <div className="bg-white border border-gray-200 rounded p-3 space-y-2">
          <div className="text-xs font-semibold">Pagos</div>
          {pagos.map((p) => (
            <div key={p.id_mov} className="text-xs">
              {dinero(p.monto, m)} · {p.fecha ? `pagado el ${fmtFecha(p.fecha)}` : "solicitado, pendiente de pago"}
              {p.documento ? ` · ${p.documento}` : ""}
            </div>
          ))}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <label className="text-xs">
              <span className="block font-semibold mb-1">Monto</span>
              <input className={input} inputMode="decimal" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className="block font-semibold mb-1">Cuenta</span>
              <select className={input} value={pago.cuenta} onChange={(e) => setPago({ ...pago, cuenta: e.target.value })}>
                <option value="">--</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.alias}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="block font-semibold mb-1">Categoria</span>
              <select className={input} value={pago.categoria} onChange={(e) => setPago({ ...pago, categoria: e.target.value })}>
                <option value="">--</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="block font-semibold mb-1">Documento</span>
              <input className={input} value={pago.documento} onChange={(e) => setPago({ ...pago, documento: e.target.value })} />
            </label>
            <button
              className={boton}
              disabled={pendiente}
              onClick={() =>
                ejecutar(() =>
                  solicitarPagoOC(oc.id, {
                    monto: num(pago.monto),
                    id_cuenta: Number(pago.cuenta),
                    id_categoria: Number(pago.categoria),
                    documento: pago.documento,
                  })
                )
              }
            >
              Solicitar pago
            </button>
          </div>
          <div className="text-[11px] text-gray-500">
            La solicitud queda pendiente en Egresos; sale cuando quien tiene permiso de pago la paga.
          </div>
        </div>
      )}
    </div>
  );
}
