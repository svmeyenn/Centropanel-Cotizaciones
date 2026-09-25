"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "@/lib/formato";
import {
  agruparPorMes,
  etiquetaEstado,
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
}: {
  movimientos: Movimiento[];
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  categorias: Categoria[];
  interlocutores: Interlocutor[];
  puedeEditar: boolean;
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
    return p.cliente ? `${p.nombre} — ${p.cliente}` : p.nombre;
  };
  const nombreCategoria = (id: number | null) =>
    categorias.find((c) => c.id_categoria === id)?.nombre ?? "";

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
  // Excede a proposito el numero real de columnas: en un colSpan, un valor
  // mayor simplemente se recorta al ancho de la tabla, y asi la fila divisoria
  // cubre todo el ancho sin recalcular cuantas columnas oculta el responsive.
  const columnas = 12;

  const fila = (m: Movimiento) => (
    <tr key={m.id_mov}>
      <td className="whitespace-nowrap">{fechaCorta(m.fecha)}</td>
      <td className="truncate">{etiquetaContraparte(m)}</td>
      <td className="num">{pesos(m.monto)}</td>
      <td className="hidden md:table-cell">{nombreCuenta(m.id_cuenta)}</td>
      <td className="hidden md:table-cell">{nombreProyecto(m.id_proyecto)}</td>
      <td className="hidden md:table-cell">{nombreCategoria(m.id_categoria)}</td>
      <td>
        <span
          className={
            m.estado_pago === "Pagado"
              ? "text-verde font-semibold"
              : "text-dorado-oscuro font-semibold"
          }
        >
          {etiquetaEstado("Ingreso", m.estado_pago)}
        </span>
      </td>
      <td className="hidden md:table-cell max-w-xs truncate">{m.comentario}</td>
      {puedeEditar && (
        <td className="whitespace-nowrap">
          <div className="flex flex-col gap-1 items-start">
            <button
              className="btn btn-sec text-xs px-2 py-1"
              onClick={() => setEditando(m)}
            >
              Editar
            </button>
            {m.estado_pago === "Pendiente" && (
              <button
                className="btn text-xs px-2 py-1 whitespace-nowrap"
                onClick={() => setConfirmando(m)}
              >
                Confirmar
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex gap-4 text-sm">
          <span>
            <strong>{movimientos.length}</strong> movimientos
          </span>
          <span>
            Total: <strong className="tabular-nums">{pesos(total)}</strong>
          </span>
          <span>
            Proyectado:{" "}
            <strong className="tabular-nums">{pesos(totalProyectado)}</strong>
          </span>
        </div>
        {puedeEditar && (
          <button className="btn" onClick={() => setCreando(true)}>
            NUEVO INGRESO
          </button>
        )}
      </div>

      {aviso && (
        <p className="text-sm mb-3 px-3 py-2 bg-crema border border-gris-suave rounded">
          {aviso}
        </p>
      )}

      <div className="border border-gris-suave rounded-lg overflow-hidden">
        <table className="datos w-full table-fixed text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="w-[18%] sm:w-[12%]">Fecha</th>
              <th className="w-[30%] sm:w-[20%]">Origen</th>
              <th className="num w-[20%] sm:w-[13%]">Monto</th>
              <th className="hidden md:table-cell md:w-[13%]">Cuenta</th>
              <th className="hidden md:table-cell md:w-[15%]">
                Proyecto / Cliente
              </th>
              <th className="hidden md:table-cell md:w-[12%]">Categoria</th>
              <th className="w-[18%] sm:w-[10%]">Estado</th>
              <th className="hidden md:table-cell md:w-[15%]">Comentario</th>
              {puedeEditar && <th className="w-[14%] sm:w-[10%]"></th>}
            </tr>
          </thead>
          <tbody>
            {proyectados.length > 0 && (
              <>
                <tr>
                  <td colSpan={columnas} className="p-0 bg-dorado-oscuro/10">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 text-dorado-oscuro font-semibold text-xs uppercase tracking-wide py-1.5 px-3"
                      onClick={() => alternar("__proyectados")}
                    >
                      <span>
                        {colapsados.has("__proyectados") ? "▸" : "▾"} Proyectados
                      </span>
                    </button>
                  </td>
                </tr>
                {!colapsados.has("__proyectados") && proyectados.map(fila)}
              </>
            )}
            {grupos.map((g) => (
              <Fragment key={g.mes}>
                <tr>
                  <td colSpan={columnas} className="p-0 bg-verde/10">
                    <button
                      type="button"
                      className="w-full flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-verde font-semibold text-xs uppercase tracking-wide py-1.5 px-3"
                      onClick={() => alternar(g.mes)}
                    >
                      <span>
                        {colapsados.has(g.mes) ? "▸" : "▾"} {g.mes}
                      </span>
                      <span className="normal-case font-normal tabular-nums">
                        {pesos(
                          g.filas.reduce((t, m) => t + Number(m.monto), 0)
                        )}
                      </span>
                    </button>
                  </td>
                </tr>
                {!colapsados.has(g.mes) && g.filas.map(fila)}
              </Fragment>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={columnas} className="text-gris py-6 text-center">
                  No hay movimientos que cumplan el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
