"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "@/lib/formato";
import {
  agruparPorMes,
  etiquetaInterlocutor,
  fechaCorta,
  type Categoria,
  type Cuenta,
  type Interlocutor,
  type Movimiento,
  type Proyecto,
} from "@/lib/finanzas/tipos";
import FormularioIngreso from "./FormularioIngreso";
import DialogoConfirmarIngreso from "./DialogoConfirmarIngreso";

// El texto que agrega el banco a cada transferencia no aporta nada aqui: el
// nombre de la contraparte ya se lee solo.
const soloOrigen = (s: string | null) =>
  (s ?? "").replace(/Transferencia recibida de /gi, "");

export default function TablaIngresos({
  movimientos,
  cuentas,
  proyectos,
  categorias,
  interlocutores,
  puedeEditar,
  hayFiltro,
}: {
  movimientos: Movimiento[];
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  categorias: Categoria[];
  interlocutores: Interlocutor[];
  puedeEditar: boolean;
  hayFiltro: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<Movimiento | null>(null);
  const [creando, setCreando] = useState(false);
  const [confirmando, setConfirmando] = useState<Movimiento | null>(null);
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

  // Se compone desde interlocutores en vez de leer el texto copiado en
  // origen_destino, para que renombrar a alguien se vea de inmediato en todo su
  // historial. El texto copiado queda de respaldo.
  const etiquetaContraparte = (m: Movimiento) => {
    const i = interlocutores.find(
      (x) => x.id_interlocutor === m.id_interlocutor
    );
    return i
      ? etiquetaInterlocutor(i.razon_social, i.nombre_referencia)
      : soloOrigen(m.origen_destino);
  };

  const total = movimientos.reduce((t, m) => t + Number(m.monto), 0);
  const proyectados = movimientos.filter((m) => m.estado_pago === "Pendiente");
  const recibidos = movimientos.filter((m) => m.estado_pago === "Pagado");
  const totalProyectado = proyectados.reduce((t, m) => t + Number(m.monto), 0);
  const grupos = agruparPorMes(recibidos);
  const columnas = 7 + (puedeEditar ? 1 : 0);

  const fila = (m: Movimiento) => (
    <tr key={m.id_mov} className="group border-t border-gray-100 hover:bg-crema">
      <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(m.fecha)}</td>
      <td className="px-3 py-2 truncate" title={etiquetaContraparte(m)}>
        {etiquetaContraparte(m)}
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
      {puedeEditar && (
        // Anclada a la derecha, igual que en egresos: con la tabla ancha, la
        // columna con la que se trabaja no puede quedar fuera de la pantalla.
        <td className="px-3 py-2 whitespace-nowrap sticky right-0 bg-white group-hover:bg-crema border-l border-gray-100">
          <div className="flex gap-1.5 justify-end">
            {m.estado_pago === "Pendiente" && (
              <button
                className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded"
                onClick={() => setConfirmando(m)}
              >
                Confirmar
              </button>
            )}
            <button
              className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white"
              onClick={() => setEditando(m)}
            >
              Editar
            </button>
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
            Proyectado:{" "}
            <strong className="text-negro tabular-nums">
              {pesos(totalProyectado)}
            </strong>
          </span>
        </div>
        {puedeEditar && (
          <button
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            onClick={() => setCreando(true)}
          >
            Nuevo ingreso
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
                <th className="text-left px-3 py-2 w-[12%]">Fecha</th>
                <th className="text-left px-3 py-2 w-[22%]">Origen</th>
                <th className="text-right px-3 py-2 w-[12%]">Monto</th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[11%]">
                  Cuenta
                </th>
                <th className="text-left px-3 py-2 hidden md:table-cell w-[15%]">
                  Proyecto / Cliente
                </th>
                <th className="text-left px-3 py-2 hidden lg:table-cell w-[12%]">
                  Categoria
                </th>
                <th className="text-left px-3 py-2 hidden xl:table-cell w-[14%]">
                  Comentario
                </th>
                {puedeEditar && (
                  <th className="px-3 py-2 w-[12%] min-w-[7.5rem] sticky right-0 bg-verde" />
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
                      ? "Ningun ingreso coincide con el filtro."
                      : "Todavia no hay ingresos."}
                  </td>
                </tr>
              )}

              {proyectados.length > 0 && (
                <>
                  {cabeceraGrupo(
                    "__proyectados",
                    "Proyectados",
                    totalProyectado,
                    "dorado"
                  )}
                  {!colapsados.has("__proyectados") && proyectados.map(fila)}
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
        <FormularioIngreso
          movimiento={editando}
          cuentas={cuentas}
          proyectos={proyectos}
          categorias={categorias}
          interlocutores={interlocutores}
          alCerrar={(mensaje) => {
            setCreando(false);
            setEditando(null);
            if (mensaje) setAviso(mensaje);
            router.refresh();
          }}
        />
      )}

      {confirmando && (
        <DialogoConfirmarIngreso
          movimiento={confirmando}
          alCerrar={(mensaje) => {
            setConfirmando(null);
            if (mensaje) setAviso(mensaje);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
