"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hoyISO, importe, leerMontoLibre, redondea } from "@/lib/formato";
import { guardarReglasCosto, type ReglaCosto } from "@/app/proveedores/acciones";

export type ItemCalculo = {
  id: number;
  sku: string | null;
  descripcion: string;
  familia: string;
  costo: number;
  moneda: string | null;
  activo: boolean;
  volumen: number | null;
};

export type ReglaGuardada = {
  alcance: "Proveedor" | "Familia" | "Item";
  familia: string | null;
  id_item: number | null;
  metodo: "m3" | "sku";
  valor_m3: number | null;
};

// "hereda": el nivel no tiene regla propia y manda el de arriba (item -> familia -> proveedor).
type Metodo = "hereda" | "sku" | "m3";
type Regla = { metodo: Metodo; valor: string };

const input = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";
const SIN: Regla = { metodo: "hereda", valor: "" };

function desde(r: ReglaGuardada | undefined, base: Regla): Regla {
  if (!r) return base;
  return { metodo: r.metodo, valor: r.valor_m3 ? String(r.valor_m3) : "" };
}

function Selector({
  id,
  regla,
  hereda,
  moneda,
  onChange,
  rotulo,
}: {
  id: string;
  regla: Regla;
  hereda: string | null;
  moneda: string;
  onChange: (r: Regla) => void;
  rotulo: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        id={id}
        aria-label={`Calculo del costo: ${rotulo}`}
        className={input}
        value={regla.metodo}
        onChange={(e) => onChange({ ...regla, metodo: e.target.value as Metodo })}
      >
        {hereda && <option value="hereda">{hereda}</option>}
        <option value="sku">Por SKU</option>
        <option value="m3">Por m³</option>
      </select>
      {regla.metodo === "m3" && (
        <label className="inline-flex items-center gap-1">
          <input
            id={`${id}-valor`}
            className={`${input} w-28 text-right tabular-nums ${leerMontoLibre(regla.valor) > 0 ? "" : "border-red-500 bg-red-50"}`}
            inputMode="decimal"
            value={regla.valor}
            placeholder="valor m³ neto"
            aria-label={`Valor neto del metro cubico, sin IVA: ${rotulo}`}
            title="Valor neto, sin IVA"
            onChange={(e) => onChange({ ...regla, valor: e.target.value })}
          />
          <span className="text-gray-500">{moneda}/m³ <strong className="font-semibold text-dorado-osc">neto (sin IVA)</strong></span>
        </label>
      )}
    </span>
  );
}

