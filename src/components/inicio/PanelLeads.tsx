import Link from "next/link";
import { LINEAS } from "@/lib/leads";
import { conMarca, etiquetaDe, ordenados } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import { diaCorto, periodo, type PanelLeadsDatos } from "@/components/inicio/tipos";
import TituloOrden from "@/components/TituloOrden";
import { ORIGENES, PROPIETARIOS } from "@/components/inicio/orden";
import { ordenar, type Orden } from "@/lib/ordenTabla";

// Desempeno de los leads de un mercado: cuantos llegan y de donde, en que estado
// esta la cartera, como la trabaja cada propietario y que origen convierte.
// Todos los graficos llevan su valor escrito: no hay que adivinarlo por el alto.
//
// Se mira el mes elegido y los dos anteriores, nada mas atras: la cartera vieja
// se trabaja en Depurar leads, no aqui. Lo que se abre por semana mantiene su
// propia ventana, y los compromisos se cuentan por su fecha de vencimiento.
// Cada recuadro dice de que periodo habla: un numero sin periodo se malinterpreta.

// Colores para los origenes: los cuatro principales y el resto.
const COLORES = ["#1D4E4A", "#C9A84C", "#2F5D8A", "#B5654A"];
const COLOR_OTROS = "#B8B4A8";

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const n = (x: number) => x.toLocaleString("es-CL");

