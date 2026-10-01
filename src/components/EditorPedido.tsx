"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  pesos,
  porcentaje,
  unidades as fmtUnid,
  telefono as fmtTelefono,
  hoyISO,
} from "@/lib/formato";
import BotonDuplicar from "@/components/BotonDuplicar";
import GrupoCabecera from "@/components/GrupoCabecera";
import BorrarPedido from "@/components/BorrarPedido";
import Bitacora from "@/components/Bitacora";
import {
  ROTULO_DESCUENTO_1,
  ROTULO_DESCUENTO_2,
  ROTULO_DESCUENTO_3,
} from "@/lib/descuentos";
import { ESTADOS_PEDIDO as ESTADOS } from "@/lib/estados";
import VentanaCliente, { type FichaCliente } from "@/components/VentanaCliente";
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


export default function EditorPedido({
  id,
  num,
  cotizacion,
  cliente,
  clienteRut,
  etiquetaId = "RUT",
  impuesto = "IVA",
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
  facturas,
  formaPago,
  medioPago,
  puedeEditar,
  puedeCrear,
  esAdmin,
  costoPorLinea,
  verMargen,
  lineasSinCosto = 0,
  fichaCliente = null,
  prefijoTelefono = "+56",
}: {
  id: number;
  num: string;
  cotizacion: { id: number; num: string } | null;
  cliente: string;
  // RUT en Chile, RUC en Peru.
  etiquetaId?: string;
  // IVA en Chile, IGV en Peru.
  impuesto?: string;
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
  facturas: FacturaVista[];
  formaPago: string | null;
  medioPago: string | null;
  puedeEditar: boolean;
  puedeCrear: boolean;
  esAdmin: boolean;
  // Costo unitario de cada linea, tomado de la cotizacion de origen: el
  // pedido no lo guarda. Solo llega a quien puede ver costos.
  costoPorLinea?: Record<number, number>;
  verMargen?: boolean;
  // Lineas sin costo conocido: el margen las cuenta como costo cero.
  lineasSinCosto?: number;
  // Ficha completa del cliente, para editarla desde el pedido.
  fichaCliente?: FichaCliente | null;
  prefijoTelefono?: string;
}) {
  const router = useRouter();
  const [editable, setEditable] = useState(false);
  const [d, setD] = useState<DatosPedido>(inicial);
  const [ls, setLs] = useState<LineaVista[]>(lineas);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinProveedor, setSinProveedor] = useState<string[]>([]);
  const [pendiente, empezar] = useTransition();
  const [verFicha, setVerFicha] = useState(false);

  const soloLectura = !editable || !puedeEditar;
  const subtotal = ls.reduce((s, l) => s + l.unidades * l.valor_unitario, 0);
  // Los descuentos vienen de la cotizacion y quedan grabados en el pedido:
  // aqui no se editan, pero el neto y el margen tienen que considerarlos. La
  // cuenta ya los trae recortados a su base (productos el primero, flete y
  // mano de obra el segundo).
  const descuento = Number(cuenta.descuento_monto ?? 0);
  const descuento2 = Number(cuenta.descuento2_monto ?? 0);
  const descuento3 = Number(cuenta.descuento3_monto ?? 0);
  const descuentos = [
    { rotulo: ROTULO_DESCUENTO_1, monto: descuento },
    { rotulo: ROTULO_DESCUENTO_2, monto: descuento2 },
    { rotulo: ROTULO_DESCUENTO_3, monto: descuento3 },
  ].filter((x) => x.monto > 0);
  const totalNeto = subtotal - descuento - descuento2 - descuento3;
  // El pedido tiene que mostrar los mismos escalones que la cotizacion y la
  // factura: neto, impuesto y bruto. La tasa sale de la cuenta del pedido
  // --es la que se le aplico a esta venta-- y no de los parametros de hoy.
  const tasaIva =
    Number(cuenta.total_neto) > 0
      ? Number(cuenta.iva) / Number(cuenta.total_neto)
      : 0;
  const iva = Math.round(totalNeto * tasaIva);
  const totalBruto = totalNeto + iva;
  // El recargo del medio de pago no se descuenta del precio: se suma sobre el
  // total, para que a Centro Panel le llegue integro lo vendido.
  const comisionPct = Number(cuenta.comision_pct ?? 0);
  const totalAPagar =
    comisionPct > 0 && comisionPct < 100
      ? Math.round(totalBruto / (1 - comisionPct / 100))
      : totalBruto;
  // Margen del pedido: el neto menos el costo de lo que se va a entregar. El
  // costo viene de la cotizacion de origen, congelado al vender.
  const costoPedido = ls.reduce(
    (s, l) => s + l.unidades * Number(costoPorLinea?.[l.id] ?? 0),
    0
  );
  // Dias de atraso de la entrega comprometida: positivo si ya se paso. Solo
  // mientras no este entregada; con la fecha real puesta el pedido ya salio.
  const atraso =
    d.fecha_entrega_esperada && !d.fecha_entrega_efectiva
      ? Math.round(
          (new Date(`${hoyISO()}T00:00:00`).getTime() -
            new Date(`${d.fecha_entrega_esperada}T00:00:00`).getTime()) /
            86400000
        )
      : null;
  const margen = totalNeto - costoPedido;
  const margenPct = totalNeto > 0 ? (margen / totalNeto) * 100 : 0;
  // Un solo alto y un solo tamano de letra para todos los campos de la
  // cabecera, editables o no: antes los de solo lectura eran bloques grises
  // con letra grande y los editables cajas chicas, y la fila quedaba despareja.
  const input =
    "border border-gray-300 rounded px-2 py-1 text-xs w-full h-7 disabled:bg-gray-100 disabled:text-gray-500";

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
    <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
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

      {/* Cabecera por temas: con quien es el negocio, que documento es, como
          se paga y como se entrega. Antes eran doce campos sueltos en una
          rejilla y habia que leerlos todos para encontrar uno. */}
      <div className="grid gap-3 lg:grid-cols-4">
        <GrupoCabecera titulo="CLIENTE" className="lg:col-span-2">
          <div className="sm:col-span-2">
            <Dato titulo="Razon social" valor={cliente} />
            <span className="block mt-1 text-[11px] leading-tight text-gray-600">
              {clienteRut ? (
                <span>
                  {etiquetaId} {clienteRut}
                </span>
              ) : (
                <span className="text-gray-400">sin {etiquetaId}</span>
              )}
              {clienteContacto ? <span> {"\u00b7"} {clienteContacto}</span> : null}
              {clienteTelefono ? (
                <span> {"\u00b7"} {fmtTelefono(clienteTelefono)}</span>
              ) : null}
              {clienteCiudad ? <span> {"\u00b7"} {clienteCiudad}</span> : null}
            </span>
            {fichaCliente && puedeEditar && (
              <button
                type="button"
                onClick={() => setVerFicha(true)}
                className="mt-1 text-[11px] text-verde underline"
                title="Completar o corregir los datos del cliente sin salir de aqui"
              >
                Editar datos del cliente
              </button>
            )}
          </div>
        </GrupoCabecera>

        <GrupoCabecera titulo="DOCUMENTO">
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Fecha
            </span>
            <input
              type="date"
              className={input}
              disabled={soloLectura}
              value={d.fecha}
              onChange={(e) => setD({ ...d, fecha: e.target.value })}
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Estado
            </span>
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
          <Dato titulo="Ejecutivo" valor={vendedor} ancho="sm:col-span-2" />
        </GrupoCabecera>

        <GrupoCabecera titulo="PAGO">
          <Dato
            titulo="Forma de pago"
            valor={formaPago ?? "--"}
            ancho="sm:col-span-2"
          />
          <Dato
            titulo="Medio de pago"
            valor={medioPago ?? "--"}
            ancho="sm:col-span-2"
          />
        </GrupoCabecera>

        <GrupoCabecera titulo="ENTREGA" className="lg:col-span-4" columnas="sm:grid-cols-4">
          <label className="text-xs sm:col-span-2">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Despachar a
            </span>
            <input
              className={input}
              disabled={soloLectura}
              value={d.direccion_despacho}
              onChange={(e) =>
                setD({ ...d, direccion_despacho: e.target.value })
              }
            />
          </label>
          <label className="text-xs">
            <span className="block text-dorado-osc font-semibold mb-0.5">
              Plazo comprometido
            </span>
            <input
              className={input}
              disabled={soloLectura}
              placeholder="15 dias habiles"
              value={d.tiempo_entrega}
              onChange={(e) => setD({ ...d, tiempo_entrega: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="block text-dorado-osc font-semibold mb-0.5">
                Fecha comprometida
              </span>
              <input
                type="date"
                className={input}
                disabled={soloLectura}
                value={d.fecha_entrega_esperada}
                onChange={(e) =>
                  setD({ ...d, fecha_entrega_esperada: e.target.value })
                }
              />
            </label>
            <label className="text-xs">
              <span className="block text-dorado-osc font-semibold mb-0.5">
                Entregado el
              </span>
              <input
                type="date"
                className={input}
                disabled={soloLectura}
                value={d.fecha_entrega_efectiva}
                onChange={(e) =>
                  setD({ ...d, fecha_entrega_efectiva: e.target.value })
                }
              />
            </label>
          </div>
          {/* El aviso de atraso sale aqui y no solo en el tablero: quien abre
              el pedido tiene que ver de inmediato que se paso la fecha. */}
          {atraso != null && (
            <p
              className={`sm:col-span-4 text-[11px] ${
                atraso > 0 ? "text-red-700 font-semibold" : "text-gray-600"
              }`}
            >
              {atraso > 0
                ? `Atrasado: la entrega se comprometio hace ${atraso} dia(s).`
                : atraso === 0
                  ? "La entrega es hoy."
                  : `Faltan ${-atraso} dia(s) para la entrega comprometida.`}
            </p>
          )}
        </GrupoCabecera>
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Los totales van fuera de la tabla, en su propia columna a la derecha,
          igual que en la cotizacion. Dentro de la tabla las cifras caian en la
          columna del subtotal de cada linea y los rotulos se estiraban sobre
          cuatro columnas: eso es lo que se veia corrido. */}
      <div className="bg-white border border-gray-200 rounded px-3 py-2">
        <div className="max-w-md ml-auto space-y-0.5 text-xs">
          <Fila label="SUBTOTAL" valor={pesos(subtotal)} />
          {descuentos.map((x) => (
            <Fila key={x.rotulo} label={x.rotulo} valor={pesos(x.monto)} />
          ))}
          <Fila label="TOTAL NETO" valor={pesos(totalNeto)} fuerte />
          <Fila
            label={`${impuesto} ${Math.round(tasaIva * 100)}%`}
            valor={pesos(iva)}
          />
          <div className="flex justify-between bg-verde text-white px-3 py-1 rounded font-bold">
            <span>TOTAL</span>
            <span>{pesos(totalBruto)}</span>
          </div>

          {verMargen && (
            <div className="mt-2 border-t border-gray-200 pt-2 space-y-0.5">
              <Fila label="Costo de lo pedido" valor={pesos(costoPedido)} />
              <div className="flex justify-between px-3 py-1.5 rounded bg-crema text-dorado-osc font-bold">
                <span>
                  MARGEN {porcentaje(margenPct)} %
                  {lineasSinCosto > 0 && (
                    <span className="ml-2 font-normal text-[11px] text-amber-700">
                      ({lineasSinCosto} linea{lineasSinCosto > 1 ? "s" : ""} sin
                      costo cargado)
                    </span>
                  )}
                </span>
                <span>{pesos(margen)}</span>
              </div>
            </div>
          )}

          {comisionPct > 0 && (
            <>
              <Fila
                label={`Recargo ${porcentaje(comisionPct)} %${
                  medioPago ? ` por ${medioPago}` : ""
                }`}
                valor={pesos(totalAPagar - totalBruto)}
              />
              <div className="flex justify-between bg-dorado-osc text-white px-3 py-1 rounded font-bold">
                <span>TOTAL A PAGAR</span>
                <span>{pesos(totalAPagar)}</span>
              </div>
              <p className="text-xs text-gray-500 text-right">
                El total se divide por (1 - comision) para que el neto llegue
                completo.
              </p>
            </>
          )}
        </div>
      </div>

      {verFicha && fichaCliente && (
        <VentanaCliente
          cliente={fichaCliente}
          etiquetaId={etiquetaId}
          prefijo={prefijoTelefono}
          onCerrar={() => setVerFicha(false)}
        />
      )}

      <CuentaCorrientePedido
        idPedido={id}
        impuesto={impuesto}
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
        facturas={facturas}
        total={cuenta.total}
        saldo={cuenta.saldo}
        abonado={cuenta.abonado}
        facturado={cuenta.facturado}
        porFacturar={cuenta.por_facturar}
        pieMonto={cuenta.pie_monto}
        entregaEfectiva={d.fecha_entrega_efectiva || null}
        // La tasa sale de la propia cuenta del pedido: es la que se le aplico
        // a esta venta, no la que este vigente hoy en los parametros.
        tasaIva={cuenta.total_neto > 0 ? cuenta.iva / cuenta.total_neto : 0}
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

      <Bitacora tabla="pedidos" id={id} />

      {/* Ultimo de la ficha, y solo para el administrador: es lo unico que no
          se puede deshacer. */}
      {esAdmin && (
        <BorrarPedido id={id} num={num} solicitudes={solicitudes.length} />
      )}
    </div>
  );
}

// Renglon de los totales: rotulo a la izquierda y cifra a la derecha. El
// mismo que usa la cotizacion, para que los dos documentos se lean igual.
function Fila({
  label,
  valor,
  fuerte,
}: {
  label: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className={`flex justify-between ${fuerte ? "font-bold" : ""}`}>
      <span className="text-gray-700">{label}</span>
      <span>{valor}</span>
    </div>
  );
}

// Dato de solo lectura con el mismo aspecto que un campo editable: rotulo
// arriba y caja del mismo alto. Asi la cabecera se lee como una sola rejilla y
// no como dos disenos mezclados.
function Dato({
  titulo,
  valor,
  ancho,
}: {
  titulo: string;
  valor: string;
  ancho?: string;
}) {
  return (
    <div className={`text-xs ${ancho ?? ""}`}>
      <div className="text-dorado-osc font-semibold mb-0.5">{titulo}</div>
      <div
        className="border border-gray-200 bg-gray-50 rounded px-2 py-1 h-7 flex items-center font-semibold text-gray-800 truncate"
        title={valor}
      >
        {valor}
      </div>
    </div>
  );
}