export default function CalculoCostoProveedor({
  idProveedor,
  monedaMercado,
  items,
  reglas,
}: {
  idProveedor: number;
  monedaMercado: string;
  items: ItemCalculo[];
  reglas: ReglaGuardada[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");

  const inicialProv = desde(reglas.find((r) => r.alcance === "Proveedor"), { metodo: "sku", valor: "" });
  const [prov, setProv] = useState<Regla>(inicialProv);
  const [fam, setFam] = useState<Record<string, Regla>>(() =>
    Object.fromEntries(reglas.filter((r) => r.alcance === "Familia" && r.familia).map((r) => [r.familia!, desde(r, SIN)]))
  );
  const [itm, setItm] = useState<Record<number, Regla>>(() =>
    Object.fromEntries(reglas.filter((r) => r.alcance === "Item" && r.id_item).map((r) => [r.id_item!, desde(r, SIN)]))
  );

  const familias = useMemo(() => {
    const m = new Map<string, ItemCalculo[]>();
    for (const it of items) m.set(it.familia, [...(m.get(it.familia) ?? []), it]);
    return [...m.entries()];
  }, [items]);

  // La regla que manda en cada item y el costo que le resulta.
  function efectiva(it: ItemCalculo): { regla: Regla; desde: "Item" | "Familia" | "Proveedor" } {
    const ri = itm[it.id];
    if (ri && ri.metodo !== "hereda") return { regla: ri, desde: "Item" };
    const rf = fam[it.familia];
    if (rf && rf.metodo !== "hereda") return { regla: rf, desde: "Familia" };
    return { regla: prov, desde: "Proveedor" };
  }
  function calculado(it: ItemCalculo): number | null {
    const { regla } = efectiva(it);
    if (regla.metodo !== "m3" || it.volumen == null) return null;
    const v = leerMontoLibre(regla.valor);
    return v > 0 ? redondea(it.volumen * v, monedaMercado) : null;
  }

  const resumen = useMemo(() => {
    let cambian = 0;
    let sinMedida = 0;
    for (const it of items) {
      if (efectiva(it).regla.metodo !== "m3") continue;
      if (it.volumen == null) sinMedida++;
      else {
        const c = calculado(it);
        if (c != null && c !== it.costo) cambian++;
      }
    }
    return { cambian, sinMedida };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, prov, fam, itm]);

  function reglasAGuardar(): ReglaCosto[] {
    const out: ReglaCosto[] = [{ alcance: "Proveedor", metodo: prov.metodo === "m3" ? "m3" : "sku", valor_m3: prov.metodo === "m3" ? leerMontoLibre(prov.valor) : null }];
    for (const [f, r] of Object.entries(fam)) {
      if (r.metodo === "hereda") continue;
      out.push({ alcance: "Familia", familia: f, metodo: r.metodo, valor_m3: r.metodo === "m3" ? leerMontoLibre(r.valor) : null });
    }
    for (const [id, r] of Object.entries(itm)) {
      if (r.metodo === "hereda") continue;
      out.push({ alcance: "Item", id_item: Number(id), metodo: r.metodo, valor_m3: r.metodo === "m3" ? leerMontoLibre(r.valor) : null });
    }
    return out;
  }

  function guardar() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await guardarReglasCosto(idProveedor, reglasAGuardar(), fecha, nota);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      if (!("actualizados" in r)) return;
      setAviso(
        `Guardado. ${r.actualizados} costo(s) recalculados por m³.` +
          (r.sinMedida ? ` ${r.sinMedida} item(s) por m³ no tienen medidas en su ficha y quedaron con su costo.` : "") +
          (r.preferentes ? ` Se recostearon ${r.paneles} paneles y ${r.cotizaciones} lineas de cotizaciones sin pedido.` : "")
      );
      setNota("");
      router.refresh();
    });
  }

  const etiquetaProv = prov.metodo === "m3" ? `Como el proveedor (m³ a ${importe(leerMontoLibre(prov.valor), monedaMercado)} neto)` : "Como el proveedor (por SKU)";

  return (
    <div className="space-y-3 text-xs">
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded p-3">{error}</div>}
      {aviso && <div role="status" className="bg-crema border border-gray-200 text-gray-700 rounded p-3">{aviso}</div>}

      <section className="bg-white border border-gray-200 rounded p-3 grid gap-3 md:grid-cols-[auto_auto_1fr_auto] items-end">
        <div>
          <span className="block font-semibold text-dorado-osc mb-0.5">Todo el proveedor</span>
          <Selector id="regla-proveedor" rotulo="todo el proveedor" regla={prov} hereda={null} moneda={monedaMercado} onChange={setProv} />
        </div>
        <label>
          <span className="block font-semibold text-dorado-osc mb-0.5">Rige desde *</span>
          <input id="regla-fecha" type="date" className={input} value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          <span className="block font-semibold text-dorado-osc mb-0.5">Nota</span>
          <input id="regla-nota" className={`${input} w-full`} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Lista ETSA noviembre..." />
        </label>
        <div className="flex flex-col items-end gap-1">
          <span className="text-gray-600" aria-live="polite">
            {resumen.cambian} costo(s) cambian
            {resumen.sinMedida > 0 && <span className="text-amber-800"> · {resumen.sinMedida} sin medidas</span>}
          </span>
          <button type="button" className="bg-verde text-white font-semibold px-3 py-1.5 rounded disabled:opacity-40" disabled={pendiente} onClick={guardar}>
            {pendiente ? "Guardando..." : "Guardar y recalcular"}
          </button>
        </div>
      </section>

      {familias.map(([familia, lista]) => {
        const rf = fam[familia] ?? SIN;
        return (
          <section key={familia} className="bg-white border border-gray-200 rounded overflow-x-auto">
            <div className="px-3 py-2 border-b border-gray-200 flex flex-wrap items-center gap-x-4 gap-y-1">
              <h2 className="font-semibold text-verde">{familia}</h2>
              <span className="text-gray-500">{lista.length} item{lista.length === 1 ? "" : "s"}</span>
              <span className="ml-auto">
                <Selector
                  id={`regla-fam-${familia}`}
                  rotulo={`familia ${familia}`}
                  regla={rf}
                  hereda={etiquetaProv}
                  moneda={monedaMercado}
                  onChange={(r) => setFam((m) => ({ ...m, [familia]: r }))}
                />
              </span>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">SKU</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Descripcion</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Volumen m³</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Calculo</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Costo actual neto</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Costo por m³ neto</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((it) => {
                  const ef = efectiva(it);
                  const c = calculado(it);
                  const ri = itm[it.id] ?? SIN;
                  const famEf = rf.metodo !== "hereda" ? rf : prov;
                  const heredaItem =
                    famEf.metodo === "m3"
                      ? `Como la familia (m³ a ${importe(leerMontoLibre(famEf.valor), monedaMercado)} neto)`
                      : "Como la familia (por SKU)";
                  const cambia = c != null && c !== it.costo;
                  return (
                    <tr key={it.id} className={`border-t border-gray-100 ${it.activo ? "" : "text-gray-400"}`}>
                      <td className="px-3 py-1.5 font-mono">{it.sku ?? ""}</td>
                      <td className="px-3 py-1.5">
                        {it.descripcion}
                        {!it.activo && <span className="ml-1.5 text-[10px] text-gray-500">(inactivo)</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {it.volumen != null ? it.volumen.toLocaleString("es-CL", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : <span className="text-gray-400">sin medidas</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        <Selector
                          id={`regla-item-${it.id}`}
                          rotulo={it.descripcion}
                          regla={ri}
                          hereda={heredaItem}
                          moneda={monedaMercado}
                          onChange={(r) => setItm((m) => ({ ...m, [it.id]: r }))}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{it.costo > 0 ? importe(it.costo, it.moneda ?? monedaMercado) : <span className="text-amber-800">sin costo</span>}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${cambia ? "font-semibold text-verde" : ""}`}>
                        {ef.regla.metodo !== "m3" ? (
                          <span className="text-gray-400">—</span>
                        ) : it.volumen == null ? (
                          <span className="text-amber-800">falta ancho, largo o espesor</span>
                        ) : c == null ? (
                          ""
                        ) : (
                          importe(c, monedaMercado)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
