"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { IconoAsa, moverEn, useArrastrarFilas } from "@/components/ArrastrarFilas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fecha as fmtFecha, porcentaje, unidades as fmtUnid, telefono as fmtTelefono, hoyISO, importe, redondea, limpia, textoMedidas } from "@/lib/formato";
import { crearNecesidadDesdePedido } from "@/app/necesidades/acciones";
import BotonDuplicar from "@/components/BotonDuplicar";
import BotonRecostearPedido from "@/components/BotonRecostearPedido";
import GrupoCabecera from "@/components/GrupoCabecera";
import BorrarPedido from "@/components/BorrarPedido";
import Bitacora from "@/components/Bitacora";
import {
  ROTULO_DESCUENTO_1,
  ROTULO_DESCUENTO_2,
  ROTULO_DESCUENTO_3,
  GRUPO_PRODUCTOS,
  GRUPO_FLETE,
  GRUPO_INSTALACIONES,
  grupoDe,
} from "@/lib/descuentos";
import { ESTADOS_PEDIDO as ESTADOS } from "@/lib/estados";
import VentanaCliente, { type FichaCliente } from "@/components/VentanaCliente";
import CuentaCorrientePedido, {
  type Cuenta,
  type PagoVista,
} from "@/components/CuentaCorrientePedido";
import DespachosPedido, { type DespachoVista } from "@/components/DespachosPedido";
import BuscadorProducto from "@/components/BuscadorProducto";
import type { ProductoVenta } from "@/components/EditorCotizacion";
import FacturaPedido, {
  type FacturaVista,
} from "@/components/FacturaPedido";
import {
  actualizarPedido,
  cambiarMedioPagoPedido,
  actualizarLineasPedido,
  quitarLineaPedido,
  agregarLineasPedido,
  actualizarDescuentosPedido,
  autorizarSinPie,
  revocarSinPie,
  type DatosPedido,
} from "@/app/pedidos/acciones";

// El margen real del pedido: lo vendido, neto, menos lo que realmente costo --egresos aprobados de su proyecto, entre ellos
// las facturas de los transportistas, y los gastos financieros de sus pagos--, todo sin IVA.
export interface MargenReal {
  neto_vendido: number;
  // Cada categoria trae sus egresos, para abrirla en pantalla.
  costos: {
    categoria: string;
    bruto: number;
    neto: number;
    n: number;
    detalle?: { id: number; fecha: string | null; proveedor: string | null; documento: string | null; glosa: string | null; neto: number }[];
  }[];
  costos_neto: number;
  // El adhesivo no se compra por pedido: su costo teorico es el real.
  adhesivo_teorico?: number;
  // Costo de transporte registrado a mano, sin factura aprobada todavia.
  transporte_sin_factura?: { bruto: number; neto: number; n: number; detalle?: { glosa: string | null; neto: number }[] };
  // Otros gastos del pedido registrados a mano, sin factura aprobada todavia.
  otros_sin_factura?: { bruto: number; neto: number; n: number; detalle?: { glosa: string | null; neto: number }[] };
  egresos: number;
  gastos_financieros: {
    bruto: number;
    neto: number;
    pagos_definidos: number;
    por_definir: number;
    monto_por_definir: number;
    detalle?: { fecha: string | null; medio: string | null; neto: number }[];
  };
  costo_total: number;
  margen: number;
  margen_pct: number | null;
  con_costos: boolean;
  provisorio: boolean;
  iva_incluido: boolean;
}

