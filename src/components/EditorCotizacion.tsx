"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BuscadorProducto from "@/components/BuscadorProducto";
import BotonDuplicar from "@/components/BotonDuplicar";
import Link from "next/link";
import BarraNavegacion from "@/components/BarraNavegacion";
import ModalNuevoPanel from "@/components/ModalNuevoPanel";
import VentanaCliente, { type FichaCliente } from "@/components/VentanaCliente";
import ModalNuevoCliente from "@/components/ModalNuevoCliente";
import type { MateriaVenta } from "@/components/Configurador";
import type { MedioPago } from "@/components/GestorMediosPago";
import {
  pesos,
  unidades as fmtUnid,
  sumarDias,
  fecha as fmtFecha,
  porcentaje,
  hoyISO,
} from "@/lib/formato";
import {
  crearCotizacion,
  actualizarCotizacion,
  type DatosCotizacion,
  type ItemBorrador,
} from "@/app/cotizaciones/acciones";
import type { Cliente, FormaPago, Pais, TipoDescuento } from "@/types/database";
import {
  grupoDe,
  GRUPO_FLETE,
  GRUPO_INSTALACIONES,
  GRUPO_PRODUCTOS,
  ROTULO_DESCUENTO_1,
  ROTULO_DESCUENTO_2,
  ROTULO_DESCUENTO_3,
} from "@/lib/descuentos";
import SelectorEstado from "@/components/SelectorEstado";

// Producto tal como lo ve el vendedor: sin costo_unitario, porque el catalogo
// llega por v_catalogo_venta (el RLS impide a un Vendedor ver costos).
export interface ProductoVenta {
  id: number;
  descripcion: string;
  tipo: string;
  familia: string | null;
  subfamilia: string | null;
  precio_venta: number;
  // Producto cuyo valor se pacta en cada cotizacion (mano de obra, flete,
  // descuento): son los unicos que pueden ir en cero.
  precio_manual?: boolean | null;
}

interface Props {
  modo: "crear" | "editar" | "ver";
  id?: number;
  clientes: Cliente[];
  paises: Pais[];
  esAdminGeneral: boolean;
  formasPago: FormaPago[];
  mediosPago: MedioPago[];
  productos: ProductoVenta[];
  // Grupo de descuento de cada producto del catalogo (Productos, Flete o
  // Instalaciones), configurado en el catalogo.
  grupoPorProducto?: Record<number, string>;
  // Insumos para el panel emergente que crea un panel sin salir del cotizador.
  materias: MateriaVenta[];
  puedeCrearPanel: boolean;
  ivaPorPais: Record<number, number>;
  inicial: DatosCotizacion;
  numCotizacion?: string | null;
  estado?: string;
  puedeEditar: boolean;
  // El margen solo lo ve quien puede ver costos.
  verMargen?: boolean;
  // Costo de hoy de cada producto del catalogo: vale cuando la linea se
  // grabo sin costo.
  costoPorProducto?: Record<number, number>;
}

