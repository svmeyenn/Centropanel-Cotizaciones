"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "@/lib/formato";
import {
  asociarAnticipo,
  quitarAnticipo,
  type Resultado,
} from "@/app/rendiciones/acciones";
import { fechaCorta, type AnticipoAplicado } from "@/lib/finanzas/tipos";

export type AnticipoDisponible = {
  id_mov: number;
  fecha: string | null;
  monto: number;
  comentario: string | null;
  disponible: number;
};

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

// La plata que se le adelanto a la persona y que esta rendicion viene a
// descontar. Un anticipo grande puede rendirse en dos veces, asi que se aplica
// por monto y no entero.
export default function PanelAnticipos({
  idRendicion,
  asociados,
  disponibles,
  editable,
}: {
  idRendicion: number;
  asociados: AnticipoAplicado[];
  disponibles: AnticipoDisponible[];
  editable: boolean;
}) {
  const router = useRouter();
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState("");
  const [elegido, setElegido] = useState("");
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    asociarAnticipo,
    null
  );

  useEffect(() => {
    if (estado?.ok) {
      setElegido("");
      router.refresh();
    }
  }, [estado, router]);

  const detalle = (idMov: number) =>
    disponibles.find((d) => d.id_mov === idMov) ?? null;

  const anticipo = disponibles.find((d) => String(d.id_mov) === elegido);

  function quitar(idMov: number) {
    comenzar(async () => {
      const r = await quitarAnticipo(idRendicion, idMov);
      setAviso(r.mensaje ?? "");
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
        Anticipos aplicados
      </h2>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-verde text-white">
            <tr>
              <th className="text-left px-3 py-2 w-28">Fecha</th>
              <th className="text-left px-3 py-2">Concepto</th>
              <th className="text-right px-3 py-2 w-32">Entregado</th>
              <th className="text-right px-3 py-2 w-32">Aplicado</th>
              {editable && <th className="px-3 py-2 w-20" />}
            </tr>
          </thead>
          <tbody>
            {asociados.length === 0 && (
              <tr>
                <td
                  colSpan={editable ? 5 : 4}
                  className="text-center text-gray-400 py-6"
                >
                  Sin anticipos: lo rendido se paga completo.
                </td>
              </tr>
            )}

            {asociados.map((a) => {
              const d = detalle(a.id_mov);
              return (
                <tr key={a.id_mov} className="border-t border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {d?.fecha ? fechaCorta(d.fecha) : ""}
                  </td>
                  <td className="px-3 py-2 text-gray-600 truncate">
                    {d?.comentario ?? `Anticipo ${a.id_mov}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {d ? pesos(d.monto) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {pesos(a.monto_aplicado)}
                  </td>
                  {editable && (
                    <td className="px-3 py-2 text-right">
                      <button
                        className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white"
                        onClick={() => quitar(a.id_mov)}
                        disabled={enCurso}
                      >
                        Quitar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editable && disponibles.length > 0 && (
        <form
          action={enviar}
          className="bg-white border border-gray-200 rounded p-3 grid gap-3 sm:grid-cols-4 items-end"
        >
          <input type="hidden" name="id_rendicion" value={idRendicion} />

          <div className="sm:col-span-2">
            <label className={ROTULO}>Anticipo por aplicar</label>
            <select
              name="id_mov"
              className={CAMPO}
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              required
            >
              <option value="">Elija el anticipo</option>
              {disponibles.map((d) => (
                <option key={d.id_mov} value={d.id_mov}>
                  {d.fecha ? fechaCorta(d.fecha) : "sin fecha"} - quedan{" "}
                  {pesos(d.disponible)}
                  {d.comentario ? ` - ${d.comentario}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={ROTULO}>Monto a aplicar</label>
            <input
              name="monto_aplicado"
              className={CAMPO}
              inputMode="numeric"
              defaultValue={anticipo ? String(anticipo.disponible) : ""}
              key={elegido}
              required
            />
          </div>

          <button
            type="submit"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
            disabled={pendiente}
          >
            {pendiente ? "Aplicando..." : "Aplicar"}
          </button>

          {((estado && !estado.ok) || aviso) && (
            <p
              className={`sm:col-span-4 text-xs rounded px-3 py-2 border ${
                estado && !estado.ok
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-crema border-gray-200 text-gray-700"
              }`}
            >
              {estado && !estado.ok ? estado.mensaje : aviso}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