export interface LineaVista {
  id: number;
  sku?: string | null;
  descripcion: string;
  unidades: number;
  // Precio neto de la linea, ya con su descuento.
  valor_unitario: number;
  precio_lista?: number | null;
  descuento_pct?: number;
  largo_max?: number | null;
  ancho_max?: number | null;
  id_producto?: number | null;
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
  ejecutivos = [],
  idMedioPago = null,
  mediosPago = [],
  lineas,
  necesidades,
  solicitudes,
  cuenta,
  pagos,
  facturas,
  despachos = [],
  productos = [],
  grupoPorProducto,
  formaPago,
  medioPago,
  puedeEditar,
  puedeCrear,
  esAdmin,
  autorizacionSinPie = null,
  necesidadesPedido = [],
  ordenesPedido = [],
  costoPorLinea,
  verMargen,
  margenReal,
  facturaTransporte,
  otrosGastos,
  gastoPorMedio,
  lineasSinCosto = 0,
  fichaCliente = null,
  prefijoTelefono = "+56",
  moneda = "CLP",
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
  // Ejecutivos a quienes se puede asignar el pedido.
  ejecutivos?: { id: number; nombre: string }[];
  // Medio de pago del pedido y los que se pueden elegir; al cambiarlo, el recargo pasa al del medio nuevo.
  idMedioPago?: number | null;
  mediosPago?: { id: number; nombre: string }[];
  lineas: LineaVista[];
  necesidades: NecesidadVista[];
  solicitudes: SolicitudVista[];
  cuenta: Cuenta;
  pagos: PagoVista[];
  facturas: FacturaVista[];
  despachos?: DespachoVista[];
  // Catalogo de venta del mercado del pedido, para agregarle productos.
  productos?: ProductoVenta[];
  // Grupo de descuento de cada producto (productos, flete o instalaciones), para la base de cada descuento.
  grupoPorProducto?: Record<number, string>;
  formaPago: string | null;
  medioPago: string | null;
  puedeEditar: boolean;
  puedeCrear: boolean;
  esAdmin: boolean;
  // Si un administrador autorizo pedir insumos con el pie sin cubrir.
  autorizacionSinPie?: { por: string; en: string; motivo: string } | null;
  // Las necesidades de material que ya salieron de este pedido.
  necesidadesPedido?: { id: number; folio: string; estado: string }[];
  // Las ordenes de compra del proyecto del pedido, con lo que se pago de cada una.
  ordenesPedido?: { id: number; num_oc: string; estado: string; proveedor: string; total: number }[];
  // Costo unitario de cada linea, tomado de la cotizacion de origen: el
  // pedido no lo guarda. Solo llega a quien puede ver costos.
  costoPorLinea?: Record<number, number>;
  verMargen?: boolean;
  // El margen con los costos reales ya ingresados; solo lo reciben administradores y supervisores.
  margenReal?: MargenReal | null;
  // Boton para cargar la factura del transportista, para quien puede hacerlo.
  facturaTransporte?: ReactNode;
  // Otros gastos asociados al pedido (instalacion, comisiones, viaticos...).
  otrosGastos?: ReactNode;
  // Medios de pago que llevan gasto financiero, con su tasa (%): el gasto se define al registrar el pago.
  gastoPorMedio?: Record<string, number>;
  // Lineas sin costo conocido: el margen las cuenta como costo cero.
  lineasSinCosto?: number;
  // Ficha completa del cliente, para editarla desde el pedido.
  fichaCliente?: FichaCliente | null;
  prefijoTelefono?: string;
  // CLP o PEN: fija decimales y simbolo de todos los montos del pedido.
  moneda?: string;
}) {
  const router = useRouter();
  const [editable, setEditable] = useState(false);
  const [d, setD] = useState<DatosPedido>(inicial);
  const [ls, setLs] = useState<LineaVista[]>(lineas);
  const [medioSel, setMedioSel] = useState<number | null>(idMedioPago);
  useEffect(() => setMedioSel(idMedioPago), [idMedioPago]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinProveedor, setSinProveedor] = useState<string[]>([]);
  const [pendiente, empezar] = useTransition();
  const [verFicha, setVerFicha] = useState(false);
  const [motivoSinPie, setMotivoSinPie] = useState("");

  const soloLectura = !editable || !puedeEditar;
  // Productos, cantidades, precios y descuentos se modifican solo hasta que el pedido genera su necesidad
  // de material (o, en el flujo antiguo, sus solicitudes): desde ahi se compra con esas cantidades.
  const conNecesidad = necesidadesPedido.some((n) => n.estado !== "Anulada") || solicitudes.length > 0;
  const editaLineas = !soloLectura && !conNecesidad;
  // Producto que se esta por agregar.
  const [nuevo, setNuevo] = useState<{ prod: ProductoVenta | null; cantidad: string; valor: string }>({ prod: null, cantidad: "1", valor: "" });
  const subtotal = ls.reduce((s, l) => s + l.unidades * l.valor_unitario, 0);
  // Los descuentos vienen de la cotizacion y quedan grabados en el pedido:
  // aqui no se editan, pero el neto y el margen tienen que considerarlos. La
  // cuenta ya los trae recortados a su base (productos el primero, flete y
  // mano de obra el segundo).
  // Cada descuento va sobre su propia base (productos, flete, instalaciones), igual que en la cotizacion:
  // se escribe el % o el monto y el otro se recalcula; al cambiar cantidades o precios, con el % vigente.
  const bases = useMemo(() => {
    const b = [0, 0, 0];
    for (const l of ls) {
      const g = grupoDe(grupoPorProducto, l.id_producto);
      b[g === GRUPO_PRODUCTOS ? 0 : g === GRUPO_FLETE ? 1 : 2] += l.unidades * l.valor_unitario;
    }
    return b;
  }, [ls, grupoPorProducto]);
  type DescEstado = { tipo: "Porcentaje" | "Monto"; pct: number; monto: number };
  const desdeCuenta = (): DescEstado[] =>
    [cuenta.descuento_monto, cuenta.descuento2_monto, cuenta.descuento3_monto].map((m, i) => {
      const monto = Number(m ?? 0);
      const base = lineas.reduce((t, l) => {
        const g = grupoDe(grupoPorProducto, l.id_producto);
        return (g === GRUPO_PRODUCTOS ? 0 : g === GRUPO_FLETE ? 1 : 2) === i ? t + Number(l.unidades) * Number(l.valor_unitario) : t;
      }, 0);
      // El % exacto (sin redondear) reproduce el monto grabado.
      return { tipo: "Porcentaje" as const, pct: base > 0 ? (monto / base) * 100 : 0, monto };
    });
  const [dstate, setDstate] = useState<DescEstado[]>(desdeCuenta);
  const descs = useMemo(
    () =>
      dstate.map((x, i) =>
        x.tipo === "Porcentaje"
          ? redondea((bases[i] * Math.min(Math.max(x.pct, 0), 100)) / 100, moneda)
          : Math.min(Math.max(x.monto, 0), bases[i])
      ) as [number, number, number],
    [dstate, bases, moneda]
  );
  const [descuento, descuento2, descuento3] = descs;
  const pctMostrado = (i: number) =>
    dstate[i].tipo === "Porcentaje" ? dstate[i].pct : bases[i] > 0 ? Math.round((descs[i] / bases[i]) * 10000) / 100 : 0;
  // Al volver de grabar, la pantalla toma lo que quedo en la base: las lineas nuevas ya tienen su id real.
  useEffect(() => {
    setLs(lineas);
  }, [lineas]);
  useEffect(() => {
    setDstate(desdeCuenta());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta.descuento_monto, cuenta.descuento2_monto, cuenta.descuento3_monto]);
  const descuentos = [
    { i: 0, rotulo: ROTULO_DESCUENTO_1, monto: descuento },
    { i: 1, rotulo: ROTULO_DESCUENTO_2, monto: descuento2 },
    { i: 2, rotulo: ROTULO_DESCUENTO_3, monto: descuento3 },
  ].filter((x) => editaLineas || x.monto > 0);
  const totalNeto = subtotal - descuento - descuento2 - descuento3;
  // El pedido tiene que mostrar los mismos escalones que la cotizacion y la
  // factura: neto, impuesto y bruto. La tasa sale de la cuenta del pedido
  // --es la que se le aplico a esta venta-- y no de los parametros de hoy.
  const tasaIva =
    Number(cuenta.total_neto) > 0
      ? Number(cuenta.iva) / Number(cuenta.total_neto)
      : 0;
  // Si el neto es el de la cuenta, el impuesto es el de la cuenta: la tasa sale de
  // un cociente ya redondeado y recalcular desde ella puede errar un centimo.
  const iva =
    totalNeto === Number(cuenta.total_neto)
      ? Number(cuenta.iva)
      : redondea(totalNeto * tasaIva, moneda);
  const totalBruto = limpia(totalNeto + iva);
  // El recargo del medio de pago no se descuenta del precio: se suma sobre el
  // total, para que a Centro Panel le llegue integro lo vendido.
  const comisionPct = Number(cuenta.comision_pct ?? 0);
  const totalAPagar =
    comisionPct > 0 && comisionPct < 100
      ? redondea(totalBruto / (1 - comisionPct / 100), moneda)
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
  // Apertura de los costos del margen teorico y del real (cada grupo se abre y se cierra por separado).
  const [abiertoTeorico, setAbiertoTeorico] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const alternar = (k: string) => setAbiertos((x) => ({ ...x, [k]: !x[k] }));

  // Cambia el orden de las lineas; al grabar, el orden de la pantalla queda en el pedido.
  const arrastre = useArrastrarFilas((desde, hasta) => setLs((x) => moverEn(x, desde, hasta)), ls.length);

  // Precio de lista y descuento de una linea: el valor unitario es el neto que resulta, y es lo que suma el pedido.
  function cambiarPrecioLinea(idLinea: number, cambio: { lista?: number; pct?: number }) {
    setLs((x) =>
      x.map((y) => {
        if (y.id !== idLinea) return y;
        const lista = cambio.lista ?? y.precio_lista ?? y.valor_unitario;
        const pct = Math.min(Math.max(cambio.pct ?? y.descuento_pct ?? 0, 0), 100);
        return pct > 0
          ? { ...y, precio_lista: lista, descuento_pct: pct, valor_unitario: redondea(lista * (1 - pct / 100), moneda) }
          : { ...y, precio_lista: null, descuento_pct: 0, valor_unitario: lista };
      })
    );
  }
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
      if (medioSel != null && medioSel !== idMedioPago) {
        const rm = await cambiarMedioPagoPedido(id, medioSel);
        if (rm?.error) {
          setError(rm.error);
          return;
        }
      }
      // Las lineas nuevas (id negativo) se insertan; las demas se actualizan. El orden es el de la pantalla.
      const r2 = await actualizarLineasPedido(
        id,
        ls
          .map((l, i) => ({
            id: l.id,
            orden: i + 1,
            unidades: l.unidades,
            valor_unitario: l.valor_unitario,
            precio_lista: l.precio_lista ?? null,
            descuento_pct: l.descuento_pct ?? 0,
          }))
          .filter((l) => l.id > 0)
      );
      if (r2?.error) {
        setError(r2.error);
        return;
      }
      const nuevas = ls
        .map((l, i) => ({ l, orden: i + 1 }))
        .filter((x) => x.l.id < 0 && x.l.id_producto != null);
      if (nuevas.length) {
        const r3 = await agregarLineasPedido(
          id,
          nuevas.map(({ l, orden }) => ({
            orden,
            id_producto: Number(l.id_producto),
            descripcion: l.descripcion,
            unidades: l.unidades,
            valor_unitario: l.valor_unitario,
            precio_lista: l.precio_lista ?? null,
            descuento_pct: l.descuento_pct ?? 0,
          }))
        );
        if (r3?.error) {
          setError(r3.error);
          return;
        }
      }
      const antes = [Number(cuenta.descuento_monto ?? 0), Number(cuenta.descuento2_monto ?? 0), Number(cuenta.descuento3_monto ?? 0)];
      if (descs.some((m, i) => m !== antes[i])) {
        const r4 = await actualizarDescuentosPedido(id, descs);
        if (r4?.error) {
          setError(r4.error);
          return;
        }
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
          {esAdmin && facturas.length === 0 && <BotonRecostearPedido id={id} moneda={moneda} />}
          <Link
            href={`/pedidos/${id}/pdf`}
            target="_blank"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Ver PDF
          </Link>
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
                <span className="text-gray-500">sin {etiquetaId}</span>
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
          <label className="text-xs sm:col-span-2">
            <span className="block text-dorado-osc font-semibold mb-0.5">Ejecutivo</span>
            <select
              className={input}
              disabled={soloLectura}
              value={d.id_vendedor ?? ""}
              onChange={(e) => setD({ ...d, id_vendedor: Number(e.target.value) || null })}
            >
              {!ejecutivos.some((x) => x.id === d.id_vendedor) && <option value={d.id_vendedor ?? ""}>{vendedor}</option>}
              {ejecutivos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
        </GrupoCabecera>

        <GrupoCabecera titulo="PAGO">
          <Dato
            titulo="Forma de pago"
            valor={formaPago ?? "--"}
            ancho="sm:col-span-2"
          />
          <label className="text-xs sm:col-span-2">
            <span className="block text-dorado-osc font-semibold mb-0.5">Medio de pago</span>
            <select
              className={input}
              disabled={soloLectura || mediosPago.length === 0}
              value={medioSel ?? ""}
              onChange={(e) => setMedioSel(Number(e.target.value) || null)}
            >
              {medioSel == null && <option value="">{medioPago ?? "--"}</option>}
              {mediosPago.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
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
                {editaLineas && <th className="w-6" aria-label="Orden" />}
                <th className="text-left px-2 py-2 w-8">N</th>
                <th className="text-left px-2 py-2 w-20 whitespace-nowrap">SKU</th>
                <th className="text-left px-2 py-2">Descripcion</th>
                <th className="text-right px-2 py-2 w-20 whitespace-nowrap">Unid.</th>
                <th className="text-right px-2 py-2 w-28 whitespace-nowrap">P. lista</th>
                <th className="text-right px-2 py-2 w-16 whitespace-nowrap">Desc. %</th>
                <th className="text-right px-2 py-2 w-28 whitespace-nowrap">V. unit. neto</th>
                <th className="text-right px-2 py-2 w-28 whitespace-nowrap">Subtotal</th>
                {verMargen && (
                  <th className="text-right px-2 py-2 whitespace-nowrap" title="Subtotal de la linea menos su costo, antes de los descuentos generales">
                    Margen
                  </th>
                )}
                {editaLineas && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {ls.map((l, i) => {
                const f = arrastre.fila(i);
                return (
                <tr
                  key={l.id}
                  className={`border-t border-gray-100 ${!editaLineas ? "" : f.className}`}
                  onDragOver={!editaLineas ? undefined : f.onDragOver}
                  onDrop={!editaLineas ? undefined : f.onDrop}
                >
                  {editaLineas && (
                    <td className="pl-2 py-2">
                      <span {...arrastre.asa(i)}>
                        <IconoAsa />
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-2 py-2 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                    {l.sku ?? ""}
                  </td>
                  <td className="px-2 py-2">
                    {l.descripcion}
                    {textoMedidas(l.largo_max, l.ancho_max) && (
                      <span className="block text-[10px] leading-tight text-gray-500">{textoMedidas(l.largo_max, l.ancho_max)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    {!editaLineas ? (
                      fmtUnid(l.unidades)
                    ) : (
                      <input
                        type="number"
                        className="border border-gray-300 rounded px-2 py-1 text-right w-16"
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
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    {!editaLineas ? (
                      <span className="text-gray-600">{importe(l.precio_lista ?? l.valor_unitario, moneda)}</span>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Precio de lista de la linea ${i + 1}`}
                        className="border border-gray-300 rounded px-2 py-1 text-right w-24"
                        value={importe(l.precio_lista ?? l.valor_unitario, moneda)}
                        onChange={(e) =>
                          cambiarPrecioLinea(l.id, { lista: Number(e.target.value.replace(/\D/g, "")) || 0 })
                        }
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    {!editaLineas ? (
                      l.descuento_pct ? `${porcentaje(l.descuento_pct)} %` : <span className="text-gray-400">—</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        aria-label={`Descuento % de la linea ${i + 1}`}
                        className="border border-gray-300 rounded px-2 py-1 text-right w-14"
                        value={l.descuento_pct || ""}
                        placeholder="0"
                        onChange={(e) => cambiarPrecioLinea(l.id, { pct: Number(e.target.value.replace(",", ".")) || 0 })}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">{importe(l.valor_unitario, moneda)}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-right font-semibold">
                    {importe(l.unidades * l.valor_unitario, moneda)}
                  </td>
                  {verMargen && (
                    <td className="px-2 py-2 whitespace-nowrap text-right">
                      {(() => {
                        const costo = Number(costoPorLinea?.[l.id] ?? 0);
                        if (!costo) return <span className="text-amber-700">sin costo</span>;
                        const m = l.unidades * (l.valor_unitario - costo);
                        const pct = l.valor_unitario > 0 ? ((l.valor_unitario - costo) / l.valor_unitario) * 100 : 0;
                        return (
                          <span className={m < 0 ? "text-red-700" : "text-dorado-osc"}>
                            {importe(m, moneda)} · {porcentaje(pct)} %
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {editaLineas && (
                    <td className="px-2 text-right">
                      <button
                        onClick={() =>
                          l.id < 0
                            ? setLs((x) => x.filter((y) => y.id !== l.id))
                            : empezar(async () => {
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
                );
              })}
            </tbody>
          </table>
        </div>
        {editaLineas && (
          <div className="border-t border-gray-200 p-3 flex flex-wrap items-end gap-2 text-xs">
            <div className="min-w-[18rem] flex-1">
              <span className="block text-dorado-osc font-semibold mb-0.5">Agregar producto</span>
              <BuscadorProducto
                productos={productos}
                valor={nuevo.prod?.id ?? null}
                onElegir={(pr) => setNuevo((x) => ({ ...x, prod: pr, valor: pr ? String(pr.precio_venta ?? 0) : "" }))}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
              />
            </div>
            <label className="w-20">
              <span className="block text-dorado-osc font-semibold mb-0.5">Cantidad</span>
              <input id="ped-nuevo-cant" type="number" step="any" className="border border-gray-300 rounded px-2 py-1 text-right w-full" value={nuevo.cantidad} onChange={(e) => setNuevo((x) => ({ ...x, cantidad: e.target.value }))} />
            </label>
            <label className="w-28">
              <span className="block text-dorado-osc font-semibold mb-0.5">V. unit. neto</span>
              <input id="ped-nuevo-valor" type="number" step="any" className="border border-gray-300 rounded px-2 py-1 text-right w-full" value={nuevo.valor} onChange={(e) => setNuevo((x) => ({ ...x, valor: e.target.value }))} />
            </label>
            <button
              type="button"
              className="bg-verde text-white font-semibold px-3 py-1 rounded disabled:opacity-40"
              disabled={!nuevo.prod || !(Number(nuevo.cantidad) > 0)}
              onClick={() => {
                const pr = nuevo.prod;
                if (!pr) return;
                setLs((x) => [
                  ...x,
                  {
                    id: -Date.now(),
                    id_producto: pr.id,
                    sku: pr.sku ?? null,
                    descripcion: pr.descripcion,
                    unidades: Number(nuevo.cantidad.replace(",", ".")),
                    valor_unitario: Number(nuevo.valor.replace(",", ".")) || 0,
                    precio_lista: null,
                    descuento_pct: 0,
                    largo_max: pr.largo_max ?? null,
                    ancho_max: pr.ancho_max ?? null,
                  },
                ]);
                setNuevo({ prod: null, cantidad: "1", valor: "" });
              }}
            >
              Agregar
            </button>
            <span className="text-gray-500 basis-full">Queda en el pedido al GRABAR.</span>
          </div>
        )}
        {!soloLectura && conNecesidad && (
          <p className="border-t border-gray-200 px-3 py-2 text-xs text-amber-800 bg-amber-50">
            El pedido ya genero su necesidad de material: los productos, cantidades, precios y descuentos ya no se pueden modificar.
          </p>
        )}
      </div>

      {/* Los totales van fuera de la tabla, en su propia columna a la derecha,
          igual que en la cotizacion. Dentro de la tabla las cifras caian en la
          columna del subtotal de cada linea y los rotulos se estiraban sobre
          cuatro columnas: eso es lo que se veia corrido. */}
      <div className="bg-white border border-gray-200 rounded px-3 py-2">
        <div className="max-w-md ml-auto space-y-0.5 text-xs">
          <Fila label="SUBTOTAL" valor={importe(subtotal, moneda)} />
          {descuentos.map((x) =>
            editaLineas ? (
              <div key={x.rotulo} className="flex items-center justify-end gap-2 px-3">
                <label htmlFor={`ped-desc-${x.i}`} className="mr-auto">
                  {x.rotulo}
                  <span className="block text-[11px] text-gray-500">sobre {["los productos", "el flete", "las instalaciones"][x.i]}: {importe(bases[x.i], moneda)}</span>
                </label>
                <input
                  id={`ped-desc-pct-${x.i}`}
                  type="number"
                  aria-label={`${x.rotulo} en porcentaje`}
                  className="border border-gray-300 rounded px-2 py-1 text-right w-24"
                  value={pctMostrado(x.i)}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setDstate((d) => d.map((y, k) => (k === x.i ? { ...y, tipo: "Porcentaje" as const, pct: v } : y)));
                  }}
                />
                <span className="text-gray-500">%</span>
                <input
                  id={`ped-desc-${x.i}`}
                  type="text"
                  inputMode="numeric"
                  className="border border-gray-300 rounded px-2 py-1 text-right w-32"
                  value={importe(x.monto, moneda)}
                  onChange={(e) => {
                    const m = Number(e.target.value.replace(/\D/g, "")) || 0;
                    setDstate((d) => d.map((y, k) => (k === x.i ? { ...y, tipo: "Monto" as const, monto: m } : y)));
                  }}
                />
              </div>
            ) : (
              <Fila key={x.rotulo} label={x.rotulo} valor={importe(x.monto, moneda)} />
            )
          )}
          <Fila label="TOTAL NETO" valor={importe(totalNeto, moneda)} fuerte />
          <Fila
            label={`${impuesto} ${Math.round(tasaIva * 100)}%`}
            valor={importe(iva, moneda)}
          />
          <div className="flex justify-between bg-verde text-white px-3 py-1 rounded font-bold">
            <span>TOTAL</span>
            <span>{importe(totalBruto, moneda)}</span>
          </div>

          {margenReal && margenReal.con_costos && !margenReal.provisorio && (
            <div className="mt-2 flex justify-between px-3 py-1.5 rounded bg-verde text-white font-bold">
              <span>
                MARGEN REAL {margenReal.margen_pct != null ? `${porcentaje(margenReal.margen_pct)} %` : ""}
                <span className="ml-2 font-normal text-[11px]">con {margenReal.egresos} egreso{margenReal.egresos === 1 ? "" : "s"} aprobado{margenReal.egresos === 1 ? "" : "s"}</span>
              </span>
              <span>{importe(margenReal.margen, moneda)}</span>
            </div>
          )}

          {verMargen && (
            <div className="mt-2 border-t border-gray-200 pt-2 space-y-0.5">
              <FilaAbrible
                label="Costo de lo pedido"
                valor={importe(costoPedido, moneda)}
                abierto={abiertoTeorico}
                onAlternar={() => setAbiertoTeorico((x) => !x)}
              >
                {ls.map((l) => {
                  const cu = Number(costoPorLinea?.[l.id] ?? 0);
                  return (
                    <FilaDetalle
                      key={l.id}
                      izq={
                        <>
                          {l.descripcion}{" "}
                          {textoMedidas(l.largo_max, l.ancho_max) && (
                            <span className="text-[10px] text-gray-500">[{textoMedidas(l.largo_max, l.ancho_max)}] </span>
                          )}
                          <span className="text-gray-500">
                            ({fmtUnid(l.unidades)} × {cu ? importe(cu, moneda) : "sin costo"})
                          </span>
                        </>
                      }
                      der={importe(l.unidades * cu, moneda)}
                    />
                  );
                })}
              </FilaAbrible>
              <div className="flex justify-between px-3 py-1.5 rounded bg-crema text-dorado-osc font-bold">
                <span>
                  MARGEN TEORICO {porcentaje(margenPct)} %{margenReal && margenReal.con_costos && !margenReal.provisorio ? " (referencia: el real es el de arriba)" : ""}
                  {lineasSinCosto > 0 && (
                    <span className="ml-2 font-normal text-[11px] text-amber-700">
                      ({lineasSinCosto} linea{lineasSinCosto > 1 ? "s" : ""} sin
                      costo cargado)
                    </span>
                  )}
                </span>
                <span>{importe(margen, moneda)}</span>
              </div>
            </div>
          )}

          {margenReal && (
            <div className="mt-2 border-t border-gray-200 pt-2 space-y-0.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-dorado-osc">Margen real, con los costos ya ingresados (sin {impuesto})</div>
              <Fila label="Venta neta" valor={importe(margenReal.neto_vendido, moneda)} />
              {margenReal.costos.map((c) => (
                <FilaAbrible
                  key={c.categoria}
                  label={`− ${c.categoria} (${c.n})`}
                  valor={importe(c.neto, moneda)}
                  abierto={!!abiertos[`c:${c.categoria}`]}
                  onAlternar={() => alternar(`c:${c.categoria}`)}
                >
                  {(c.detalle ?? []).map((m) => (
                    <FilaDetalle
                      key={m.id}
                      izq={
                        <>
                          {m.fecha ? fmtFecha(m.fecha) : "sin fecha"} · {m.proveedor ?? "sin proveedor"}
                          {m.documento ? ` · doc ${m.documento}` : ""}
                          {m.glosa ? <span className="text-gray-500"> · {m.glosa}</span> : null}
                        </>
                      }
                      der={importe(m.neto, moneda)}
                    />
                  ))}
                </FilaAbrible>
              ))}
              {(margenReal.adhesivo_teorico ?? 0) > 0 && <Fila label="− Adhesivo (costo teorico)" valor={importe(margenReal.adhesivo_teorico ?? 0, moneda)} />}
              {(margenReal.transporte_sin_factura?.n ?? 0) > 0 && (
                <FilaAbrible
                  label="− Transporte (valor estimado, sin factura aprobada)"
                  valor={importe(margenReal.transporte_sin_factura?.neto ?? 0, moneda)}
                  abierto={!!abiertos.transporte}
                  onAlternar={() => alternar("transporte")}
                >
                  {(margenReal.transporte_sin_factura?.detalle ?? []).map((t, k) => (
                    <FilaDetalle key={k} izq={t.glosa || "sin comentario"} der={importe(t.neto, moneda)} />
                  ))}
                </FilaAbrible>
              )}
              {(margenReal.otros_sin_factura?.n ?? 0) > 0 && (
                <FilaAbrible
                  label="− Otros gastos (valor estimado, sin factura aprobada)"
                  valor={importe(margenReal.otros_sin_factura?.neto ?? 0, moneda)}
                  abierto={!!abiertos.otros}
                  onAlternar={() => alternar("otros")}
                >
                  {(margenReal.otros_sin_factura?.detalle ?? []).map((t, k) => (
                    <FilaDetalle key={k} izq={t.glosa || "sin comentario"} der={importe(t.neto, moneda)} />
                  ))}
                </FilaAbrible>
              )}
              {(margenReal.gastos_financieros.detalle ?? []).length > 0 ? (
                <FilaAbrible
                  label={`− Gastos financieros${margenReal.gastos_financieros.por_definir > 0 ? ` (${margenReal.gastos_financieros.por_definir} pago${margenReal.gastos_financieros.por_definir > 1 ? "s" : ""} por definir)` : ""}`}
                  valor={importe(margenReal.gastos_financieros.neto, moneda)}
                  abierto={!!abiertos.financieros}
                  onAlternar={() => alternar("financieros")}
                >
                  {(margenReal.gastos_financieros.detalle ?? []).map((g, k) => (
                    <FilaDetalle key={k} izq={`${g.fecha ? fmtFecha(g.fecha) : "sin fecha"} · ${g.medio ?? ""}`} der={importe(g.neto, moneda)} />
                  ))}
                </FilaAbrible>
              ) : (
                <Fila
                  label={`− Gastos financieros${margenReal.gastos_financieros.por_definir > 0 ? ` (${margenReal.gastos_financieros.por_definir} pago${margenReal.gastos_financieros.por_definir > 1 ? "s" : ""} por definir)` : ""}`}
                  valor={importe(margenReal.gastos_financieros.neto, moneda)}
                />
              )}
              <div className="flex justify-between px-3 py-1.5 rounded bg-crema text-dorado-osc font-bold">
                <span>MARGEN REAL {margenReal.margen_pct != null ? `${porcentaje(margenReal.margen_pct)} %` : ""}</span>
                <span>{importe(margenReal.margen, moneda)}</span>
              </div>
              {margenReal.provisorio && (
                <p className="text-[11px] text-amber-700">
                  {margenReal.gastos_financieros.por_definir > 0
                    ? "Provisorio: hay gastos financieros por definir."
                    : (margenReal.transporte_sin_factura?.n ?? 0) > 0
                      ? "Provisorio: el transporte aun no tiene factura aprobada."
                      : "Todavia no hay costos ingresados para este pedido: el margen real sube a medida que se ingresan."}
                </p>
              )}
              {facturaTransporte}
              {otrosGastos}
            </div>
          )}

          {comisionPct > 0 && (
            <>
              <Fila
                label={`Recargo ${porcentaje(comisionPct)} %${
                  medioPago ? ` por ${medioPago}` : ""
                }`}
                valor={importe(totalAPagar - totalBruto, moneda)}
              />
              <div className="flex justify-between bg-dorado-osc text-white px-3 py-1 rounded font-bold">
                <span>TOTAL A PAGAR</span>
                <span>{importe(totalAPagar, moneda)}</span>
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
        moneda={moneda}
        impuesto={impuesto}
        formaPago={formaPago}
        medioPago={medioPago}
        cuenta={cuenta}
        pagos={pagos}
        puedeCrear={puedeCrear}
        esAdmin={esAdmin}
        tasaIva={tasaIva}
        gastoPorMedio={gastoPorMedio}
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
                    <td colSpan={2} className="text-center text-gray-500 py-6">
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

          {necesidades.length > 0 && !cuenta.pie_cubierto && (
            <div
              className={`text-xs rounded border p-3 space-y-2 ${
                autorizacionSinPie
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
              role="status"
            >
              {autorizacionSinPie ? (
                <>
                  <p>
                    <strong>Autorizado sin el pie completo</strong> por {autorizacionSinPie.por}
                    {autorizacionSinPie.en && <> el {fmtFecha(autorizacionSinPie.en.slice(0, 10))}</>}
                    {autorizacionSinPie.motivo && <>: {autorizacionSinPie.motivo}</>}
                  </p>
                  {esAdmin && (
                    <button
                      type="button"
                      disabled={pendiente}
                      className="border border-green-700 text-green-900 font-semibold px-2.5 py-0.5 rounded bg-white disabled:opacity-50"
                      onClick={() =>
                        empezar(async () => {
                          setError(null);
                          setAviso(null);
                          const r = await revocarSinPie(id);
                          if (r?.error) return setError(r.error);
                          setAviso(r.mensaje ?? "Autorizacion revocada.");
                          router.refresh();
                        })
                      }
                    >
                      Revocar autorizacion
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>
                    <strong>Falta el pie:</strong> se exigen {importe(cuenta.pie_monto, moneda)} y van abonados{" "}
                    {importe(cuenta.abonado, moneda)}.{" "}
                    {esAdmin
                      ? "Puede autorizar que se generen las solicitudes de compra igual."
                      : "Para generar las solicitudes de compra, un administrador debe autorizarlo en este pedido."}
                  </p>
                  {esAdmin && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[16rem]">
                        <label htmlFor="motivo-sin-pie" className="block font-semibold mb-0.5">
                          Motivo de la autorizacion
                        </label>
                        <input
                          id="motivo-sin-pie"
                          value={motivoSinPie}
                          onChange={(e) => setMotivoSinPie(e.target.value)}
                          maxLength={300}
                          placeholder="Por ejemplo: cliente con orden de compra firmada, pago en camino"
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white text-negro"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={pendiente || motivoSinPie.trim().length < 5}
                        className="bg-dorado-osc text-white font-semibold px-3 py-1 rounded disabled:opacity-40"
                        onClick={() =>
                          empezar(async () => {
                            setError(null);
                            setAviso(null);
                            const r = await autorizarSinPie(id, motivoSinPie);
                            if (r?.error) return setError(r.error);
                            setMotivoSinPie("");
                            setAviso(r.mensaje ?? "Autorizado.");
                            router.refresh();
                          })
                        }
                      >
                        Autorizar sin el pie completo
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {puedeCrear && necesidades.length > 0 && (
            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={() =>
                  empezar(async () => {
                    setError(null);
                    setAviso(null);
                    const r = await crearNecesidadDesdePedido(id);
                    if (!r.ok) {
                      setError(r.error ?? "No se pudo generar la necesidad.");
                      return;
                    }
                    // Los insumos pasan a una necesidad de material: ahi se cotizan, se abren y se adjudican.
                    router.push(`/necesidades/${r.id}`);
                  })
                }
                disabled={pendiente || !(cuenta.pie_cubierto || autorizacionSinPie)}
                className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                title={
                  cuenta.pie_cubierto || autorizacionSinPie
                    ? undefined
                    : "Falta el pie del cliente: un administrador puede autorizar"
                }
              >
                {pendiente ? "Generando..." : "Generar necesidad de material"}
              </button>
              <span className="text-xs text-gray-500">
                {cuenta.pie_cubierto || autorizacionSinPie
                  ? "Pasa estos insumos a una necesidad de material, donde se cotizan a varios proveedores y se adjudican."
                  : "Registre el pie en la cuenta corriente, o pida a un administrador que autorice."}
              </span>
            </div>
          )}

          {necesidadesPedido.length > 0 && (
            <p className="text-xs text-gray-700">
              Necesidades de material de este pedido:{" "}
              {necesidadesPedido.map((n, k) => (
                <span key={n.id}>
                  {k > 0 && ", "}
                  <Link href={`/necesidades/${n.id}`} className="text-verde font-semibold underline">
                    {n.folio}
                  </Link>{" "}
                  <span className="text-gray-500">({n.estado})</span>
                </span>
              ))}
            </p>
          )}

          {ordenesPedido.length > 0 && (
            <p className="text-xs text-gray-700">
              Ordenes de compra de este pedido:{" "}
              {ordenesPedido.map((o, k) => (
                <span key={o.id}>
                  {k > 0 && ", "}
                  <Link href={`/compras/${o.id}`} className="text-verde font-semibold underline">
                    {o.num_oc}
                  </Link>{" "}
                  <span className="text-gray-500">
                    ({o.proveedor} · {importe(o.total, moneda)} · {o.estado})
                  </span>
                </span>
              ))}
            </p>
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

      {/* Las solicitudes de antes de las necesidades de material: solo se consultan, no se generan ni se modifican. */}
      {solicitudes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
            SOLICITUDES ANTERIORES (HISTORIAL)
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
              {solicitudes.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-2 font-semibold text-verde">{s.num}</td>
                  <td className="px-3 py-2">{s.proveedor}</td>
                  <td className="px-3 py-2 text-right">{s.lineas}</td>
                  <td className="px-3 py-2">{s.estado === "Adjudicada" ? "Adjudicada" : s.estado}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link href={`/solicitudes/${s.id}`} target="_blank" className="text-verde underline">
                      ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DespachosPedido
        idPedido={id}
        lineas={lineas.map((l) => ({ id: l.id, sku: l.sku, descripcion: l.descripcion, unidades: Number(l.unidades) }))}
        despachos={despachos}
        puedeRegistrar={puedeEditar}
        esAdmin={esAdmin}
        anulado={inicial.estado === "Anulado"}
      />

      <FacturaPedido
        idPedido={id}
        moneda={moneda}
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

// Fila de un costo que se abre para ver de que esta hecho. El triangulo y el subrayado punteado indican que se puede
// abrir; la apertura queda debajo, sangrada y en letra menor.
function FilaAbrible({
  label,
  valor,
  abierto,
  onAlternar,
  children,
}: {
  label: string;
  valor: string;
  abierto: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierto}
        className="w-full flex justify-between text-left hover:bg-gray-50 rounded"
      >
        <span className="text-gray-700">
          <span className="inline-block w-3 text-gray-500">{abierto ? "▾" : "▸"}</span>
          <span className="underline decoration-dotted decoration-gray-400 underline-offset-2">{label}</span>
        </span>
        <span>{valor}</span>
      </button>
      {abierto && <div className="ml-3 mt-0.5 mb-1 border-l border-gray-200 pl-2 space-y-0.5 text-[11px] text-gray-600">{children}</div>}
    </div>
  );
}

function FilaDetalle({ izq, der }: { izq: ReactNode; der: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0">{izq}</span>
      <span className="whitespace-nowrap">{der}</span>
    </div>
  );
}
