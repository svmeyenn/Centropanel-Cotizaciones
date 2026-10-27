"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buscarItemsCompra, crearNecesidad, type ItemBuscado } from "@/app/necesidades/acciones";
import VentanaNuevaMateria from "@/components/VentanaNuevaMateria";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";

type Linea = { clave: string; item: ItemBuscado; cantidad: string; partida: number | ""; };

// Una necesidad nueva: para una obra o para un pedido, con las materias primas y los productos que hacen falta.
// Los items se buscan por nombre o SKU. Al guardarla nace con su primera solicitud de cotizacion.
export default function NuevaNecesidad({
  proyectoInicial,
  proyectos,
  partidas,
  pedidos,
  puedeCrearMateria,
}: {
  proyectoInicial: number | null;
  proyectos: { id: number; nombre: string; id_pais: number; direccion: string }[];
  partidas: { id: number; id_proyecto: number; nombre: string }[];
  pedidos: { id: number; num: string; id_pais: number }[];
  // Quien compra puede dar de alta una materia prima que todavia no esta en la maestra.
  puedeCrearMateria: boolean;
}) {
  const router = useRouter();
  const [origen, setOrigen] = useState<"obra" | "pedido">("obra");
  const [proyecto, setProyecto] = useState<number | "">(proyectoInicial ?? "");
  const [pedido, setPedido] = useState<number | "">("");
  const [fecha, setFecha] = useState("");
  const [direccion, setDireccion] = useState("");
  // Se propone la direccion de la obra; quien crea puede cambiarla.
  const [direccionTocada, setDireccionTocada] = useState(false);
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<ItemBuscado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [buscando, empezarBusca] = useTransition();
  const [creandoMateria, setCreandoMateria] = useState(false);
  const ultima = useRef(0);

  const pais = origen === "obra" ? proyectos.find((p) => p.id === proyecto)?.id_pais : pedidos.find((p) => p.id === pedido)?.id_pais;
  const direccionObra = origen === "obra" ? proyectos.find((p) => p.id === proyecto)?.direccion ?? "" : "";
  useEffect(() => {
    if (!direccionTocada) setDireccion(direccionObra);
  }, [direccionObra, direccionTocada]);
  const partidasDe = useMemo(() => (origen === "obra" ? partidas.filter((x) => x.id_proyecto === proyecto) : []), [partidas, proyecto, origen]);

  // Busca al escribir, con una pequena espera para no pedir una busqueda por tecla.
  useEffect(() => {
    if (!pais || busca.trim().length < 2) {
      setEncontrados([]);
      return;
    }
    const n = ++ultima.current;
    const t = setTimeout(() => {
      empezarBusca(async () => {
        const r = await buscarItemsCompra(busca, pais);
        if (n === ultima.current) setEncontrados(r);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [busca, pais]);

  function agregar(it: ItemBuscado) {
    const clave = `${it.tipo}-${it.id}`;
    if (lineas.some((l) => l.clave === clave)) return;
    setLineas([...lineas, { clave, item: it, cantidad: "1", partida: "" }]);
    setBusca("");
    setEncontrados([]);
  }

  function guardar() {
    setError(null);
    if (origen === "obra" && !proyecto) return setError("Elija la obra.");
    if (origen === "pedido" && !pedido) return setError("Elija el pedido.");
    if (lineas.length === 0) return setError("Agregue al menos un item.");
    const items = lineas.map((l) => ({
      id_materia_prima: l.item.tipo === "materia_prima" ? l.item.id : null,
      id_producto: l.item.tipo === "producto" ? l.item.id : null,
      cantidad: Number(l.cantidad.replace(",", ".")),
      id_partida: l.partida || null,
    }));
    if (items.some((i) => !(i.cantidad > 0))) return setError("Cada item necesita una cantidad mayor que cero.");
    empezar(async () => {
      const r = await crearNecesidad({
        id_proyecto: origen === "obra" ? Number(proyecto) : null,
        id_pedido: origen === "pedido" ? Number(pedido) : null,
        fecha,
        direccion,
        notas,
        items,
      });
      if (!r.ok) setError(r.error ?? "No se pudo crear.");
      else if (r.id) router.push(`/necesidades/${r.id}`);
    });
  }

  return (
    <div className="space-y-3 max-w-5xl">
      <div className="bg-white border border-gray-200 rounded p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className={ROTULO}>Para</span>
          <div className="flex gap-3 text-xs pt-1">
            {(["obra", "pedido"] as const).map((o) => (
              <label key={o} className="inline-flex items-center gap-1.5">
                <input type="radio" name="origen" checked={origen === o} onChange={() => { setOrigen(o); setLineas([]); }} />
                {o === "obra" ? "Una obra" : "Un pedido"}
              </label>
            ))}
          </div>
        </div>
        {origen === "obra" ? (
          <div>
            <label htmlFor="nm-obra" className={ROTULO}>Obra</label>
            <select id="nm-obra" className={CAMPO} value={proyecto} onChange={(e) => { setProyecto(Number(e.target.value) || ""); setLineas([]); }}>
              <option value="">-- elija --</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="nm-pedido" className={ROTULO}>Pedido</label>
            <select id="nm-pedido" className={CAMPO} value={pedido} onChange={(e) => { setPedido(Number(e.target.value) || ""); setLineas([]); }}>
              <option value="">-- elija --</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>{p.num}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="nm-fecha" className={ROTULO}>Fecha de entrega en destino</label>
          <input id="nm-fecha" type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="nm-dir" className={ROTULO}>Direccion de destino</label>
          <input
            id="nm-dir"
            className={CAMPO}
            value={direccion}
            onChange={(e) => { setDireccion(e.target.value); setDireccionTocada(true); }}
            maxLength={300}
            placeholder={origen === "pedido" ? "Si queda vacia, se usa la del pedido o la de su obra" : "Donde se entrega el material"}
          />
        </div>
        <div>
          <label htmlFor="nm-notas" className={ROTULO}>Notas</label>
          <input id="nm-notas" className={CAMPO} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={300} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-3 space-y-2">
        <div className="relative">
          <label htmlFor="nm-busca" className={ROTULO}>Agregar materia prima o producto</label>
          <input
            id="nm-busca"
            className={CAMPO}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={pais ? "Escriba el nombre o el SKU (minimo 2 letras)" : "Primero elija la obra o el pedido"}
            disabled={!pais}
            autoComplete="off"
          />
          {pais && busca.trim().length >= 2 && (encontrados.length > 0 || buscando || puedeCrearMateria) && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow max-h-64 overflow-y-auto text-xs">
              {buscando && encontrados.length === 0 && <li className="px-2 py-1.5 text-gray-500">Buscando...</li>}
              {encontrados.map((it) => (
                <li key={`${it.tipo}-${it.id}`}>
                  <button type="button" onClick={() => agregar(it)} className="w-full text-left px-2 py-1.5 hover:bg-crema flex items-center gap-2">
                    <span className={`shrink-0 text-[9px] font-semibold border rounded px-1 ${it.tipo === "producto" ? "text-dorado-osc border-dorado-osc" : "text-verde border-verde"}`}>
                      {it.tipo === "producto" ? "Producto" : "Materia prima"}
                    </span>
                    <span className="flex-1">{it.descripcion}</span>
                    {it.sku && <span className="text-gray-500">{it.sku}</span>}
                  </button>
                </li>
              ))}
              {puedeCrearMateria && (
                <li className="border-t border-gray-200">
                  <button type="button" onClick={() => setCreandoMateria(true)} className="w-full text-left px-2 py-1.5 text-verde font-semibold hover:bg-crema">
                    No esta? Crear la materia prima &laquo;{busca.trim()}&raquo;
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        {creandoMateria && pais && (
          <VentanaNuevaMateria
            idPais={pais}
            nombreInicial={busca.trim()}
            alCerrar={() => setCreandoMateria(false)}
            alCrear={(item) => {
              setCreandoMateria(false);
              agregar(item);
            }}
          />
        )}

        {lineas.length === 0 ? (
          <p className="text-xs text-gray-500 py-3 text-center">Todavia no hay items.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-2 py-1.5">Item</th>
                <th className="text-right px-2 py-1.5 w-28">Cantidad</th>
                {partidasDe.length > 0 && <th className="text-left px-2 py-1.5 w-56">Partida</th>}
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={l.clave} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">
                    {l.item.descripcion}
                    <span className="ml-1.5 text-[10px] text-gray-500">{l.item.tipo === "producto" ? "producto" : "materia prima"}{l.item.unidad ? ` · ${l.item.unidad}` : ""}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Cantidad de ${l.item.descripcion}`}
                      inputMode="decimal"
                      className={`${CAMPO} text-right`}
                      value={l.cantidad}
                      onChange={(e) => setLineas(lineas.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))}
                    />
                  </td>
                  {partidasDe.length > 0 && (
                    <td className="px-2 py-1.5">
                      <select
                        aria-label={`Partida de ${l.item.descripcion}`}
                        className={CAMPO}
                        value={l.partida}
                        onChange={(e) => setLineas(lineas.map((x, j) => (j === i ? { ...x, partida: Number(e.target.value) || "" } : x)))}
                      >
                        <option value="">-- sin partida --</option>
                        {partidasDe.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-right">
                    <button type="button" className="text-red-700 underline text-[11px]" onClick={() => setLineas(lineas.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {error && <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={pendiente} onClick={guardar} className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded disabled:opacity-50">
          {pendiente ? "Creando..." : "Crear necesidad"}
        </button>
        <button type="button" onClick={() => router.push("/necesidades")} className="border border-gray-300 bg-white text-xs font-semibold px-3 py-1.5 rounded">
          Cancelar
        </button>
      </div>
    </div>
  );
}
