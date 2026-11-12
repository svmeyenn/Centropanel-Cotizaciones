"use client";

import { useState, type ReactNode } from "react";
import type { DatosMateria } from "@/app/materias-primas/acciones";
import type { Pais, TipoMateria } from "@/types/database";
import { importe, leerMontoLibre, redondea } from "@/lib/formato";

// Regla por m3 de un proveedor que alcanza al insumo: sugiere el valor del metro cubico.
export type ReglaM3 = { id_proveedor: number; proveedor: string; alcance: "Proveedor" | "Familia"; familia: string | null; valor_m3: number; id_pais: number | null };

const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

// Rotulo, campo y una leyenda corta que dice para que se usa el dato.
function Dato({ rotulo, para, children, ancho }: { rotulo: string; para: string; children: ReactNode; ancho?: string }) {
  return (
    <label className={`text-sm block ${ancho ?? ""}`}>
      <span className="block text-dorado-osc font-semibold mb-1">{rotulo}</span>
      {children}
      <span className="block text-[11px] leading-snug text-gray-500 mt-0.5">{para}</span>
    </label>
  );
}

function Lista({ value, opciones, onChange, id }: { value: string; opciones: string[]; onChange: (v: string) => void; id: string }) {
  const lista = value && !opciones.includes(value) ? [value, ...opciones] : opciones;
  return (
    <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- elija --</option>
      {lista.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

const num = (v: string) => (v === "" ? null : Number(v));
const fmt = (n: number, dec = 2) => n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Los campos de una materia prima, iguales al crearla y al editarla, con los parametros que se derivan de sus medidas.
export default function CamposMateria({
  form,
  setForm,
  tipos,
  etiquetas,
  familias,
  unidades,
  moneda,
  paises,
  eligePais,
  conPais,
  reglasM3 = [],
  notaCosto,
  prefijo,
  onReglaUsada,
}: {
  form: DatosMateria;
  setForm: (f: DatosMateria) => void;
  tipos: TipoMateria[];
  etiquetas: string[];
  familias: string[];
  unidades: string[];
  moneda: string;
  paises?: Pais[];
  eligePais?: boolean;
  // El pais solo se elige al crear.
  conPais?: boolean;
  reglasM3?: ReglaM3[];
  notaCosto?: ReactNode;
  prefijo: string;
  // La regla del proveedor con que se calculo el costo, o null si se escribio a mano.
  onReglaUsada?: (r: ReglaM3 | null) => void;
}) {
  const [m3, setM3] = useState("");
  const tipo = tipos.find((t) => t.nombre === form.tipo);
  const a = Number(form.ancho_mm) || 0;
  const l = Number(form.largo_mm) || 0;
  const e = Number(form.espesor_mm) || 0;
  const volumen = a > 0 && l > 0 && e > 0 ? (a * l * e) / 1e9 : null;
  const superficie = a > 0 && l > 0 ? (a * l) / 1e6 : null;
  const costo = Number(form.costo) || 0;
  const pesoCalc = volumen != null && form.densidad_kg_m3 ? volumen * Number(form.densidad_kg_m3) : null;
  const pesoFlete = form.peso_kg ?? pesoCalc;

  // Las reglas por m3 que alcanzan a este insumo: las de su familia o las de todo el proveedor, de su mercado.
  const familiaRegla = form.familia || form.tipo;
  const reglas = reglasM3.filter(
    (r) => (r.id_pais == null || form.id_pais == null || r.id_pais === form.id_pais) && (r.alcance === "Proveedor" || r.familia === familiaRegla)
  );
  const usaM3 = Boolean(tipo?.es_nucleo) || reglas.length > 0;

  function aplicarM3(texto: string, regla: ReglaM3 | null = null) {
    setM3(texto);
    onReglaUsada?.(regla);
    const v = leerMontoLibre(texto);
    if (volumen != null && v > 0) setForm({ ...form, costo: redondea(volumen * v, moneda) });
  }
  function cambiarMedida(k: "ancho_mm" | "largo_mm" | "espesor_mm", valor: number | null) {
    const f = { ...form, [k]: valor, ...(k === "espesor_mm" ? { espesor_nominal: valor == null ? null : Math.round(valor) } : {}) };
    // Con un valor por m3 escrito, el costo de la unidad sigue a las medidas.
    const v = leerMontoLibre(m3);
    const aa = Number(f.ancho_mm) || 0, ll = Number(f.largo_mm) || 0, ee = Number(f.espesor_mm) || 0;
    if (v > 0 && aa > 0 && ll > 0 && ee > 0) f.costo = redondea(((aa * ll * ee) / 1e9) * v, moneda);
    setForm(f);
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-verde">Identificacion y categorizacion</legend>
        <Dato rotulo="Descripcion *" para="Nombre del insumo; no se puede repetir. Sale en listas, necesidades, solicitudes y ordenes de compra, y la carga masiva de costos empareja por el.">
          <input id={`${prefijo}-nombre`} className={input} value={form.nombre} onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
        </Dato>
        <div className="grid md:grid-cols-2 gap-3">
          <Dato rotulo="Tipo *" para="Su papel en el panel: el tipo nucleo (EPS) va al centro y el tipo cara (Placa) a los lados. El configurador ofrece cada insumo segun su tipo.">
            <select id={`${prefijo}-tipo`} className={input} value={form.tipo} onChange={(ev) => setForm({ ...form, tipo: ev.target.value })}>
              <option value="">-- elija --</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Dato>
          {conPais && (
            <Dato rotulo="Pais *" para="Mercado del insumo: solo lo ven, compran y cotizan los usuarios de ese pais.">
              <select
                id={`${prefijo}-pais`}
                className={input}
                value={form.id_pais ?? ""}
                disabled={!eligePais}
                onChange={(ev) => setForm({ ...form, id_pais: Number(ev.target.value) || null })}
              >
                {eligePais && <option value="">-- elija --</option>}
                {(paises ?? []).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </Dato>
          )}
          <Dato rotulo="Familia" para="Agrupa insumos parecidos en la lista y sus filtros, y es el grupo al que un proveedor le aplica su regla de costo por m³.">
            <Lista id={`${prefijo}-familia`} value={form.familia} opciones={familias} onChange={(v) => setForm({ ...form, familia: v })} />
          </Dato>
          <Dato rotulo="Etiqueta" para="Nombre corto que forma la descripcion de los paneles que usan este insumo (p. ej. APA, EPS15). Use siempre la misma para lo mismo.">
            <Lista id={`${prefijo}-etiqueta`} value={form.etiqueta} opciones={etiquetas} onChange={(v) => setForm({ ...form, etiqueta: v })} />
          </Dato>
          <Dato rotulo="Unidad" para="Unidad en que se compra y se cuenta (Uni, m², kg). Pasa a las necesidades, solicitudes y ordenes de compra.">
            <Lista id={`${prefijo}-unidad`} value={form.unidad} opciones={unidades} onChange={(v) => setForm({ ...form, unidad: v })} />
          </Dato>
        </div>
        <p className="text-[11px] text-gray-500">Las listas de familia, etiqueta y unidad se configuran en Parametros de materias primas. El SKU se asigna solo al crear.</p>
      </fieldset>

      <fieldset className="border-t border-gray-200 pt-3 space-y-3">
        <legend className="text-xs font-semibold text-verde pr-2">Medidas y peso</legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Dato rotulo="Espesor (mm)" para="Admite decimales (12,7). Suma al espesor del panel y sale en su descripcion; con ancho y largo da el volumen.">
            <input id={`${prefijo}-espesor`} type="number" step="any" min="0" className={input} value={form.espesor_mm ?? ""} onChange={(ev) => cambiarMedida("espesor_mm", num(ev.target.value))} />
          </Dato>
          <Dato rotulo="Ancho (mm)" para="Medida de la unidad. Con el largo da la superficie; con el espesor, el volumen para el costo por m³ y el flete.">
            <input id={`${prefijo}-ancho`} type="number" step="any" min="0" className={input} value={form.ancho_mm ?? ""} onChange={(ev) => cambiarMedida("ancho_mm", num(ev.target.value))} />
          </Dato>
          <Dato rotulo="Largo (mm)" para="Medida de la unidad. Con el ancho da la superficie; con el espesor, el volumen para el costo por m³ y el flete.">
            <input id={`${prefijo}-largo`} type="number" step="any" min="0" className={input} value={form.largo_mm ?? ""} onChange={(ev) => cambiarMedida("largo_mm", num(ev.target.value))} />
          </Dato>
          <Dato rotulo="Peso por unidad (kg)" para="Peso real de una unidad (placas). Si esta, manda sobre la densidad para el peso del panel y el flete.">
            <input id={`${prefijo}-peso`} type="number" step="any" min="0" className={input} value={form.peso_kg ?? ""} onChange={(ev) => setForm({ ...form, peso_kg: num(ev.target.value) })} />
          </Dato>
          <Dato rotulo="Densidad (kg/m³)" para="Del poliestireno (EPS). Sin peso por unidad, el peso se calcula con ella y el volumen; sirve para el panel y el flete.">
            <input id={`${prefijo}-densidad`} type="number" step="any" min="0" className={input} value={form.densidad_kg_m3 ?? ""} onChange={(ev) => setForm({ ...form, densidad_kg_m3: num(ev.target.value) })} />
          </Dato>
        </div>
      </fieldset>

      <fieldset className="border-t border-gray-200 pt-3 space-y-3">
        <legend className="text-xs font-semibold text-verde pr-2">Costo</legend>
        <div className="grid md:grid-cols-2 gap-3">
          {usaM3 && (
            <Dato rotulo={`Costo por m³ neto (${moneda}, sin IVA)`} para="Para insumos que se compran por volumen, como el EPS: con el volumen de la unidad calcula el costo neto de la unidad. No se guarda; la regla del proveedor se fija en su ficha.">
              <input id={`${prefijo}-m3`} className={`${input} text-right tabular-nums`} inputMode="decimal" value={m3} placeholder={volumen == null ? "complete las medidas" : "valor del m³"} disabled={volumen == null} onChange={(ev) => aplicarM3(ev.target.value)} />
              {reglas.length > 0 && (
                <span className="flex flex-wrap gap-1 mt-1">
                  {reglas.map((r) => (
                    <button
                      key={`${r.id_proveedor}-${r.alcance}-${r.familia}`}
                      type="button"
                      disabled={volumen == null}
                      className="text-[11px] border border-verde text-verde rounded px-1.5 py-0.5 disabled:opacity-40"
                      onClick={() => aplicarM3(String(r.valor_m3), r)}
                    >
                      {r.proveedor}: {importe(r.valor_m3, moneda)}/m³ {r.alcance === "Familia" ? `(${r.familia})` : "(todo el proveedor)"}
                    </button>
                  ))}
                </span>
              )}
            </Dato>
          )}
          <Dato rotulo={`Costo neto por unidad (${moneda}, sin IVA)`} para="Costo de una unidad completa. Con el de las otras partes arma el costo del panel, y de ahi su precio.">
            <input id={`${prefijo}-costo`} type="number" step="any" min="0" className={`${input} text-right tabular-nums`} value={form.costo} onChange={(ev) => { setM3(""); onReglaUsada?.(null); setForm({ ...form, costo: Number(ev.target.value) || 0 }); }} />
            {notaCosto}
          </Dato>
        </div>
      </fieldset>

      <section className="bg-crema border border-gray-200 rounded p-3" aria-label="Parametros calculados">
        <h3 className="text-xs font-semibold text-verde mb-2">Parametros calculados</h3>
        {volumen == null && superficie == null ? (
          <p className="text-[11px] text-gray-500">Complete ancho, largo y espesor para ver volumen, superficie, costo por m³ y m², y peso.</p>
        ) : (
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
            <Calc rotulo="Volumen por unidad" valor={volumen != null ? `${fmt(volumen, 4)} m³` : "falta el espesor"} para="ancho x largo x espesor" />
            <Calc rotulo="Unidades por m³" valor={volumen ? fmt(1 / volumen, 2) : "—"} para="para pasar compras por m³ a unidades" />
            <Calc rotulo="Superficie por unidad" valor={superficie != null ? `${fmt(superficie, 3)} m²` : "—"} para="ancho x largo" />
            <Calc rotulo="Espesor nominal" valor={form.espesor_nominal != null ? `${form.espesor_nominal} mm` : "—"} para="espesor redondeado, agrupa" />
            <Calc rotulo="Costo neto por m³" valor={volumen && costo ? importe(redondea(costo / volumen, moneda), moneda) : "—"} para="costo de la unidad / volumen" />
            <Calc rotulo="Costo neto por m²" valor={superficie && costo ? importe(redondea(costo / superficie, moneda), moneda) : "—"} para="costo de la unidad / superficie" />
            <Calc
              rotulo="Peso por unidad"
              valor={pesoFlete != null ? `${fmt(Number(pesoFlete), 2)} kg` : "falta peso o densidad"}
              para={form.peso_kg != null ? "de la ficha" : pesoCalc != null ? "densidad x volumen" : "para el flete"}
            />
            <Calc rotulo="Peso por m²" valor={pesoFlete != null && superficie ? `${fmt(Number(pesoFlete) / superficie, 2)} kg/m²` : "—"} para="peso / superficie" />
          </dl>
        )}
      </section>
    </div>
  );
}

function Calc({ rotulo, valor, para }: { rotulo: string; valor: string; para: string }) {
  return (
    <div>
      <dt className="text-gray-600">{rotulo}</dt>
      <dd className="font-semibold tabular-nums text-gray-900">{valor}</dd>
      <dd className="text-[10px] text-gray-500">{para}</dd>
    </div>
  );
}
