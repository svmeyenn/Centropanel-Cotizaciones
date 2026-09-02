"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pesos, unidades as fmtUnid, telefono as fmtTelefono } from "@/lib/formato";
import BotonDuplicar from "@/components/BotonDuplicar";
import CuentaCorrientePedido, {
  type Cuenta,
  type PagoVista,
} from "@/components/CuentaCorrientePedido";
import FacturaPedido, {
  type FacturaVista,
} from "@/components/FacturaPedido";
import {
  actualizarPedido,
  actualizarLineasPedido,
  quitarLineaPedido,
  generarSolicitudes,
  cambiarEstadoSolicitud,
  eliminarSolicitud,
  type DatosPedido,
} from "@/app/pedidos/acciones";

export interface LineaVista {
  id: number;
  sku?: string | null;
  descripcion: string;
  unidades: number;
  valor_unitario: number;
}

export interface NecesidadVista {
  descripcion: string;
  unidades: number;
}

export interface SolicitudVista {
  id: number;
  num: string;
  proveedor: string;
  estado: string;
  lineas: number;
}

const ESTADOS = [
  "Emitido",
  "En preparacion",
  "Despachado",
  "Facturado",
  "Anulado",
];

export default function EditorPedido({
  id,
  num,
  cotizacion,
  cliente,
  clienteRut,
  clienteContacto,
  clienteTelefono,
  clienteCiudad,
  vendedor,
  inicial,
  lineas,
  necesidades,
  solicitudes,
  cuenta,
  pagos,
  factura,
  formaPago,
  medioPago,
  puedeEditar,
  puedeCrear,
  esAdmin,
}: {
  id: number;
  num: string;
  cotizacion: { id: number; num: string } | null;
  cliente: string;
  // Los mismos datos que muestra la cotizacion: quien firma, con quien se
  // habla y adonde llega la factura. Antes el pedido solo traia el nombre y
  // habia que volver a la cotizacion o a la ficha para lo demas.
  clienteRut: string | null;
  clienteContacto: string | null;
  clienteTelefono: string | null;
  clienteCiudad: string | null;
  vendedor: string;
  inicial: DatosPedido;
  lineas: LineaVista[];
  necesidades: NecesidadVista[];
  solicitudes: SolicitudVista[];
  cuenta: Cuenta;
  pagos: PagoVista[];
  factura: FacturaVista | null;
  formaPago: string | null;
  medioPago: string | null;
  puedeEditar: boolean;
  puedeCrear: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [editable, setEditable] = useState(false);
  const [d, setD] = useState<DatosPedido>(inicial);
  const [ls, setLs] = useState<LineaVista[]>(lineas);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinProveedor, setSinProveedor] = useState<string[]>([]);
  const [pendiente, empezar] = useTransition();

  const soloLectura = !editable || !puedeEditar;
  const total = ls.reduce((s, l) => s + l.unidades * l.valor_unitario, 0);
  const input =
    "border border-gray-300 rounded px-2 py-1 text-sm w-full disabled:bg-gray-100 disabled:text-gray-500";

  function grabar() {
    setError(null);
    empezar(async () => {
      const r1 = await actualizarPedido(id, d);
      if (r1?.error) {
        setError(r1.error);
        return;
      }
      const r2 = await actualizarLineasPedido(
        id,
        ls.map((l) => ({
          id: l.id,
          unidades: l.unidades,
          valor_unitario: l.valor_unitario,
        }))
      );
      if (r2?.error) {
        setError(r2.error);
        return;
      }
      setEditable(false);
      router.refresh();
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-gray-200 rounded p-3">
        <div className="text-sm">
          <span className="text-gray-500">N de pedido:</span>{" "}
          <span className="font-bold text-verde">{num}</span>
          <span className="ml-3 text-gray-500">
            Estado: <span className="font-semibold">{d.estado}</span>
          </span>
          {cotizacion && (
            <span className="ml-3 text-gray-500">
              Origen:{" "}
              <Link
                href={`/cotizaciones/${cotizacion.id}`}
                className="underline text-verde"
              >
                {cotizacion.num}
              </Link>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {soloLectura && puedeEditar && (
            <button
              onClick={() => setEditable(true)}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Modificar
            </button>
          )}
          {!soloLectura && (
            <button
              onClick={grabar}
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Grabando..." : "GRABAR"}
            </button>
          )}
          {puedeEditar && <BotonDuplicar tipo="pedido" id={id} />}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* cabecera */}
      <div className="bg-white border border-gray-200 rounded p-3 grid md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
        <div className="md:col-span-2">
          <Dato titulo="Cliente" valor={cliente} />
          <span className="block mt-1 text-[11px] leading-tight text-gray-600">
            {clienteRut ? (
              <span>RUT {clienteRut}</span>
            ) : (
              <span className="text-gray-400">sin RUT</span>
            )}
            {clienteContacto ? <span> {"·"} {clienteContacto}</span> : null}
            {clienteTelefono ? <span> {"·"} {fmtTelefono(clienteTelefono)}</span> : null}
            {clienteCiudad ? <span> {"·"} {clienteCiudad}</span> : null}
          </span>
        </div>
        <Dato titulo="Ejecutivo" valor={vendedor} />
        <Dato titulo="Forma de pago" valor={formaPago ?? "--"} />
        <Dato titulo="Medio de pago" valor={medioPago ?? "--"} />
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Estado</span>
          <select
            className={input}
            disabled={soloLectura}
            value={d.estado}
            onChange={(e) => setD({ ...d, estado: e.target.value })}
          >
            {ESTADOS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">Fecha</span>
          <input
            type="date"
            className={input}
            disabled={soloLectura}
            value={d.fecha}
            onChange={(e) => setD({ ...d, fecha: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">
            Tiempo de entrega
          </span>
          <input
            className={input}
            disabled={soloLectura}
            value={d.tiempo_entrega}
            onChange={(e) => setD({ ...d, tiempo_entrega: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">
            Despachar a
          </span>
          <input
            className={input}
            disabled={soloLectura}
            value={d.direccion_despacho}
            onChange={(e) => setD({ ...d, direccion_despacho: e.target.value })}
          />
        </label>
      </div>

      {/* lineas */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
          ITEMS DEL PEDIDO
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 w-10">N</th>
                <th className="text-left px-3 py-2 w-24">SKU</th>
                <th className="text-left px-3 py-2">Descripcion</th>
                <th className="text-right px-3 py-2 w-24">Unid.</th>
                <th className="text-right px-3 py-2 w-32">V. unitario</th>
                <th className="text-right px-3 py-2 w-32">Subtotal</th>
                {!soloLectura && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {ls.map((l, i) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 text-gray-500 font-mono text-[11px]">
                    {l.sku ?? ""}
                  </td>
                  <td className="px-3 py-2">{l.descripcion}</td>
                  <td className="px-3 py-2 text-right">
                    {soloLectura ? (
                      fmtUnid(l.unidades)
                    ) : (
                      <input
                        type="number"
                        className="border border-gray-300 rounded px-2 py-1 text-right w-20"
                        value={l.unidades}
                        onChange={(e) =>
                          setLs((x) =>
                            x.map((y) =>
                              y.id === l.id
                                ? { ...y, unidades: Number(e.target.value) || 0 }
                                : y
                            )
                          )
                        }
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {soloLectura ? (
                      pesos(l.valor_unitario)
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        className="border border-gray-300 rounded px-2 py-1 text-right w-28"
                        value={pesos(l.valor_unitario)}
                        onChange={(e) =>
                          setLs((x) =>
                            x.map((y) =>
                              y.id === l.id
                                ? {
                                    ...y,
                                    valor_unitario:
                                      Number(e.target.value.replace(/\D/g, "")) || 0,
                                  }
                                : y
                            )
                          )
                        }
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {pesos(l.unidades * l.valor_unitario)}
                  </td>
                  {!soloLectura && (
                    <td className="px-2 text-right">
                      <button
                        onClick={() =>
                          empezar(async () => {
                            const r = await quitarLineaPedido(l.id, id);
                            if (r?.error) setError(r.error);
                            else setLs((x) => x.filter((y) => y.id !== l.id));
                          })
                        }
                        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                      >
                        quitar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="px-3 py-2" colSpan={4}>
                  TOTAL NETO
                </td>
                <td className="px-3 py-2 text-right">{pesos(total)}</td>
                {!soloLectura && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CuentaCorrientePedido
        idPedido={id}
        formaPago={formaPago}
        medioPago={medioPago}
        cuenta={cuenta}
        pagos={pagos}
        puedeCrear={puedeCrear}
        esAdmin={esAdmin}
      />

      {/* abastecimiento */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
          QUE HAY QUE COMPRAR
        </div>
        <div className="p-3 space-y-3">
          <p className="text-xs text-gray-600">
            Los paneles se explotan en sus insumos --EPS, caras y la parte del
            balde de adhesivo que les toca--; lo que no es panel se pide tal
            cual. Los servicios no se le compran a nadie.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Insumo</th>
                  <th className="text-right px-3 py-2 w-24">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {necesidades.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center text-gray-400 py-6">
                      Este pedido no requiere compras.
                    </td>
                  </tr>
                )}
                {necesidades.map((n) => (
                  <tr key={n.descripcion} className="border-t border-gray-100">
                    <td className="px-3 py-2">{n.descripcion}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {fmtUnid(n.unidades)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {puedeCrear && necesidades.length > 0 && (
            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={() =>
                  empezar(async () => {
                    setError(null);
                    setAviso(null);
                    const r = await generarSolicitudes(id);
                    if (r?.error) {
                      setError(r.error);
                      return;
                    }
                    setSinProveedor(r.sinProveedor ?? []);
                    setAviso(
                      `${r.solicitudes} solicitud(es) generada(s).` +
                        (r.existentes
                          ? ` ${r.existentes} proveedor(es) ya tenian una y se dejaron como estaban.`
                          : "") +
                        (r.sinProveedor?.length
                          ? ` ${r.sinProveedor.length} insumo(s) sin proveedor.`
                          : "")
                    );
                    router.refresh();
                  })
                }
                disabled={pendiente || !cuenta.pie_cubierto}
                className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                title={
                  cuenta.pie_cubierto
                    ? undefined
                    : "Falta el pie del cliente"
                }
              >
                {pendiente ? "Generando..." : "Generar solicitudes a proveedores"}
              </button>
              <span className="text-xs text-gray-500">
                {cuenta.pie_cubierto
                  ? "Un documento por proveedor. Las ya emitidas no se tocan: para rehacer una hay que eliminarla."
                  : "Primero hay que registrar el pie en la cuenta corriente."}
              </span>
            </div>
          )}

          {aviso && (
            <div className="bg-green-50 border border-green-200 text-green-900 text-xs rounded p-3">
              {aviso}
            </div>
          )}

          {sinProveedor.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded p-3">
              <strong>Sin proveedor en ninguna maestra:</strong>{" "}
              {sinProveedor.join(", ")}. Cargue el insumo en la maestra de algun
              proveedor y vuelva a generar.
            </div>
          )}
        </div>
      </div>

      {/* solicitudes */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
          SOLICITUDES DE COTIZACION
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">N</th>
              <th className="text-left px-3 py-2">Proveedor</th>
              <th className="text-right px-3 py-2">Items</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {solicitudes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-6">
                  Todavia no se han generado solicitudes.
                </td>
              </tr>
            )}
            {solicitudes.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-crema">
                <td className="px-3 py-2 font-semibold text-verde">{s.num}</td>
                <td className="px-3 py-2">{s.proveedor}</td>
                <td className="px-3 py-2 text-right">{s.lineas}</td>
                <td className="px-3 py-2">
                  {s.estado === "Adjudicada" ? (
                    <span className="bg-verde text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                      ADJUDICADA
                    </span>
                  ) : (
                    s.estado
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Link
                    href={`/solicitudes/${s.id}`}
                    target="_blank"
                    className="text-verde underline mr-2"
                  >
                    ver
                  </Link>
                  {puedeEditar && (
                    <>
                      <button
                        onClick={() =>
                          empezar(async () => {
                            const r = await cambiarEstadoSolicitud(
                              s.id,
                              id,
                              s.estado === "Adjudicada" ? "Respondida" : "Adjudicada"
                            );
                            if (r?.error) setError(r.error);
                            else router.refresh();
                          })
                        }
                        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-2"
                        title="La adjudicada es a la que se le compra"
                      >
                        {s.estado === "Adjudicada" ? "quitar adjudicacion" : "adjudicar"}
                      </button>
                      <button
                        onClick={() =>
                          empezar(async () => {
                            const r = await eliminarSolicitud(s.id, id);
                            if (r?.error) setError(r.error);
                            else router.refresh();
                          })
                        }
                        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                        title="Eliminarla permite volver a pedirle a este proveedor"
                      >
                        eliminar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FacturaPedido
        idPedido={id}
        factura={factura}
        total={cuenta.total}
        saldo={cuenta.saldo}
        puedeCrear={puedeCrear}
        esAdmin={esAdmin}
      />

      {/* notas */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <label className="text-sm block">
          <span className="block text-dorado-osc font-semibold mb-1">
            Notas del pedido
          </span>
          <textarea
            className={`${input} h-20`}
            disabled={soloLectura}
            value={d.notas}
            onChange={(e) => setD({ ...d, notas: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="font-semibold text-gray-800">{valor}</div>
    </div>
  );
}