export default function EditorCotizacion(p: Props) {
  const router = useRouter();
  const [d, setD] = useState<DatosCotizacion>(p.inicial);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  // En modo "ver" nada se edita hasta pulsar Modificar, igual que el boton
  // Visualizar de Access dejaba el formulario en solo lectura.
  const [editable, setEditable] = useState(p.modo !== "ver");
  const soloLectura = !editable || !p.puedeEditar;

  // --- alta de items ---
  const [prodSel, setProdSel] = useState<string>("");
  const [cantidad, setCantidad] = useState<string>("1");
  const [valorUnit, setValorUnit] = useState<string>("");

  // Paneles creados desde el panel emergente durante esta sesion. Se guardan
  // aparte y no se recarga la pagina: recargar descartaria la cotizacion en
  // curso, que es justo lo que hay que evitar.
  const [productosExtra, setProductosExtra] = useState<ProductoVenta[]>([]);
  const [modalPanel, setModalPanel] = useState(false);

  // Igual que con los paneles: los clientes creados durante esta sesion se
  // agregan a la lista sin recargar, que descartaria la cotizacion en curso.
  const [clientesExtra, setClientesExtra] = useState<Cliente[]>([]);
  const [modalCliente, setModalCliente] = useState(false);
  // Ficha del cliente elegido, para completar sus datos sin salir.
  const [fichaCliente, setFichaCliente] = useState(false);

  const listaClientes = useMemo(() => {
    const vistos = new Set(p.clientes.map((c) => c.id));
    return [...p.clientes, ...clientesExtra.filter((c) => !vistos.has(c.id))];
  }, [p.clientes, clientesExtra]);

  const clienteElegido = useMemo(
    () => listaClientes.find((c) => c.id === d.id_cliente) ?? null,
    [listaClientes, d.id_cliente]
  );

  // El mercado de la cotizacion es el de su cliente: las formas y medios de
  // pago y el IVA que se ofrecen son los de ese pais.
  const idPaisDoc =
    clienteElegido?.id_pais ?? (p.paises.length === 1 ? p.paises[0].id : null);
  const formasDelPais = p.formasPago.filter((f) => f.id_pais === idPaisDoc);
  const mediosDelPais = p.mediosPago.filter((m) => m.id_pais === idPaisDoc);
  const tasaIva = p.ivaPorPais[idPaisDoc ?? p.paises[0]?.id ?? 0] ?? 0;
  const nombreImpuesto =
    p.paises.find((x) => x.id === idPaisDoc)?.codigo === "PE" ? "IGV" : "IVA";

  const catalogo = useMemo(() => {
    const vistos = new Set(p.productos.map((x) => x.id));
    return [...p.productos, ...productosExtra.filter((x) => !vistos.has(x.id))];
  }, [p.productos, productosExtra]);

  // --- totales, con la misma formula que la vista v_cotizacion_totales ---
  const subtotal = useMemo(
    () => d.items.reduce((s, it) => s + it.unidades * it.valor_unitario, 0),
    [d.items]
  );

  // Cada descuento va sobre su propia base: productos, flete e instalaciones.
  // Misma regla que fn_sincronizar_descuento en la base.
  const bases = useMemo(() => {
    const b: Record<string, number> = {
      [GRUPO_PRODUCTOS]: 0,
      [GRUPO_FLETE]: 0,
      [GRUPO_INSTALACIONES]: 0,
    };
    for (const it of d.items) {
      b[grupoDe(p.grupoPorProducto, it.id_producto)] +=
        it.unidades * it.valor_unitario;
    }
    return b;
  }, [d.items, p.grupoPorProducto]);
  const baseProductos = bases[GRUPO_PRODUCTOS];
  const baseFlete = bases[GRUPO_FLETE];
  const baseInstalaciones = bases[GRUPO_INSTALACIONES];

  // El descuento se mantiene coherente en los dos sentidos: se escribe el % o
  // el monto y el otro se recalcula. Misma regla que SincronizarDescuento.
  const descuento = useMemo(() => {
    if (d.descuento_tipo === "Porcentaje") {
      const pct = Math.min(Math.max(d.descuento_pct, 0), 100);
      return Math.round((baseProductos * pct) / 100);
    }
    return Math.min(Math.max(d.descuento_monto, 0), baseProductos);
  }, [d.descuento_tipo, d.descuento_pct, d.descuento_monto, baseProductos]);

  const descuento2 = useMemo(() => {
    if (d.descuento2_tipo === "Porcentaje") {
      const pct = Math.min(Math.max(d.descuento2_pct, 0), 100);
      return Math.round((baseFlete * pct) / 100);
    }
    return Math.min(Math.max(d.descuento2_monto, 0), baseFlete);
  }, [d.descuento2_tipo, d.descuento2_pct, d.descuento2_monto, baseFlete]);

  const descuento3 = useMemo(() => {
    if (d.descuento3_tipo === "Porcentaje") {
      const pct = Math.min(Math.max(d.descuento3_pct, 0), 100);
      return Math.round((baseInstalaciones * pct) / 100);
    }
    return Math.min(Math.max(d.descuento3_monto, 0), baseInstalaciones);
  }, [d.descuento3_tipo, d.descuento3_pct, d.descuento3_monto, baseInstalaciones]);

  const totalNeto = subtotal - descuento - descuento2 - descuento3;

  // Margen de la venta: lo que queda sobre el costo de lo cotizado. Se
  // recalcula solo al cambiar lineas, cantidades, precios o descuento.
  const costoDe = (it: ItemBorrador) =>
    Number(it.costo_unitario ?? 0) ||
    (it.id_producto != null ? (p.costoPorProducto?.[it.id_producto] ?? 0) : 0);
  const costoTotal = d.items.reduce(
    (s, it) => s + Number(it.unidades) * costoDe(it),
    0
  );
  const itemsSinCosto = d.items.filter((it) => costoDe(it) === 0).length;
  const margen = totalNeto - costoTotal;
  const margenPct = totalNeto > 0 ? (margen / totalNeto) * 100 : 0;
  const iva = Math.round(totalNeto * tasaIva);
  const total = totalNeto + iva;

  // La comision del medio de pago no se descuenta del precio: se recarga sobre
  // el total, dividiendo por (1 - comision), para que a Centro Panel le llegue
  // integro lo cotizado.
  const medio = p.mediosPago.find((m) => m.id === d.id_medio_pago) ?? null;
  const comisionPct = medio?.comision_pct ?? 0;
  const medioNombre = medio?.nombre ?? "";
  const totalConComision =
    comisionPct > 0 && comisionPct < 100
      ? Math.round(total / (1 - comisionPct / 100))
      : total;

  const pctMostrado =
    d.descuento_tipo === "Porcentaje"
      ? d.descuento_pct
      : baseProductos > 0
        ? Math.round((descuento / baseProductos) * 10000) / 100
        : 0;

  const pct2Mostrado =
    d.descuento2_tipo === "Porcentaje"
      ? d.descuento2_pct
      : baseFlete > 0
        ? Math.round((descuento2 / baseFlete) * 10000) / 100
        : 0;

  const pct3Mostrado =
    d.descuento3_tipo === "Porcentaje"
      ? d.descuento3_pct
      : baseInstalaciones > 0
        ? Math.round((descuento3 / baseInstalaciones) * 10000) / 100
        : 0;

  function set<K extends keyof DatosCotizacion>(k: K, v: DatosCotizacion[K]) {
    setD((x) => ({ ...x, [k]: v }));
  }

  // Un cliente de otro mercado trae otras condiciones: se conserva la forma y
  // el medio si existen en su pais; si no, se propone la forma por defecto de
  // ese pais y el medio queda por elegir.
  function elegirCliente(id: number | null) {
    const nuevo = listaClientes.find((c) => c.id === id) ?? null;
    const pais = nuevo?.id_pais ?? idPaisDoc;
    setD((x) => {
      const formaOk = p.formasPago.some(
        (f) => f.id === x.id_forma_pago && f.id_pais === pais
      );
      const medioOk = p.mediosPago.some(
        (m) => m.id === x.id_medio_pago && m.id_pais === pais
      );
      return {
        ...x,
        id_cliente: id,
        id_forma_pago: formaOk
          ? x.id_forma_pago
          : (p.formasPago.find((f) => f.id_pais === pais && f.por_defecto)?.id ?? null),
        id_medio_pago: medioOk ? x.id_medio_pago : null,
      };
    });
  }

  function agregarItem() {
    setError(null);
    const idProd = Number(prodSel);
    const unid = Number(cantidad);
    if (!idProd || !unid || unid <= 0) {
      setError("Elija un producto e indique las unidades.");
      return;
    }
    const prod = catalogo.find((x) => x.id === idProd);
    if (!prod) return;
    // Valor unitario editable: para flete y mano de obra el precio se pacta en
    // cada cotizacion; si se deja vacio se usa el del catalogo.
    const valor = valorUnit.trim() ? Number(valorUnit) : prod.precio_venta;
    if (!valor && !prod.precio_manual) {
      setError(
        `"${prod.descripcion}" no tiene precio de venta. Cargueselo en el catalogo o escriba el valor unitario.`
      );
      return;
    }
    const item: ItemBorrador = {
      id_producto: prod.id,
      descripcion: prod.descripcion,
      unidades: unid,
      valor_unitario: valor,
      costo_unitario: 0,
    };
    setD((x) => ({ ...x, items: [...x.items, item] }));
    setProdSel("");
    setCantidad("1");
    setValorUnit("");
  }

  function quitarItem(i: number) {
    setD((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }));
  }

  function guardar() {
    setError(null);
    setAviso(null);

    const faltan: string[] = [];
    if (d.id_cliente == null) faltan.push("Cliente");
    if (d.id_forma_pago == null) faltan.push("Forma de pago");
    if (d.id_medio_pago == null) faltan.push("Medio de pago");
    if (faltan.length > 0) {
      setError(
        faltan.length === 1
          ? `Falta ${faltan[0]}.`
          : `Faltan: ${faltan.join(", ")}.`
      );
      return;
    }

    const payload: DatosCotizacion = {
      ...d,
      descuento_monto: descuento,
      descuento_pct: pctMostrado,
      descuento2_monto: descuento2,
      descuento2_pct: pct2Mostrado,
      descuento3_monto: descuento3,
      descuento3_pct: pct3Mostrado,
    };
    empezar(async () => {
      const r =
        p.modo === "crear"
          ? await crearCotizacion(payload)
          : await actualizarCotizacion(p.id as number, payload);
      if (r?.error) setError(r.error);
      else {
        setAviso("Cambios grabados.");
        setEditable(false);
      }
    });
  }

  // Empezar otra cotizacion sin salir de la pantalla. Si hay algo escrito se
  // pide confirmar: limpiar no se puede deshacer y perder una cotizacion a
  // medio armar es caro.
  const [confirmarNueva, setConfirmarNueva] = useState(false);
  const hayAlgoEscrito =
    d.items.length > 0 || d.id_cliente != null || d.notas.trim() !== "";

  function nuevaCotizacion() {
    if (p.modo !== "crear") {
      // Sobre una cotizacion ya grabada no se limpia el formulario: se abre
      // una nueva, que es lo que se espera.
      router.push("/cotizaciones/nueva");
      return;
    }
    setD({ ...p.inicial, fecha: hoyISO(), items: [] });
    setProdSel("");
    setCantidad("1");
    setValorUnit("");
    setProductosExtra([]);
    setClientesExtra([]);
    setError(null);
    setAviso(null);
    setConfirmarNueva(false);
  }

  const inputCls =
    "border border-gray-300 rounded px-2 py-1 text-sm w-full disabled:bg-gray-100 disabled:text-gray-500";

  return (
    <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
      {/* barra de estado y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-gray-200 rounded p-3">
        <div className="text-sm">
          <span className="text-gray-500">N de cotizacion:</span>{" "}
          <span className="font-bold text-verde">
            {p.numCotizacion ?? "(sin folio hasta grabar)"}
          </span>
          {p.estado && (
            <span className="ml-3 text-gray-500">
              Estado:{" "}
              {p.id ? (
                <SelectorEstado id={p.id} estado={p.estado} puedeEditar={p.puedeEditar} />
              ) : (
                <span className="font-semibold">{p.estado}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {p.modo !== "crear" && soloLectura && p.puedeEditar && (
            <button
              onClick={() => setEditable(true)}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Modificar
            </button>
          )}
          {!soloLectura && (
            <button
              onClick={guardar}
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Grabando..." : "GRABAR"}
            </button>
          )}
          {confirmarNueva ? (
            <>
              <button
                onClick={nuevaCotizacion}
                className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
              >
                Si, empezar de nuevo
              </button>
              <button
                onClick={() => setConfirmarNueva(false)}
                className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (p.modo === "crear" && hayAlgoEscrito) setConfirmarNueva(true);
                else nuevaCotizacion();
              }}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
              title="Deja la pantalla en blanco para cotizar de nuevo"
            >
              Nueva cotizacion
            </button>
          )}
          {p.id && p.puedeEditar && (
            <BotonDuplicar tipo="cotizacion" id={p.id} />
          )}
          {p.id && (
            <Link
              href={`/cotizaciones/${p.id}/pdf`}
              target="_blank"
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Ver PDF
            </Link>
          )}
        </div>
      </div>

      <BarraNavegacion volverA="/cotizaciones" />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {aviso && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
          {aviso}
        </div>
      )}

      {/* cabecera */}
      <div className="bg-white border border-gray-200 rounded p-3 grid md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
        <label className="text-xs md:col-span-3 lg:col-span-2">
          <span className="flex items-center justify-between mb-0.5">
            <span className="text-dorado-osc font-semibold">Cliente *</span>
            {!soloLectura && p.puedeCrearPanel && (
              <button
                type="button"
                onClick={() => setModalCliente(true)}
                className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded"
                title="Crear un cliente sin salir de esta cotizacion"
              >
                + Nuevo cliente
              </button>
            )}
          </span>
          <select
            className={inputCls}
            disabled={soloLectura}
            value={d.id_cliente ?? ""}
            onChange={(e) => elegirCliente(Number(e.target.value) || null)}
          >
            <option value="">-- elija --</option>
            {listaClientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razon_social}
                {c.rut ? ` (${c.rut})` : ""}
              </option>
            ))}
          </select>
          <DatosDelCliente
            cliente={clienteElegido}
            etiqueta={
              p.paises.find((x) => x.id === clienteElegido?.id_pais)?.etiqueta_id ?? "RUT"
            }
          />
          {clienteElegido && p.puedeEditar && (
            <button
              type="button"
              onClick={() => setFichaCliente(true)}
              className="mt-1 text-[11px] text-verde underline"
              title="Completar o corregir los datos del cliente sin salir de aqui"
            >
              Editar datos del cliente
            </button>
          )}
        </label>

        <label className="text-xs md:col-span-2">
          <span className="block text-dorado-osc font-semibold mb-0.5">
            Forma de pago *
          </span>
          <select
            className={inputCls}
            disabled={soloLectura}
            value={d.id_forma_pago ?? ""}
            onChange={(e) => set("id_forma_pago", Number(e.target.value) || null)}
          >
            <option value="">-- elija --</option>
            {formasDelPais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.descripcion}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-dorado-osc font-semibold mb-0.5">
            Medio de pago *
          </span>
          <select
            className={inputCls}
            disabled={soloLectura}
            value={d.id_medio_pago ?? ""}
            onChange={(e) => set("id_medio_pago", Number(e.target.value) || null)}
          >
            <option value="">-- elija --</option>
            {mediosDelPais.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
                {m.comision_pct > 0
                  ? `  (comision ${porcentaje(m.comision_pct)} %)`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-dorado-osc font-semibold mb-0.5">Fecha</span>
          <input
            type="date"
            className={inputCls}
            disabled={soloLectura}
            value={d.fecha}
            onChange={(e) => set("fecha", e.target.value)}
          />
        </label>

        <label className="text-xs">
          <span className="block text-dorado-osc font-semibold mb-0.5">
            Validez (dias)
          </span>
          <input
            type="number"
            className={inputCls}
            disabled={soloLectura}
            value={d.validez_dias}
            onChange={(e) => set("validez_dias", Number(e.target.value) || 0)}
          />
          <span className="text-[11px] text-gray-500">
            Vence el {fmtFecha(sumarDias(d.fecha, d.validez_dias))}
          </span>
        </label>

        <label className="text-xs">
          <span className="block text-dorado-osc font-semibold mb-0.5">
            Tiempo de entrega
          </span>
          <input
            className={inputCls}
            disabled={soloLectura}
            value={d.tiempo_entrega}
            onChange={(e) => set("tiempo_entrega", e.target.value)}
          />
        </label>

        <label className="text-xs md:col-span-2">
          <span className="block text-dorado-osc font-semibold mb-0.5">Despachar a</span>
          <input
            className={inputCls}
            disabled={soloLectura}
            value={d.direccion_despacho}
            onChange={(e) => set("direccion_despacho", e.target.value)}
          />
        </label>
      </div>

      {/* agregar item */}
      {!soloLectura && (
        <div className="bg-crema border border-dorado rounded p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-verde">Agregar producto</div>
            {p.puedeCrearPanel && (
              <button
                onClick={() => setModalPanel(true)}
                className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                title="Crear un panel que no esta en el catalogo sin salir de esta cotizacion"
              >
                + Panel nuevo
              </button>
            )}
          </div>
          <div className="grid md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <BuscadorProducto
              productos={catalogo}
              valor={prodSel ? Number(prodSel) : null}
              onElegir={(pr) => {
                setProdSel(pr ? String(pr.id) : "");
                if (pr) setValorUnit(String(pr.precio_venta));
              }}
              className={inputCls}
            />
            <label className="text-xs">
              <span className="block text-dorado-osc font-semibold">Cantidad</span>
              <input
                type="number"
                className={`${inputCls} w-24`}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </label>
            <label className="text-xs">
              <span className="block text-dorado-osc font-semibold">
                Valor unitario neto
              </span>
              <input
                type="number"
                className={`${inputCls} w-32`}
                value={valorUnit}
                onChange={(e) => setValorUnit(e.target.value)}
              />
            </label>
            <button
              onClick={agregarItem}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded"
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* items */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
          ITEMS DE LA COTIZACION
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 w-10">N</th>
                <th className="text-left px-3 py-2">Descripcion</th>
                <th className="text-right px-3 py-2 w-24">Unid.</th>
                <th className="text-right px-3 py-2 w-32">V. unit. neto</th>
                <th className="text-right px-3 py-2 w-32">Subtotal</th>
                {!soloLectura && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {d.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-6">
                    Sin items todavia.
                  </td>
                </tr>
              )}
              {d.items.map((it, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2">{it.descripcion}</td>
                  <td className="px-3 py-2 text-right">{fmtUnid(it.unidades)}</td>
                  <td className="px-3 py-2 text-right">{pesos(it.valor_unitario)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {pesos(it.unidades * it.valor_unitario)}
                  </td>
                  {!soloLectura && (
                    <td className="px-2 text-right">
                      <button
                        onClick={() => quitarItem(i)}
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

      {/* totales */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <div className="max-w-md ml-auto space-y-1 text-sm">
          <Fila label="SUBTOTAL" valor={pesos(subtotal)} />

          {(
            [
              {
                rotulo: ROTULO_DESCUENTO_1,
                base: baseProductos,
                monto: descuento,
                pct: d.descuento_tipo === "Porcentaje" ? d.descuento_pct : pctMostrado,
                sobre: "los productos",
                porPct: (v: number) =>
                  ({ descuento_tipo: "Porcentaje" as TipoDescuento, descuento_pct: v }),
                porMonto: (v: number) =>
                  ({ descuento_tipo: "Monto" as TipoDescuento, descuento_monto: v }),
              },
              {
                rotulo: ROTULO_DESCUENTO_2,
                base: baseFlete,
                monto: descuento2,
                pct: d.descuento2_tipo === "Porcentaje" ? d.descuento2_pct : pct2Mostrado,
                sobre: "el flete",
                porPct: (v: number) =>
                  ({ descuento2_tipo: "Porcentaje" as TipoDescuento, descuento2_pct: v }),
                porMonto: (v: number) =>
                  ({ descuento2_tipo: "Monto" as TipoDescuento, descuento2_monto: v }),
              },
              {
                rotulo: ROTULO_DESCUENTO_3,
                base: baseInstalaciones,
                monto: descuento3,
                pct: d.descuento3_tipo === "Porcentaje" ? d.descuento3_pct : pct3Mostrado,
                sobre: "las instalaciones",
                porPct: (v: number) =>
                  ({ descuento3_tipo: "Porcentaje" as TipoDescuento, descuento3_pct: v }),
                porMonto: (v: number) =>
                  ({ descuento3_tipo: "Monto" as TipoDescuento, descuento3_monto: v }),
              },
            ] as const
          ).map((f) => (
            <div key={f.rotulo} className="flex items-center justify-end gap-2">
              <span className="text-gray-700 mr-auto">
                {f.rotulo}
                <span className="block text-[11px] text-gray-400">
                  sobre {f.sobre}: {pesos(f.base)}
                </span>
              </span>
              <input
                type="number"
                className="border border-gray-300 rounded px-2 py-1 text-right w-24 disabled:bg-gray-100"
                disabled={soloLectura}
                value={f.pct}
                onChange={(e) =>
                  setD((x) => ({ ...x, ...f.porPct(Number(e.target.value) || 0) }))
                }
                title={`Descuento en % sobre ${f.sobre}`}
              />
              <span className="text-gray-500">%</span>
              <input
                type="text"
                inputMode="numeric"
                className="border border-gray-300 rounded px-2 py-1 text-right w-32 disabled:bg-gray-100"
                disabled={soloLectura}
                value={pesos(f.monto)}
                onChange={(e) =>
                  setD((x) => ({
                    ...x,
                    ...f.porMonto(Number(e.target.value.replace(/\D/g, "")) || 0),
                  }))
                }
                title={`Descuento en pesos sobre ${f.sobre}`}
              />
            </div>
          ))}
          <p className="text-xs text-gray-500 text-right">
            Escriba el % o el monto: el otro se recalcula solo. Cada descuento
            va sobre su propia base y en 0 no aparece en el PDF.
          </p>

          <Fila label="TOTAL NETO" valor={pesos(totalNeto)} fuerte />
          <Fila
            label={`${nombreImpuesto} ${Math.round(tasaIva * 100)}%`}
            valor={pesos(iva)}
          />
          <div className="flex justify-between bg-verde text-white px-3 py-2 rounded font-bold">
            <span>TOTAL</span>
            <span>{pesos(total)}</span>
          </div>

          {p.verMargen && (
            <div className="mt-2 border-t border-gray-200 pt-2 space-y-0.5">
              <Fila label="Costo de lo cotizado" valor={pesos(costoTotal)} />
              <div className="flex justify-between px-3 py-1.5 rounded bg-crema text-dorado-osc font-bold">
                <span>
                  MARGEN {porcentaje(margenPct)} %
                  {itemsSinCosto > 0 && (
                    <span className="ml-2 font-normal text-[11px] text-amber-700">
                      ({itemsSinCosto} linea{itemsSinCosto > 1 ? "s" : ""} sin costo
                      cargado)
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
                label={`Recargo ${porcentaje(comisionPct)} % por ${medioNombre}`}
                valor={pesos(totalConComision - total)}
              />
              <div className="flex justify-between bg-dorado-osc text-white px-3 py-2 rounded font-bold">
                <span>TOTAL A PAGAR</span>
                <span>{pesos(totalConComision)}</span>
              </div>
              <p className="text-xs text-gray-500 text-right">
                El total se divide por (1 &minus; comision) para que el neto
                llegue completo.
              </p>
            </>
          )}
        </div>
      </div>

      {/* notas */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <label className="text-sm block">
          <span className="block text-dorado-osc font-semibold mb-1">Notas internas</span>
          <textarea
            className={inputCls}
            rows={2}
            disabled={soloLectura}
            value={d.notas}
            onChange={(e) => set("notas", e.target.value)}
          />
        </label>
      </div>

      {fichaCliente && clienteElegido && (
        <VentanaCliente
          cliente={clienteElegido as unknown as FichaCliente}
          etiquetaId={
            p.paises.find((x) => x.id === clienteElegido.id_pais)?.etiqueta_id ?? "RUT"
          }
          prefijo={
            p.paises.find((x) => x.id === clienteElegido.id_pais)?.prefijo_telefono ?? "+56"
          }
          onCerrar={() => setFichaCliente(false)}
        />
      )}

      {modalPanel && (
        <ModalNuevoPanel
          idPais={clienteElegido?.id_pais ?? null}
          materias={p.materias}
          iva={tasaIva}
          onCerrar={() => setModalPanel(false)}
          onCreado={(prod) => {
            // Queda disponible en la lista y ya seleccionado con su precio, de
            // modo que solo falta indicar las unidades y pulsar Agregar.
            setProductosExtra((x) => [...x, prod]);
            setProdSel(String(prod.id));
            setValorUnit(String(prod.precio_venta));
            setModalPanel(false);
            setAviso(`Panel "${prod.descripcion}" listo para agregar.`);
          }}
        />
      )}

      {modalCliente && (
        <ModalNuevoCliente
          paises={p.paises}
          eligePais={p.esAdminGeneral}
          onCerrar={() => setModalCliente(false)}
          onCreado={(cli) => {
            setClientesExtra((x) => [...x, cli]);
            elegirCliente(cli.id);
            setModalCliente(false);
            setAviso(`Cliente "${cli.razon_social}" creado y seleccionado.`);
          }}
        />
      )}
    </div>
  );
}

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

// Razon social, RUT y contacto del cliente elegido. Se muestran aqui para no
// tener que salir a la ficha a confirmar a quien se le esta cotizando, y son
// los mismos datos que salen impresos en la cotizacion.
//
// La razon social siempre esta --es obligatoria en el cliente--; el RUT puede
// faltar, y se dice, porque hay clientes que se cotizan antes de tenerlo.
function DatosDelCliente({
  cliente,
  etiqueta,
}: {
  cliente: Cliente | null;
  // RUT en Chile, RUC en Peru.
  etiqueta: string;
}) {
  if (!cliente) return null;
  const rut = cliente.rut?.trim();
  return (
    <span className="block mt-1 text-[11px] leading-tight text-gray-600">
      <span className="font-semibold text-gray-800">{cliente.razon_social}</span>
      {rut ? (
        <span> {"·"} {etiqueta} {rut}</span>
      ) : (
        <span className="text-gray-400"> {"·"} sin {etiqueta}</span>
      )}
      {cliente.contacto ? <span> {"·"} {cliente.contacto}</span> : null}
      {cliente.telefono ? <span> {"·"} {cliente.telefono}</span> : null}
    </span>
  );
}
