"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cambiarEstadoMasivo } from "@/app/leads/asignacion-masiva";
import { guardarDiasCaducidad } from "@/app/leads/depuracion";
import { estadoLegible } from "@/lib/leads";
import { enlaceDeRegla, filtroDeRegla, textoRegla, type ReglaCaducidad } from "@/lib/caducidad";

export interface GrupoCaduco extends ReglaCaducidad {
  n: number;
}

// Depuracion de la cartera: cada regla dice cuantos leads quedaron atras y
// ofrece pasarlos en bloque al estado que corresponde. El plazo de cada regla se
// edita aqui mismo y se guarda como parametro del mercado, para que la proxima
// vez ya venga puesto.
export default function DepurarLeads({
  grupos,
  puedeEditar,
  puedeGuardarPlazos,
  mercado,
}: {
  grupos: GrupoCaduco[];
  puedeEditar: boolean;
  // El plazo es un parametro del mercado: lo cambia quien administra.
  puedeGuardarPlazos: boolean;
  mercado: string;
}) {
  const router = useRouter();
  const [dias, setDias] = useState<Record<string, number>>(
    Object.fromEntries(grupos.map((g) => [g.clave, g.dias]))
  );
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, comenzar] = useTransition();

  const cambiado = (g: GrupoCaduco) => dias[g.clave] !== g.dias;

  function aplicar(g: GrupoCaduco) {
    setAviso(null);
    comenzar(async () => {
      const r = await cambiarEstadoMasivo(
        { filtro: filtroDeRegla(g, dias[g.clave]) },
        g.destino
      );
      setConfirmando(null);
      setAviso({ ok: r.ok, texto: r.mensaje ?? (r.ok ? "Listo." : "No se pudo.") });
      if (r.ok) router.refresh();
    });
  }

  function guardarPlazo(g: GrupoCaduco) {
    setAviso(null);
    comenzar(async () => {
      const r = await guardarDiasCaducidad(g.clave, dias[g.clave]);
      setAviso({ ok: r.ok, texto: r.mensaje ?? (r.ok ? "Plazo guardado." : "No se pudo.") });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {aviso && (
        <p
          className={`text-[11px] ${aviso.ok ? "text-verde" : "text-red-600"}`}
          role="status"
        >
          {aviso.texto}
        </p>
      )}

      {grupos.map((g) => {
        const d = dias[g.clave];
        return (
          <section key={g.clave} className="bg-white border border-gray-200 rounded overflow-hidden">
            <h2 className="bg-verde text-white text-[11px] font-semibold px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 uppercase">
              <span>{g.titulo}</span>
              <span className="font-normal normal-case">
                estado actual: {estadoLegible(g.estado)}
              </span>
            </h2>

            <div className="p-3 space-y-2 text-[11px]">
              <p className="text-gray-600">{textoRegla(g.explicacion, d)}</p>

              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <label className="flex items-center gap-1.5">
                  <span className="text-gray-700">
                    {g.campo === "creado" ? "Dias desde que entro" : "Dias sin actividad"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={3650}
                    value={d}
                    onChange={(e) =>
                      setDias((x) => ({ ...x, [g.clave]: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    className="border border-gray-300 rounded px-2 py-0.5 w-20 text-right tabular-nums"
                  />
                </label>

                {cambiado(g) ? (
                  <span className="flex items-center gap-2">
                    <Link
                      href={enlaceDeRegla(g, d)}
                      className="text-verde underline font-semibold"
                    >
                      Ver con este plazo →
                    </Link>
                    {puedeGuardarPlazos && (
                      <button
                        type="button"
                        onClick={() => guardarPlazo(g)}
                        disabled={pendiente}
                        className="border border-gray-300 rounded px-2 py-0.5 disabled:opacity-50"
                      >
                        Guardar {d} dias para {mercado}
                      </button>
                    )}
                  </span>
                ) : (
                  <>
                    <span className="tabular-nums">
                      <b className={g.n > 0 ? "text-dorado-osc text-sm" : "text-gray-500 text-sm"}>
                        {g.n.toLocaleString("es-CL")}
                      </b>{" "}
                      leads
                    </span>
                    <Link href={enlaceDeRegla(g, d)} className="text-verde underline">
                      Verlos en la lista →
                    </Link>
                  </>
                )}
              </div>

              {!cambiado(g) && g.n > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-gray-700">
                    Propuesta: <b>{g.propuesta}</b>
                  </span>
                  {puedeEditar && g.destino && confirmando !== g.clave && (
                    <button
                      type="button"
                      onClick={() => setConfirmando(g.clave)}
                      className="bg-verde text-white font-semibold px-2.5 py-0.5 rounded"
                    >
                      Aplicar a los {g.n.toLocaleString("es-CL")}
                    </button>
                  )}
                  {!g.destino && (
                    <span className="text-gray-500">
                      Sin cambio en bloque: son los de mas valor y conviene mirarlos uno a uno.
                    </span>
                  )}
                </div>
              )}

              {confirmando === g.clave && (
                <div
                  className="flex flex-wrap items-center gap-2 bg-crema border border-dorado rounded px-2 py-1.5"
                  role="alert"
                >
                  <span>
                    Va a pasar <b>{g.n.toLocaleString("es-CL")}</b> leads a{" "}
                    <b>{estadoLegible(g.destino)}</b>. Cada uno queda anotado en su historial y una
                    importacion del CRM no lo deshace. Acuerdese de hacer el mismo cambio en
                    Clientify.
                  </span>
                  <button
                    type="button"
                    onClick={() => aplicar(g)}
                    disabled={pendiente}
                    className="bg-verde text-white font-semibold px-3 py-0.5 rounded disabled:opacity-50"
                  >
                    {pendiente ? "Cambiando..." : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    disabled={pendiente}
                    className="text-gray-600 underline"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
