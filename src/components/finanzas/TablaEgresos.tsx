"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "@/lib/formato";
import {
  agruparPorMes,
  etiquetaInterlocutor,
  fechaCorta,
  fechaDeRegistro,
  type Categoria,
  type Cuenta,
  type Interlocutor,
  type Movimiento,
  type Proyecto,
} from "@/lib/finanzas/tipos";
import FormularioEgreso from "./FormularioEgreso";
import DialogoPagar from "./DialogoPagar";

// El texto que agrega el banco a cada transferencia no aporta nada aqui: el
// nombre de la contraparte ya se lee solo.
const soloDestino = (s: string | null) =>
  (s ?? "").replace(/Transferencia enviada a /gi, "");

export default function TablaEgresos({
  movimientos,
  cuentas,
  proyectos,
  categorias,
  interlocutores,
  vendedores,
  puedeSolicitar,
  puedePagar,
  enlaces,
  hayFiltro,
}: {
  movimientos: Movimiento[];
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  categorias: Categoria[];
  interlocutores: Interlocutor[];
  vendedores: { id: number; nombre: string }[];
  puedeSolicitar: boolean;
  puedePagar: boolean;
  enlaces: Record<number, string>;
  hayFiltro: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<Movimiento | null>(null);
  const [creando, setCreando] = useState(false);
  const [pagando, setPagando] = useState<Movimiento | null>(null);
  const [aviso, setAviso] = useState("");
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  function alternar(mes: string) {
    setColapsados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(mes)) nuevo.delete(mes);
      else nuevo.add(mes);
      return nuevo;
    });
  }

  const nombreCuenta = (id: number | null) =>
    cuentas.find((c) => c.id_cuenta === id)?.alias ?? "";
  const nombreProyecto = (id: number | null) => {
    const p = proyectos.find((x) => x.id_proyecto === id);
    if (!p) return "";
    return p.cliente ? `${p.nombre} - ${p.cliente}` : p.nombre;
  };
  const nombreCategoria = (id: number | null) =>
    categorias.find((c) => c.id_categoria === id)?.etiqueta ?? "";
  const quienSolicito = (id: number | null) =>
    vendedores.find((x) => x.id === id)?.nombre ?? "";

  const etiquetaContraparte = (m: Movimiento) => {
    const i = interlocutores.find(
      (x) => x.id_interlocutor === m.id_interlocutor
    );
    return i
      ? etiquetaInterlocutor(i.razon_social, i.nombre_referencia)
      : soloDestino(m.origen_destino);
  };

  // Editar y borrar quedan reservados a quien paga: quien solo solicita puede
  // crear la solicitud, pero no tocarla despues.
  const puedeEditar = puedePagar;

  const total = movimientos.reduce((t, m) => t + Number(m.monto), 0);
  const pendientes = movimientos.filter((m) => m.estado_pago === "Pendiente");
  const pagados = movimientos.filter((m) => m.estado_pago === "Pagado");
  const totalPendiente = pendientes.reduce((t, m) => t + Number(m.monto), 0);
  const grupos = agruparPorMes(pagados);
  const columnas = 10 + (puedeEditar || puedePagar ? 1 : 0);

  const fila = (m: Movimiento) => (
    <tr key={m.id_mov} className="group border-t border-gray-100 hover:bg-crema">
      <td className="px-3 py-2 whitespace-nowrap">
        {m.fecha ? (
          fechaCorta(m.fecha)
        ) : (
          // Mientras no se paga, lo que importa es cuanto lleva esperando: la
          // fecha de pago no existe todavia, la de solicitud si.
          <>
            <span className="text-dorado-osc font-semibold">Pendiente</span>
            <span className="block text-[11px] text-gray-500">
              pedido el {fechaDeRegistro(m.fecha_registro)}
            </span>
          </>
        )}
      </td>
      <td className="px-3 py-2 truncate" title={etiquetaContraparte(m)}>
        {etiquetaContraparte(m)}
      </td>
      <td className="px-3 py-2 tabular-nums truncate" title={m.documento ?? ""}>
        {m.documento ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
        {pesos(m.monto)}
      </td>
      <td className="px-3 py-2 hidden md:table-cell text-gray-600 truncate">
        {nombreCuenta(m.id_cuenta)}
      </td>
      <td
        className="px-3 py-2 hidden md:table-cell text-gray-600 truncate"
        title={nombreProyecto(m.id_proyecto)}
      >
        {nombreProyecto(m.id_proyecto)}
      </td>
      <td className="px-3 py-2 hidden lg:table-cell text-gray-600 truncate">
        {nombreCategoria(m.id_categoria)}
      </td>
      <td
        className="px-3 py-2 hidden xl:table-cell text-gray-600 truncate"
        title={m.comentario ?? ""}
      >
        {m.comentario}
      </td>
      <td className="px-3 py-2 hidden md:table-cell">
        {enlaces[m.id_mov] ? (
          <a
            href={enlaces[m.id_mov]}
            target="_blank"
            rel="noreferrer"
            className="text-verde font-semibold underline"
          >
            Ver
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 hidden xl:table-cell text-gray-600 truncate">
        {quienSolicito(m.id_vendedor)}
      </td>
      {(puedeEditar || puedePagar) && (
        // Anclada a la derecha: es la columna con la que se trabaja, y con
        // diez columnas la tabla puede tener que desplazarse. Antes quedaba
        // fuera de la pantalla y el boton de pagar no se veia.
        <td className="px-3 py-2 whitespace-nowrap sticky right-0 bg-white group-hover:bg-crema border-l border-gray-100">
          <div className="flex gap-1.5 justify-end">
            {puedePagar && m.estado_pago === "Pendiente" && (
              <button
                className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded"
                onClick={() => setPagando(m)}
              >
                Pagar
              </button>
            )}
            {puedeEditar && (
              <button
                className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white"
                onClick={() => setEditando(m)}
              >
                Editar
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );

  const cabeceraGrupo = (
    clave: string,
    titulo: string,
    monto: number,
    tono: "verde" | "dorado"
  ) => (
    <tr>
      <td
        colSpan={columnas}
        className={`p-0 ${tono === "verde" ? "bg-crema" : "bg-dorado/15"}`}
      >
        <button
          type="button"
          className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${
            tono === "verde" ? "text-verde" : "text-dorado-osc"
          }`}
          onClick={() => alternar(clave)}
        >
          <span>
            {colapsados.has(clave) ? "▸" : "▾"} {titulo}
          </span>
          <span className="normal-case tabular-nums font-normal">
            {pesos(monto)}
          </span>
        </button>
      </td>
    </tr>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span>
            <strong className="text-negro">{movimientos.length}</strong>{" "}
            movimientos
          </span>
          <span>
            Total:{" "}
            <strong className="text-negro tabular-nums">{pesos(total)}</strong>
          </span>
          <span>
            Pendiente:{" "}
            <strong className="text-negro tabular-nums">
              {pesos(totalPendiente)}
            </strong>
          </span>
        </div>
        {puedeSolicitar && (
          <button
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            onClick={() => setCreando(true)}
          >
            Nueva solicitud
          </button>
        )}
      </div>

      {aviso && (
        <p className="bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700">
          {aviso}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2 w-[12%]">Fecha de pago</th>
                <th className="text-left px-3 py-2 w-[19%]">Destino</th>
                <th className="text-left px-3 py-2 w-[9%]">Documento</th>
                <th className="text-right px-3 py-2 w-[11%]">Monto</th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[9%]">
                  Cuenta
                </th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[14%]">
                  Proyecto / Cliente
                </th>
                <th className="text-left px-3 py-2 hidden lg:table-cell w-[11%]">
                  Categoria
                </th>
                <th className="text-left px-3 py-2 hidden xl:table-cell w-[12%]">
                  Comentario
                </th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[7%]">
                  Respaldo
                </th>
                <th className="text-left px-3 py-2 hidden xl:table-cell w-[10%]">
                  Solicito
                </th>
                {(puedeEditar || puedePagar) && (
                  <th className="px-3 py-2 w-[10%] min-w-[7.5rem] sticky right-0 bg-verde" />
                )}
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 && (
                <tr>
                  <td
                    colSpan={columnas}
                    className="text-center text-gray-400 py-8"
                  >
                    {hayFiltro
                      ? "Ningun egreso coincide con el filtro."
                      : "Todavia no hay egresos."}
                  </td>
                </tr>
              )}

              {pendientes.length > 0 && (
                <>
                  {cabeceraGrupo(
                    "__pendientes",
                    "Pendientes de pago",
                    totalPendiente,
                    "dorado"
                  )}
                  {!colapsados.has("__pendientes") && pendientes.map(fila)}
                </>
              )}

              {grupos.map((g) => (
                <Fragment key={g.mes}>
                  {cabeceraGrupo(
                    g.mes,
                    g.mes,
                    g.filas.reduce((t, m) => t + Number(m.monto), 0),
                    "verde"
                  )}
                  {!colapsados.has(g.mes) && g.filas.map(fila)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(creando || editando) && (
        <FormularioEgreso
          movimiento={editando}
          cuentas={cuentas}
          proyectos={proyectos}
          categorias={categorias}
          interlocutores={interlocutores}
          puedePagar={puedePagar}
          alCerrar={(mensaje) => {
            setCreando(false);
            setEditando(null);
            if (mensaje) setAviso(mensaje);
            router.refresh();
          }}
        />
      )}

      {pagando && (
        <DialogoPagar
          movimiento={pagando}
          alCerrar={(mensaje) => {
            setPagando(null);
            if (mensaje) setAviso(mensaje);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
