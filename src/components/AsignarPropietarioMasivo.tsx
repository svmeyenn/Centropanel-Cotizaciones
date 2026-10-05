"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asignarPropietarioMasivo, cambiarEstadoMasivo } from "@/app/leads/asignacion-masiva";
import { etiquetaDe, ofrecidos } from "@/lib/catalogoEstados";
import { useCatalogoEstados } from "@/components/ProveedorEstados";
import type { FiltroLeads } from "@/lib/filtrosLeads";

const SIN_PROPIETARIO = "__sin__";
const CASILLAS = "input[data-sel-lead]";

// Cambio de propietario de varios leads a la vez. Las casillas de la tabla las
// dibuja el servidor; aqui solo se leen. Antes de cambiar nada se pide confirmar,
// con cuantos leads son y a quien pasan.
export default function AsignarPropietarioMasivo({
  propietarios,
  total,
  filtro,
}: {
  propietarios: { email: string; nombre: string }[];
  total: number;
  filtro: FiltroLeads;
}) {
  const router = useRouter();
  const { lead: estadosLead } = useCatalogoEstados();
  const [marcados, setMarcados] = useState(0);
  const [todos, setTodos] = useState(false);
  const [elegido, setElegido] = useState("");
  // Que se cambia: el propietario o el estado. Los dos funcionan igual --sobre
  // lo marcado o sobre todo el filtro-- y los dos piden confirmar.
  const [que, setQue] = useState<"propietario" | "estado">("propietario");
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, comenzar] = useTransition();

  useEffect(() => {
    function alCambiar(e: Event) {
      const t = e.target as HTMLInputElement | null;
      if (!t || t.tagName !== "INPUT") return;
      if (t.hasAttribute("data-sel-todos")) {
        document.querySelectorAll<HTMLInputElement>(CASILLAS).forEach((c) => (c.checked = t.checked));
      } else if (!t.hasAttribute("data-sel-lead")) return;
      setMarcados(document.querySelectorAll<HTMLInputElement>(`${CASILLAS}:checked`).length);
      setConfirmando(false);
    }
    document.addEventListener("change", alCambiar);
    return () => document.removeEventListener("change", alCambiar);
  }, []);

  const cantidad = todos ? total : marcados;
  const nombreElegido =
    que === "estado"
      ? etiquetaDe(estadosLead, elegido)
      : elegido === SIN_PROPIETARIO
        ? "sin propietario"
        : (propietarios.find((p) => p.email === elegido)?.nombre ?? "");

  function limpiarMarcas() {
    document
      .querySelectorAll<HTMLInputElement>("input[data-sel-lead], input[data-sel-todos]")
      .forEach((c) => (c.checked = false));
    setMarcados(0);
  }

  function confirmar() {
    setAviso(null);
    const ids = [...document.querySelectorAll<HTMLInputElement>(`${CASILLAS}:checked`)].map((c) =>
      Number(c.value)
    );
    comenzar(async () => {
      const alcance = todos ? { filtro } : { ids };
      const r =
        que === "estado"
          ? await cambiarEstadoMasivo(alcance, elegido)
          : await asignarPropietarioMasivo(alcance, elegido === SIN_PROPIETARIO ? "" : elegido);
      setConfirmando(false);
      setAviso({ ok: r.ok, texto: r.mensaje ?? (r.ok ? "Listo." : "No se pudo.") });
      if (r.ok) {
        limpiarMarcas();
        setTodos(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded px-3 py-2 text-[11px] space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="font-semibold text-dorado-osc uppercase tracking-wide text-[10px]">
          Cambiar
          <select
            aria-label="Que se cambia"
            value={que}
            onChange={(e) => {
              setQue(e.target.value as "propietario" | "estado");
              setElegido("");
              setConfirmando(false);
            }}
            className="ml-1 border border-gray-300 rounded px-1 py-0.5 font-normal normal-case text-[11px] text-negro"
          >
            <option value="propietario">el propietario</option>
            <option value="estado">el estado</option>
          </select>
        </label>
        <span className="text-gray-600">
          {marcados > 0
            ? `${marcados} marcados en esta pagina`
            : "Marque leads en la tabla, o cambie todos los del filtro"}
        </span>
        <label className="inline-flex items-center gap-1 text-gray-700">
          <input
            type="checkbox"
            checked={todos}
            onChange={(e) => {
              setTodos(e.target.checked);
              setConfirmando(false);
            }}
          />
          Todos los {total.toLocaleString("es-CL")} que coinciden con el filtro
        </label>
        <select
          aria-label={que === "estado" ? "Nuevo estado" : "Nuevo propietario"}
          value={elegido}
          onChange={(e) => {
            setElegido(e.target.value);
            setConfirmando(false);
          }}
          className="border border-gray-300 rounded px-2 py-1"
        >
          <option value="">{que === "estado" ? "Nuevo estado..." : "Nuevo propietario..."}</option>
          {que === "estado"
            ? ofrecidos(estadosLead).map((e) => (
                <option key={e.codigo} value={e.codigo}>
                  {e.etiqueta}
                </option>
              ))
            : [
                ...propietarios.map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.nombre}
                  </option>
                )),
                <option key="__sin__" value={SIN_PROPIETARIO}>
                  Sin propietario
                </option>,
              ]}
        </select>
        <button
          type="button"
          disabled={!elegido || cantidad === 0 || pendiente}
          onClick={() => setConfirmando(true)}
          className="bg-verde text-white font-semibold px-3 py-1 rounded disabled:opacity-40"
        >
          Asignar
        </button>
      </div>

      {confirmando && (
        <div
          className="flex flex-wrap items-center gap-2 bg-crema border border-dorado rounded px-2 py-1.5"
          role="alert"
        >
          <span>
            Va a cambiar {que === "estado" ? "el estado" : "el propietario"} de{" "}
            <strong>{cantidad.toLocaleString("es-CL")}</strong> leads a <strong>{nombreElegido}</strong>.
            Cada uno queda anotado en su historial.
          </span>
          <button
            type="button"
            onClick={confirmar}
            disabled={pendiente}
            className="bg-verde text-white font-semibold px-3 py-1 rounded disabled:opacity-50"
          >
            {pendiente ? "Cambiando..." : "Confirmar el cambio"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={pendiente}
            className="text-gray-600 underline"
          >
            Cancelar
          </button>
        </div>
      )}
      {aviso && (
        <p className={aviso.ok ? "text-verde" : "text-red-600"} role="status">
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
