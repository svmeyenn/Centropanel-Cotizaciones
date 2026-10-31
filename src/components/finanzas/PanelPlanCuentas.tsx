"use client";

import { useState, useTransition } from "react";
import { guardarCuenta, mapearCategoria } from "@/app/plan-cuentas/acciones";

interface Cuenta {
  codigo: string;
  nombre: string;
  clase: number;
  estado: string;
  naturaleza: string;
  uso: string | null;
  activa: boolean;
}
interface Concepto {
  codigo: string;
  actividad: string;
  nombre: string;
  uso: string | null;
}
interface Categoria {
  id_categoria: number;
  id_pais: number;
  nombre: string;
  tipo: string;
  codigo_cuenta: string | null;
  concepto_flujo: string | null;
}

const CLASES: Record<number, string> = {
  1: "1 · Activo",
  2: "2 · Pasivo",
  3: "3 · Patrimonio",
  4: "4 · Ingresos",
  5: "5 · Costo de venta",
  6: "6 · Gastos y resultado financiero",
};

const campo = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";

export default function PanelPlanCuentas({
  plan,
  conceptos,
  categorias,
  paises,
  puedeEditar,
}: {
  plan: Cuenta[];
  conceptos: Concepto[];
  categorias: Categoria[];
  paises: { id: number; nombre: string }[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [uso, setUso] = useState("");
  const [activa, setActiva] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const sinMapear = categorias.filter((c) => !c.codigo_cuenta || !c.concepto_flujo).length;
  const pais = (id: number) => paises.find((p) => p.id === id)?.nombre ?? "";

  function abrir(c: Cuenta) {
    setEditando(c.codigo);
    setNombre(c.nombre);
    setUso(c.uso ?? "");
    setActiva(c.activa);
    setError(null);
    setAviso(null);
  }

  function guardar(c: Cuenta) {
    setError(null);
    empezar(async () => {
      const r = await guardarCuenta(c.codigo, nombre, uso, activa);
      if (r?.error) setError(r.error);
      else {
        setAviso(`Cuenta ${c.codigo} guardada.`);
        setEditando(null);
      }
    });
  }

  function mapear(c: Categoria, cuenta: string, flujo: string) {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await mapearCategoria(c.id_categoria, cuenta, flujo);
      if (r?.error) setError(r.error);
      else setAviso(`Categoría «${c.nombre}» actualizada.`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-crema border border-dorado text-dorado-osc text-sm rounded p-3">
        Un solo plan de cuentas para Chile y Perú, con IFRS para PYMES. Mercado, unidad de negocio y
        centro de costo no son cuentas distintas: van como dimensiones de cada movimiento. Cada
        categoría de ingreso o egreso apunta a una cuenta del plan y a un concepto del flujo de
        efectivo; con eso sale el estado de flujos sin clasificar a mano.
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}
      {aviso && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
          {aviso}
        </div>
      )}

      <section className="space-y-2" aria-labelledby="t-mapeo">
        <h2 id="t-mapeo" className="text-sm font-semibold text-verde">
          Categorías: cuenta y concepto de flujo
          {sinMapear > 0 && (
            <span className="ml-2 text-xs font-normal text-dorado-osc">
              {sinMapear} sin completar
            </span>
          )}
        </h2>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2">Categoría</th>
                  <th scope="col" className="text-left px-3 py-2">Tipo</th>
                  {paises.length > 1 && <th scope="col" className="text-left px-3 py-2">Mercado</th>}
                  <th scope="col" className="text-left px-3 py-2 w-80">Cuenta del plan</th>
                  <th scope="col" className="text-left px-3 py-2 w-80">Concepto de flujo</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id_categoria} className="border-t border-gray-100 hover:bg-crema">
                    <th scope="row" className="text-left px-3 py-1.5 font-semibold">{c.nombre}</th>
                    <td className="px-3 py-1.5">{c.tipo}</td>
                    {paises.length > 1 && <td className="px-3 py-1.5 text-gray-600">{pais(c.id_pais)}</td>}
                    <td className="px-3 py-1.5">
                      <select
                        aria-label={`Cuenta de ${c.nombre}`}
                        className={`${campo} w-full`}
                        disabled={!puedeEditar || pendiente}
                        value={c.codigo_cuenta ?? ""}
                        onChange={(e) => mapear(c, e.target.value, c.concepto_flujo ?? "")}
                      >
                        <option value="">Sin cuenta</option>
                        {plan
                          .filter((p) => p.activa || p.codigo === c.codigo_cuenta)
                          .map((p) => (
                            <option key={p.codigo} value={p.codigo}>
                              {p.codigo} · {p.nombre}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        aria-label={`Concepto de flujo de ${c.nombre}`}
                        className={`${campo} w-full`}
                        disabled={!puedeEditar || pendiente}
                        value={c.concepto_flujo ?? ""}
                        onChange={(e) => mapear(c, c.codigo_cuenta ?? "", e.target.value)}
                      >
                        <option value="">Sin concepto</option>
                        {conceptos.map((f) => (
                          <option key={f.codigo} value={f.codigo}>
                            {f.codigo} · {f.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="t-plan">
        <h2 id="t-plan" className="text-sm font-semibold text-verde">Cuentas</h2>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-verde text-white">
                <tr>
                  <th scope="col" className="text-left px-3 py-2 w-24">Código</th>
                  <th scope="col" className="text-left px-3 py-2">Cuenta</th>
                  <th scope="col" className="text-left px-3 py-2">Qué entra</th>
                  <th scope="col" className="text-left px-3 py-2 w-28">Estado</th>
                  <th scope="col" className="text-left px-3 py-2 w-24">Naturaleza</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {plan.map((c, i) => (
                  <PlanFila
                    key={c.codigo}
                    cuenta={c}
                    nuevaClase={i === 0 || plan[i - 1].clase !== c.clase}
                    editando={editando === c.codigo}
                    puedeEditar={puedeEditar}
                    pendiente={pendiente}
                    nombre={nombre}
                    uso={uso}
                    activa={activa}
                    setNombre={setNombre}
                    setUso={setUso}
                    setActiva={setActiva}
                    onAbrir={() => abrir(c)}
                    onCerrar={() => setEditando(null)}
                    onGuardar={() => guardar(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="t-flujo">
        <h2 id="t-flujo" className="text-sm font-semibold text-verde">Conceptos del flujo de efectivo (NIC 7)</h2>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-3 py-2 w-24">Código</th>
                <th scope="col" className="text-left px-3 py-2 w-40">Actividad</th>
                <th scope="col" className="text-left px-3 py-2">Concepto</th>
                <th scope="col" className="text-left px-3 py-2">Se alimenta de</th>
              </tr>
            </thead>
            <tbody>
              {conceptos.map((f) => (
                <tr key={f.codigo} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 font-semibold">{f.codigo}</td>
                  <td className="px-3 py-1.5">{f.actividad}</td>
                  <td className="px-3 py-1.5">{f.nombre}</td>
                  <td className="px-3 py-1.5 text-gray-600">{f.uso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlanFila(props: {
  cuenta: Cuenta;
  nuevaClase: boolean;
  editando: boolean;
  puedeEditar: boolean;
  pendiente: boolean;
  nombre: string;
  uso: string;
  activa: boolean;
  setNombre: (v: string) => void;
  setUso: (v: string) => void;
  setActiva: (v: boolean) => void;
  onAbrir: () => void;
  onCerrar: () => void;
  onGuardar: () => void;
}) {
  const { cuenta: c, editando } = props;
  return (
    <>
      {props.nuevaClase && (
        <tr className="border-t border-gray-200 bg-gray-50">
          <th scope="rowgroup" colSpan={6} className="text-left px-3 py-1.5 text-verde font-semibold">
            {CLASES[c.clase]}
          </th>
        </tr>
      )}
      <tr className={`border-t border-gray-100 hover:bg-crema ${c.activa ? "" : "text-gray-400"}`}>
        <td className="px-3 py-1.5 font-semibold tabular-nums">{c.codigo}</td>
        {editando ? (
          <>
            <td className="px-3 py-1.5">
              <input
                aria-label={`Nombre de la cuenta ${c.codigo}`}
                className={`${campo} w-full`}
                value={props.nombre}
                onChange={(e) => props.setNombre(e.target.value)}
              />
            </td>
            <td className="px-3 py-1.5">
              <input
                aria-label={`Uso de la cuenta ${c.codigo}`}
                className={`${campo} w-full`}
                value={props.uso}
                onChange={(e) => props.setUso(e.target.value)}
              />
            </td>
            <td className="px-3 py-1.5">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={props.activa}
                  onChange={(e) => props.setActiva(e.target.checked)}
                />
                Activa
              </label>
            </td>
          </>
        ) : (
          <>
            <td className="px-3 py-1.5">{c.nombre}</td>
            <td className="px-3 py-1.5 text-gray-600">{c.uso}</td>
            <td className="px-3 py-1.5">{c.estado === "Situacion" ? "Situación" : "Resultados"}{c.activa ? "" : " · inactiva"}</td>
          </>
        )}
        <td className="px-3 py-1.5">{c.naturaleza}</td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap">
          {props.puedeEditar &&
            (editando ? (
              <>
                <button
                  onClick={props.onGuardar}
                  disabled={props.pendiente}
                  className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded mr-1 disabled:opacity-50"
                >
                  grabar
                </button>
                <button onClick={props.onCerrar} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
                  cancelar
                </button>
              </>
            ) : (
              <button onClick={props.onAbrir} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
                editar
              </button>
            ))}
        </td>
      </tr>
    </>
  );
}