export default async function PanelLeads({
  d,
  qs,
  ordenPropietarios,
  ordenOrigenes,
}: {
  d: PanelLeadsDatos;
  qs: string;
  ordenPropietarios: Orden;
  ordenOrigenes: Orden;
}) {
  const k = d.kpi;
  const rango = periodo(d.desde, d.hasta);
  const cat = await catalogoEstados();
  const CAMINO = conMarca(cat.lead, "en_camino");
  const conocidos = new Set(cat.lead.map((x) => x.codigo));
  const FUERA = [
    ...ordenados(cat.lead).filter((x) => !x.marcas.includes("en_camino")).map((x) => x.codigo),
    ...Object.keys(d.embudo).filter((c) => !conocidos.has(c)),
  ];
  // Estas dos tablas llegan completas, asi que se ordenan aqui, en el servidor,
  // y no en el navegador: el orden queda en la direccion web como en el resto.
  const equipo = ordenar(d.equipo, ordenPropietarios, (f, c) =>
    c === "propietario" ? f.propietario : c === "conversion" ? pct(f.oportunidades, f.asignados) : Number(f[c as keyof typeof f] ?? 0)
  );
  const origenes = ordenar(d.origenes, ordenOrigenes, (f, c) =>
    c === "origen" ? f.origen : c === "conversion" ? pct(f.oportunidades, f.n) : Number(f[c as keyof typeof f] ?? 0)
  );
  const variacion = k.nuevos_ant > 0 ? Math.round(((k.nuevos_mes - k.nuevos_ant) / k.nuevos_ant) * 100) : null;
  const origenesColor = new Map<string, string>(d.origenes_top.map((o, i) => [o, COLORES[i] ?? COLOR_OTROS]));
  const totalLinea = Object.values(d.linea).reduce((a, b) => a + b, 0);
  const proyecto = d.linea.casas ?? 0;
  const paneles = totalLinea - proyecto;
  const maxCamino = Math.max(1, ...[...CAMINO, ...FUERA].map((e) => d.embudo[e] ?? 0));
  const maxSemana = Math.max(1, ...d.semanas.map((s) => s.total));
  // Las ocho semanas aunque alguna venga vacia: un hueco tambien es un dato.
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const desde = sumar(d.semanas_desde, i * 7);
    return d.semanas.find((s) => s.semana.slice(0, 10) === desde) ?? { semana: desde, por_origen: {}, total: 0 };
  });

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] text-gray-500">
        Cartera de <b className="text-gray-700">{rango}</b>: el mes elegido y los dos anteriores. Los leads mas
        antiguos no se cuentan aqui; se trabajan en{" "}
        <Link href="/leads/depurar" className="underline text-verde">
          Depurar leads
        </Link>
        .
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Kpi
          titulo="Leads nuevos del mes"
          valor={n(k.nuevos_mes)}
          pie={`mes anterior ${n(k.nuevos_ant)}`}
          nota={variacion == null ? undefined : `${variacion > 0 ? "+" : ""}${variacion} %`}
          signo={variacion == null ? 0 : Math.sign(variacion)}
        />
        <Kpi
          titulo="Ya son oportunidad"
          valor={`${pct(k.cohorte_oportunidad, k.nuevos_mes)} %`}
          pie={`${n(k.cohorte_oportunidad)} de los ${n(k.nuevos_mes)} nuevos del mes`}
        />
        <Kpi
          titulo="Sin contactar"
          valor={n(k.sin_contactar)}
          pie={`${n(k.sin_contactar_7d)} esperan hace mas de 7 dias`}
          signo={k.sin_contactar_7d > 0 ? -1 : 0}
          href={`/leads?gestion=sin_contactar`}
        />
        <Kpi
          titulo="Sin seguimiento"
          valor={n(k.sin_seguimiento)}
          pie="vivos y sin nada comprometido"
          signo={k.sin_seguimiento > 0 ? -1 : 0}
          href={`/leads?gestion=sin_seguimiento`}
        />
        <Kpi
          titulo="Compromisos vencidos"
          valor={n(k.compromisos_vencidos)}
          pie="de leads y cotizaciones, sin cumplir"
          signo={k.compromisos_vencidos > 0 ? -1 : 0}
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Caja titulo={`Cartera por estado · ${n(k.total)} leads de ${rango}`}>
          <ul className="p-3 space-y-1 text-[11px]">
            {CAMINO.map((e) => (
              <BarraEstado key={e} estado={e} nombre={etiquetaDe(cat.lead, e)} valor={d.embudo[e] ?? 0} total={k.total} max={maxCamino} vivo />
            ))}
            <li className="pt-1 text-[10px] uppercase tracking-wide text-gray-500">Fuera del camino</li>
            {FUERA.filter((e) => (d.embudo[e] ?? 0) > 0).map((e) => (
              <BarraEstado key={e} estado={e} nombre={etiquetaDe(cat.lead, e)} valor={d.embudo[e] ?? 0} total={k.total} max={maxCamino} />
            ))}
          </ul>
          <p className="px-3 pb-2 text-[10px] text-gray-500">
            Pulse un estado para ver esos leads. La lista los trae todos, tambien los que entraron antes.
          </p>
        </Caja>

        <Caja titulo={`Leads nuevos por semana, por origen · desde el ${diaCorto(d.semanas_desde)}`}>
          <div className="p-3">
            <div className="flex items-end gap-1.5 h-36 mt-3">
              {semanas.map((s) => {
                const alto = Math.max(s.total > 0 ? 2 : 0, Math.round((s.total / maxSemana) * 100));
                const orden = [...d.origenes_top, "Otros"];
                return (
                  <div key={s.semana} className="flex-1 flex flex-col items-center gap-1 h-full">
                    <div className="relative w-full flex-1">
                      <span
                        className="absolute inset-x-0 text-center text-[9px] tabular-nums text-gray-700 leading-none"
                        style={{ bottom: `calc(${alto}% + 2px)` }}
                      >
                        {s.total}
                      </span>
                      <div
                        className="absolute bottom-0 inset-x-[15%] flex flex-col-reverse overflow-hidden rounded-t-sm"
                        style={{ height: `${alto}%` }}
                        title={orden
                          .filter((o) => (s.por_origen[o] ?? 0) > 0)
                          .map((o) => `${o}: ${s.por_origen[o]}`)
                          .join("\n")}
                      >
                        {orden.map((o) => {
                          const v = s.por_origen[o] ?? 0;
                          if (!v) return null;
                          return (
                            <div
                              key={o}
                              style={{ height: `${(v / s.total) * 100}%`, background: origenesColor.get(o) ?? COLOR_OTROS }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <span className="text-[9px] text-gray-500 whitespace-nowrap">{diaCorto(s.semana)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-600">
              {[...d.origenes_top, "Otros"].map((o) => (
                <span key={o} className="inline-flex items-center gap-1">
                  <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: origenesColor.get(o) ?? COLOR_OTROS }} />
                  {o}
                </span>
              ))}
              <span className="text-gray-400">· cada barra es una semana, de lunes a domingo</span>
            </div>
          </div>
        </Caja>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Razones titulo="Por que se pierde" filas={d.razones_perdida ?? []} clase="bg-[#B5654A]" rango={rango} />
        <Razones titulo="Por que se gana" filas={d.razones_ganada ?? []} clase="bg-verde" rango={rango} />
      </div>

      <Caja titulo={`Como trabaja la cartera cada propietario · ${rango}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {PROPIETARIOS.columnas.map((c) => (
                  <TituloOrden
                    key={c.campo}
                    qs={qs}
                    param={PROPIETARIOS.param}
                    campo={c.campo}
                    actual={ordenPropietarios}
                    inicial={c.inicial}
                    alineacion={c.campo === "propietario" ? "left" : "right"}
                  >
                    {c.texto}
                  </TituloOrden>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipo.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-5">
                    Sin leads en este mercado.
                  </td>
                </tr>
              )}
              {equipo.map((f) => (
                <tr key={f.propietario} className="border-t border-gray-100">
                  <td className="px-2.5 py-1.5 font-semibold text-verde">{f.propietario}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{n(f.asignados)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{n(f.nuevos_mes)}</td>
                  <td className={`px-2.5 py-1.5 text-right tabular-nums ${f.sin_contactar > 0 ? "text-dorado-osc font-semibold" : ""}`}>
                    {n(f.sin_contactar)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{n(f.contactados)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold">{n(f.oportunidades)}</td>
                  <td className={`px-2.5 py-1.5 text-right tabular-nums ${f.sin_seguimiento > 0 ? "text-dorado-osc" : ""}`}>
                    {n(f.sin_seguimiento)}
                  </td>
                  <td className={`px-2.5 py-1.5 text-right tabular-nums ${f.compromisos_vencidos > 0 ? "text-red-700 font-semibold" : ""}`}>
                    {n(f.compromisos_vencidos)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(f.oportunidades, f.asignados)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-2.5 py-1.5 text-[10px] text-gray-500">
          Conversion: oportunidades y clientes sobre el total asignado. Sin seguimiento: contactados, calientes u
          oportunidades sin compromiso ni accion pendiente. Los compromisos vencidos se cuentan por su fecha, de toda
          la cartera de la persona.
          <Link href="/leads/depurar" className="underline text-verde ml-1">
            Depurar leads anteriores
          </Link>
        </p>
      </Caja>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_1.4fr]">
        <Caja titulo={`Paneles y proyecto · ${rango}`}>
          <div className="p-3 space-y-2 text-[11px]">
            <div className="flex h-6 w-full overflow-hidden rounded" role="img" aria-label={`Paneles ${paneles}, proyecto ${proyecto}`}>
              <div className="bg-verde text-white text-[10px] font-semibold flex items-center justify-center" style={{ width: `${pct(paneles, totalLinea)}%` }}>
                {pct(paneles, totalLinea) >= 12 ? `${pct(paneles, totalLinea)} %` : ""}
              </div>
              <div className="bg-dorado text-negro text-[10px] font-semibold flex items-center justify-center" style={{ width: `${pct(proyecto, totalLinea)}%` }}>
                {pct(proyecto, totalLinea) >= 12 ? `${pct(proyecto, totalLinea)} %` : ""}
              </div>
            </div>
            <div className="flex justify-between">
              <Link href="/leads?linea=paneles" className="underline text-verde">
                {LINEAS.paneles}: <b>{n(paneles)}</b> ({pct(paneles, totalLinea)} %)
              </Link>
              <Link href="/leads?linea=casas" className="underline text-dorado-osc">
                {LINEAS.casas}: <b>{n(proyecto)}</b> ({pct(proyecto, totalLinea)} %)
              </Link>
            </div>
          </div>
        </Caja>

        <Caja titulo={`Que origen convierte · leads de ${rango}`}>
          {d.origenes.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-gray-400">Sin leads en este periodo.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {ORIGENES.columnas.map((c) => (
                    <TituloOrden
                      key={c.campo}
                      qs={qs}
                      param={ORIGENES.param}
                      campo={c.campo}
                      actual={ordenOrigenes}
                      inicial={c.inicial}
                      alineacion={c.campo === "origen" || c.campo === "conversion" ? "left" : "right"}
                      ancho={c.campo === "conversion" ? "w-[40%]" : undefined}
                    >
                      {c.texto}
                    </TituloOrden>
                  ))}
                </tr>
              </thead>
              <tbody>
                {origenes.slice(0, 8).map((o) => {
                  const p = pct(o.oportunidades, o.n);
                  return (
                    <tr key={o.origen} className="border-t border-gray-100">
                      <td className="px-2.5 py-1 break-words">{o.origen}</td>
                      <td className="px-2.5 py-1 text-right tabular-nums">{n(o.n)}</td>
                      <td className="px-2.5 py-1 text-right tabular-nums">{n(o.oportunidades)}</td>
                      <td className="px-2.5 py-1">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 bg-verde rounded-sm" style={{ width: `${Math.max(p, 1)}%` }} />
                          <span className="tabular-nums">{p} %</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Caja>
      </div>
    </div>
  );
}

function sumar(iso: string, dias: number) {
  const [a, m, dd] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, dd + dias)).toISOString().slice(0, 10);
}

// Las razones que anota el CRM al cerrar una oportunidad, por su fecha de
// cierre. Sin esto no se puede responder por que se pierde.
function Razones({
  titulo,
  filas,
  clase,
  rango,
}: {
  titulo: string;
  filas: { razon: string; n: number; monto: number }[];
  clase: string;
  rango: string;
}) {
  const total = filas.reduce((a, b) => a + b.n, 0);
  return (
    <Caja titulo={`${titulo} · oportunidades cerradas en ${rango}`}>
      {filas.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-gray-400">
          Sin oportunidades cerradas en {rango}. La razon viene de la planilla del CRM.
        </p>
      ) : (
        <ul className="p-3 space-y-1.5 text-[11px]">
          {filas.map((f) => (
            <li key={f.razon} className="grid grid-cols-[8rem_1fr_auto] items-center gap-2">
              <span className="truncate" title={f.razon}>
                {f.razon}
              </span>
              <span className="h-3 bg-gray-100 rounded-sm overflow-hidden">
                <span className={`block h-full ${clase}`} style={{ width: `${pct(f.n, total)}%` }} />
              </span>
              <span className="tabular-nums text-right">
                <b>{n(f.n)}</b> <span className="text-gray-500">{pct(f.n, total)} %</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Caja>
  );
}

function BarraEstado({
  estado,
  nombre,
  valor,
  total,
  max,
  vivo = false,
}: {
  estado: string;
  nombre: string;
  valor: number;
  total: number;
  max: number;
  vivo?: boolean;
}) {
  const ancho = Math.max(valor > 0 ? 1 : 0, Math.round((valor / max) * 100));
  return (
    <li>
      <Link href={`/leads?estado=${estado}`} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 hover:bg-crema rounded px-1">
        <span className="truncate" title={nombre}>
          {nombre}
        </span>
        <span className="h-3 bg-gray-100 rounded-sm overflow-hidden">
          <span className={`block h-full ${vivo ? "bg-verde" : "bg-gray-400"}`} style={{ width: `${ancho}%` }} />
        </span>
        <span className="tabular-nums text-right w-20">
          <b>{valor.toLocaleString("es-CL")}</b> <span className="text-gray-500">{pct(valor, total)} %</span>
        </span>
      </Link>
    </li>
  );
}

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden">
      <h3 className="bg-verde text-white text-[11px] font-semibold px-2.5 py-1.5 uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

function Kpi({
  titulo,
  valor,
  pie,
  nota,
  signo = 0,
  href,
}: {
  titulo: string;
  valor: string;
  pie: string;
  nota?: string;
  signo?: number;
  href?: string;
}) {
  const cuerpo = (
    <>
      <span className="block text-[10px] uppercase tracking-wide text-gray-500">{titulo}</span>
      <span className="block text-lg font-bold leading-tight tabular-nums">
        {valor}
        {nota && (
          <span className={`ml-1.5 text-[11px] font-semibold ${signo > 0 ? "text-green-700" : signo < 0 ? "text-red-700" : "text-gray-500"}`}>
            {nota}
          </span>
        )}
      </span>
      <span className={`block text-[10px] ${signo < 0 && !nota ? "text-red-700" : "text-gray-600"}`}>{pie}</span>
    </>
  );
  const clase = "block bg-white border border-gray-200 rounded px-2.5 py-2";
  return href ? (
    <Link href={href} className={`${clase} hover:border-verde`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}
