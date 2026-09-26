"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "@/lib/formato";
import { guardarTope, quitarTope, type Resultado } from "@/app/topes/acciones";
import type { Categoria, PoliticaGasto } from "@/lib/finanzas/tipos";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

// Cuanto se puede gastar por boleta antes de que la rendicion quede marcada.
// Un tope por categoria, mas uno general para todo lo que no tenga el suyo.
export default function PanelTopes({
  politicas,
  categorias,
  puedeEditar,
}: {
  politicas: PoliticaGasto[];
  categorias: Categoria[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => {
      const r = await guardarTope(previo, datos);
      if (r.ok) router.refresh();
      return r;
    },
    null
  );
  const [aviso, setAviso] = useState("");

  const nombreCategoria = (id: number | null) =>
    id === null
      ? "Todas las categorias"
      : (categorias.find((c) => c.id_categoria === id)?.nombre ?? "");

  // Las de gasto: no tiene sentido ponerle tope a una boleta de venta.
  const deEgreso = categorias.filter((c) => c.tipo === "Egreso" && !c.borrado);
  const conTope = new Set(politicas.map((p) => p.id_categoria));

  async function quitar(id: number) {
    const r = await quitarTope(id);
    setAviso(r.mensaje ?? "");
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700">
        El tope no impide gastar: marca la boleta que lo supera para que quien
        aprueba la vea. Si ademas se marca <strong>bloquear</strong>, la boleta
        no se puede cargar por encima del tope.
      </p>

      {puedeEditar && (
        <form
          action={enviar}
          className="bg-white border border-gray-200 rounded p-3 grid gap-3 sm:grid-cols-4 items-end"
        >
          <div>
            <label className={ROTULO}>Categoria</label>
            <select name="id_categoria" className={CAMPO} defaultValue="">
              <option value="">Todas las categorias</option>
              {deEgreso.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nombre}
                  {conTope.has(c.id_categoria) ? " (ya tiene tope)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={ROTULO}>Tope por boleta</label>
            <input
              name="tope"
              className={CAMPO}
              inputMode="numeric"
              placeholder="50.000"
              required
            />
          </div>

          <label className="flex items-start gap-2 text-xs bg-crema border border-gray-200 rounded px-3 py-2">
            <input type="checkbox" name="bloquea" className="mt-0.5" />
            <span>
              Bloquear
              <span className="block text-[11px] text-gray-600">
                Impide cargar la boleta, no solo marcarla
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
              disabled={pendiente}
            >
              {pendiente ? "Guardando..." : "Guardar tope"}
            </button>
          </div>

          {estado?.mensaje && (
            <p
              className={`sm:col-span-4 text-xs rounded px-3 py-2 border ${
                estado.ok
                  ? "bg-crema border-gray-200 text-gray-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {estado.mensaje}
            </p>
          )}
        </form>
      )}

      {aviso && (
        <p className="bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700">
          {aviso}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th className="text-left px-3 py-2">Categoria</th>
              <th className="text-right px-3 py-2 w-32">Tope</th>
              <th className="text-left px-3 py-2 w-32">Sobre el tope</th>
              {puedeEditar && <th className="px-3 py-2 w-20" />}
            </tr>
          </thead>
          <tbody>
            {politicas.length === 0 && (
              <tr>
                <td
                  colSpan={puedeEditar ? 4 : 3}
                  className="text-center text-gray-400 py-8"
                >
                  Todavia no hay topes: cualquier gasto se rinde sin marca.
                </td>
              </tr>
            )}

            {politicas.map((p) => (
              <tr key={p.id_politica} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  {p.id_categoria === null ? (
                    <span className="font-semibold">Todas las categorias</span>
                  ) : (
                    nombreCategoria(p.id_categoria)
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {pesos(p.tope)}
                </td>
                <td className="px-3 py-2">
                  {p.bloquea ? (
                    <span className="text-red-700 font-semibold">No deja</span>
                  ) : (
                    <span className="text-dorado-osc">Solo marca</span>
                  )}
                </td>
                {puedeEditar && (
                  <td className="px-3 py-2 text-right">
                    <button
                      className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white"
                      onClick={() => quitar(p.id_politica)}
                    >
                      Quitar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
