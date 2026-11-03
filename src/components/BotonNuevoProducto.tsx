"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pesos, porcentaje, conIva } from "@/lib/formato";
import type { Pais } from "@/types/database";
import {
  buscarMateriasReventa,
  crearProductoReventa,
  crearProductoServicio,
  type DatosProductoNuevo,
  type MateriaReventa,
} from "@/app/productos/acciones";

const vacio = (pais: number | null): DatosProductoNuevo => ({
  descripcion: "",
  familia: "",
  subfamilia: "",
  precio_venta: 0,
  costo_unitario: null,
  id_pais: pais,
});

// Alta de productos que no son paneles: fletes, mano de obra, servicios. Va en
// ventana emergente y no en la propia tabla para poder ofrecerse desde la barra
// de navegacion, al lado de "Configurar panel", que es la otra forma de sumar
// algo al catalogo.
export default function BotonNuevoProducto({
  ivaPorPais,
  familias,
  subfamilias,
  paises,
}: {
  ivaPorPais: Record<number, number>;
  familias: string[];
  subfamilias: string[];
  paises: Pais[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  // Quien trabaja un solo mercado no elige: su pais viene puesto.
  const paisPorDefecto = paises.length === 1 ? paises[0].id : null;
  const [form, setForm] = useState<DatosProductoNuevo>(vacio(paisPorDefecto));
  const iva = ivaPorPais[form.id_pais ?? 0] ?? 0;
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  // "servicio": fletes, mano de obra, servicios. "reventa": una materia prima que tambien se vende tal cual.
  const [modo, setModo] = useState<"servicio" | "reventa">("servicio");
  const [busca, setBusca] = useState("");
  const [encontradas, setEncontradas] = useState<MateriaReventa[]>([]);
  const [materia, setMateria] = useState<MateriaReventa | null>(null);
  const [rev, setRev] = useState({ familia: "", subfamilia: "", precio: "" });

  useEffect(() => {
    if (modo !== "reventa" || materia || busca.trim().length < 2) {
      setEncontradas([]);
      return;
    }
    let vigente = true;
    const t = setTimeout(() => {
      buscarMateriasReventa(busca, form.id_pais).then((r) => vigente && setEncontradas(r));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [busca, materia, modo, form.id_pais]);

  function guardarReventa() {
    setError(null);
    if (!materia) return setError("Elija la materia prima.");
    const precio = rev.precio.trim() === "" ? null : Number(rev.precio.replace(/\D/g, ""));
    empezar(async () => {
      const r = await crearProductoReventa({ id_materia_prima: materia.id, familia: rev.familia, subfamilia: rev.subfamilia, precio_venta: precio });
      if (r?.error) {
        setError(r.error);
        return;
      }
      setAbierto(false);
      setMateria(null);
      setBusca("");
      setRev({ familia: "", subfamilia: "", precio: "" });
      router.refresh();
    });
  }

  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [abierto]);

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await crearProductoServicio(form);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setAbierto(false);
      setForm(vacio(paisPorDefecto));
      router.refresh();
    });
  }

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setForm(vacio(paisPorDefecto));
          setAbierto(true);
        }}
        className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
        title="Fletes, mano de obra, servicios y materias primas para reventa. Los paneles se crean en el configurador."
      >
        Nuevo producto
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setAbierto(false)}
        >
          <div
            className="bg-white rounded shadow-lg w-full max-w-xl mt-10 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-verde text-white px-4 py-2.5 rounded-t flex items-center justify-between">
              <span className="text-sm font-semibold">Nuevo producto</span>
              <button
                onClick={() => setAbierto(false)}
                className="text-white/80 hover:text-white text-lg leading-none"
                title="Cerrar (Esc)"
              >
                ×
              </button>
            </div>

            <div className="px-4 pt-3 flex gap-2 text-xs">
              {([["servicio", "Servicio o flete"], ["reventa", "Reventa de materia prima"]] as const).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setModo(k);
                    setError(null);
                  }}
                  className={`px-2.5 py-1 rounded font-semibold border ${modo === k ? "bg-verde text-white border-verde" : "bg-white text-gray-700 border-gray-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {modo === "reventa" ? (
              <div className="p-4 space-y-3 text-sm">
                <p className="text-xs text-gray-500">
                  Vende una materia prima tal cual. Su costo sigue siempre al de la materia prima y, mientras el precio no sea manual, el precio sigue al
                  costo con el margen objetivo.
                </p>
                <label className="block">
                  <span className="block text-dorado-osc font-semibold mb-1">Mercado *</span>
                  <select
                    className={input}
                    value={form.id_pais ?? ""}
                    disabled={paises.length === 1}
                    onChange={(e) => {
                      setForm({ ...form, id_pais: Number(e.target.value) || null });
                      setMateria(null);
                    }}
                  >
                    {paises.length !== 1 && <option value="">-- elija --</option>}
                    {paises.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <label htmlFor="reventa-materia" className="block text-dorado-osc font-semibold mb-1">Materia prima</label>
                  {materia ? (
                    <div className="flex items-center gap-2 border border-gray-300 rounded px-2 py-1 bg-gray-50">
                      <span className="flex-1">
                        {materia.sku && <span className="text-gray-500 mr-1">{materia.sku}</span>}
                        {materia.nombre}
                        <span className="text-gray-500"> · costo {pesos(materia.costo)}</span>
                      </span>
                      <button type="button" aria-label="Quitar materia prima" className="text-gray-500 hover:text-red-700" onClick={() => setMateria(null)}>
                        &times;
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        id="reventa-materia"
                        className={input}
                        autoComplete="off"
                        placeholder={form.id_pais == null ? "Elija primero el mercado" : "Buscar por nombre o SKU"}
                        disabled={form.id_pais == null}
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                      />
                      {busca.trim().length >= 2 && (
                        <ul className="mt-1 max-h-56 overflow-auto bg-white border border-gray-300 rounded shadow">
                          {encontradas.length === 0 && <li className="px-2 py-1.5 text-gray-500">Sin resultados.</li>}
                          {encontradas.map((m) => (
                            <li key={m.id}>
                              <button
                                type="button"
                                disabled={m.yaEsProducto}
                                className="w-full text-left px-2 py-1.5 hover:bg-crema disabled:opacity-50 disabled:hover:bg-white"
                                onClick={() => {
                                  setMateria(m);
                                  setBusca("");
                                }}
                              >
                                {m.sku && <span className="text-gray-500 mr-1">{m.sku}</span>}
                                {m.nombre}
                                <span className="text-gray-500"> · costo {pesos(m.costo)}</span>
                                {m.yaEsProducto && <span className="text-amber-700"> · ya se vende como producto</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <label>
                    <span className="block text-dorado-osc font-semibold mb-1">Familia</span>
                    <input className={input} list="familias-producto" placeholder="En blanco queda como Reventa" value={rev.familia} onChange={(e) => setRev({ ...rev, familia: e.target.value })} />
                    <datalist id="familias-producto">
                      {familias.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    <span className="block text-dorado-osc font-semibold mb-1">Subfamilia (opcional)</span>
                    <input className={input} list="subfamilias-producto" value={rev.subfamilia} onChange={(e) => setRev({ ...rev, subfamilia: e.target.value })} />
                    <datalist id="subfamilias-producto">
                      {subfamilias.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <label className="block">
                  <span className="block text-dorado-osc font-semibold mb-1">Precio de venta neto (opcional)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={input}
                    placeholder="Vacio = costo con el margen objetivo"
                    value={rev.precio}
                    onChange={(e) => setRev({ ...rev, precio: e.target.value.replace(/\D/g, "") })}
                  />
                  <span className="text-xs text-gray-500">
                    {rev.precio
                      ? "Con precio escrito queda como precio manual: no se mueve cuando cambia el costo."
                      : "El precio se recalcula solo cuando cambia el costo."}
                  </span>
                </label>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">{error}</div>}
                <div className="flex gap-2 pt-1">
                  <button onClick={guardarReventa} disabled={pendiente || !materia} className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40">
                    {pendiente ? "Grabando..." : "Crear producto de reventa"}
                  </button>
                  <button onClick={() => setAbierto(false)} className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Para fletes, mano de obra y otros servicios. Un panel SIP se
                crea en el configurador, que arma su descripcion y su costo
                desde la composicion.
              </p>

              <label className="text-sm block">
                <span className="block text-dorado-osc font-semibold mb-1">
                  Descripcion
                </span>
                <input
                  className={input}
                  autoFocus
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                />
              </label>

              <label className="text-sm block">
                <span className="block text-dorado-osc font-semibold mb-1">
                  Mercado *
                </span>
                <select
                  className={input}
                  value={form.id_pais ?? ""}
                  disabled={paises.length === 1}
                  onChange={(e) =>
                    setForm({ ...form, id_pais: Number(e.target.value) || null })
                  }
                >
                  {paises.length !== 1 && <option value="">-- elija --</option>}
                  {paises.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Familia
                  </span>
                  <input
                    className={input}
                    list="familias-producto"
                    placeholder="Madera, Tornillos, Servicios..."
                    value={form.familia}
                    onChange={(e) =>
                      setForm({ ...form, familia: e.target.value })
                    }
                  />
                  <datalist id="familias-producto">
                    {familias.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <span className="text-xs text-gray-500">
                    En blanco queda como Servicios.
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Subfamilia (opcional)
                  </span>
                  <input
                    className={input}
                    list="subfamilias-producto"
                    placeholder="Pino Bruta, Amarillo #10[5.0]..."
                    value={form.subfamilia}
                    onChange={(e) =>
                      setForm({ ...form, subfamilia: e.target.value })
                    }
                  />
                  <datalist id="subfamilias-producto">
                    {subfamilias.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <span className="text-xs text-gray-500">
                    Segundo nivel dentro de la familia.
                  </span>
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Precio de venta neto
                  </span>
                  <input
                    type="number"
                    className={input}
                    value={form.precio_venta}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        precio_venta: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="text-xs text-gray-500">
                    PVP: {pesos(conIva(form.precio_venta, iva))}
                  </span>
                </label>
                <label className="text-sm">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Costo (opcional)
                  </span>
                  <input
                    type="number"
                    className={input}
                    value={form.costo_unitario ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        costo_unitario: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                  {form.precio_venta > 0 && form.costo_unitario != null && (
                    <span className="text-xs text-gray-500">
                      Margen resultante:{" "}
                      {porcentaje(
                        ((form.precio_venta - form.costo_unitario) /
                          form.precio_venta) *
                          100,
                      )}{" "}
                      %
                    </span>
                  )}
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={guardar}
                  disabled={pendiente || !form.descripcion.trim()}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                >
                  {pendiente ? "Grabando..." : "Crear producto"}
                </button>
                <button
                  onClick={() => setAbierto(false)}
                  className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
                >
                  Cancelar
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
