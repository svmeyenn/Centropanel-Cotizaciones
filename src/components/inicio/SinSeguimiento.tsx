import Link from "next/link";
import { BanderaDe } from "@/components/Bandera";
import PildoraLinea from "@/components/PildoraLinea";
import { BarraOrden } from "@/components/TituloOrden";
import FiltrosCuadro from "@/components/FiltrosCuadro";
import { importe } from "@/lib/formato";
import { LINEAS } from "@/lib/leads";
import { etiquetaDe, type Catalogo } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import { antiguedad, type FilaSeguimiento, type Gestion } from "@/components/inicio/tipos";
import { SEGUIMIENTO } from "@/components/inicio/orden";
import type { Orden } from "@/lib/ordenTabla";

// Todo lo vivo que nadie tiene comprometido, en UN solo listado. El seguimiento
// de una cotizacion equivale al de un lead: si la cotizacion de un lead no tiene
// a nadie a cargo, es el mismo hilo que el lead sin seguimiento y sale en una
// sola fila --el lead, con su cotizacion pegada--. Una cotizacion cuyo lead no
// esta en la lista va sola. Y si el lead tiene algo comprometido, el hilo entero
// queda fuera: la base lo decide, esta pantalla solo lo dibuja.
//
// Lo comprometido con fecha --de leads, de cotizaciones y las entregas-- esta
// en la agenda, tambien en un solo listado.

const TIPOS = {
  lead: { texto: "Lead", clase: "text-verde border-verde" },
  cotizacion: { texto: "Cotizacion", clase: "text-dorado-osc border-dorado-osc" },
} as const;

export default async function SinSeguimiento({
  g,
  verResponsable,
  qs,
  orden,
  hrefLeads,
}: {
  g: Gestion;
  verResponsable: boolean;
  qs: string;
  orden: Orden;
  // La lista de leads que filtra por falta de seguimiento, para el pie.
  hrefLeads: string;
}) {
  const s = g.seguimiento;
  const cat = await catalogoEstados();
  // Un codigo de lead y uno de cotizacion no se pisan: se reconoce a cual pertenece.
  const nombreEstado = (e: string) =>
    cat.lead.some((x) => x.codigo === e) ? etiquetaDe(cat.lead, e) : etiquetaDe(cat.cotizacion, e);
  const o = g.opciones;
  const nFiltrado = s.n_filtrado ?? s.n;

  const selecciones = [
    {
      param: "f_seg_tipo",
      texto: "Mostrar",
      opciones: [
        { valor: "lead", texto: "Solo leads" },
        { valor: "cotizacion", texto: "Con cotizacion" },
      ],
    },
    {
      param: "f_seg_linea",
      texto: "Linea",
      opciones: [
        { valor: "paneles", texto: LINEAS.paneles },
        { valor: "casas", texto: LINEAS.casas },
      ],
    },
    {
      // Estados de leads y de cotizaciones en la misma lista: no se pisan, los
      // de leads son codigos y los de cotizaciones, nombres.
      param: "f_seg_estado",
      texto: "Estado",
      opciones: (o?.seg_estado ?? []).map((e) => ({ valor: e, texto: nombreEstado(e) })),
    },
    ...(verResponsable
      ? [
          {
            param: "f_seg_resp",
            texto: "Responsable",
            opciones: (o?.seg_responsable ?? []).map((e) => ({ valor: e, texto: e })),
          },
        ]
      : []),
  ];

  return (
    <section
      id="seguimiento"
      aria-labelledby="titulo-seg"
      className="bg-white border border-gray-200 rounded overflow-hidden flex flex-col scroll-mt-4"
    >
      <div className="bg-verde text-white px-3 py-1.5">
        <h2 id="titulo-seg" className="text-[11px] font-semibold uppercase">
          Sin seguimiento · {nFiltrado.toLocaleString("es-CL")}
        </h2>
      </div>
      <FiltrosCuadro
        selecciones={selecciones}
        rangos={[
          { param: "rg_seg", texto: "Fecha", tipo: "fecha", nota: "ultimo contacto, o fecha de la cotizacion" },
          { param: "rg_seg_monto", texto: "Monto", tipo: "numero", nota: "de la cotizacion, en su moneda" },
        ]}
        nFiltrado={nFiltrado}
        nTotal={s.n}
        unidad="seguimientos"
      />
      <div className="px-3 pt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[10px] text-gray-500">
          Leads vivos y cotizaciones en juego que nadie tiene comprometidos. Un lead y su cotizacion cuentan una sola
          vez.
        </p>
        <BarraOrden
          qs={qs}
          param={SEGUIMIENTO.param}
          actual={orden}
          opciones={SEGUIMIENTO.columnas.filter((c) => verResponsable || c.campo !== "responsable")}
        />
      </div>

      {s.lista.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-gray-500">
          {s.n === 0 ? "Todo lo vivo tiene algo comprometido." : "Nada con lo que eligio."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 flex-1">
          {s.lista.map((f) => (
            <Fila key={f.clave} f={f} verResponsable={verResponsable} cat={cat} />
          ))}
        </ul>
      )}

      <div className="px-3 py-1.5 text-[11px] border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-0.5">
        {nFiltrado > s.lista.length && (
          <span className="text-gray-500">
            Se muestran {s.lista.length} de {nFiltrado.toLocaleString("es-CL")}, por el orden elegido.
          </span>
        )}
        <Link href={hrefLeads} className="text-verde underline">
          Los leads, en la lista de leads →
        </Link>
        <Link href="/cotizaciones" className="text-verde underline">
          Las cotizaciones, en la lista de cotizaciones →
        </Link>
      </div>
    </section>
  );
}

function Fila({ f, verResponsable, cat }: { f: FilaSeguimiento; verResponsable: boolean; cat: Catalogo }) {
  const t = TIPOS[f.tipo];
  // El lead se abre en su ficha; una cotizacion sin lead, en la suya.
  const href = f.tipo === "lead" && f.id_lead ? `/leads/${f.id_lead}` : f.cot ? `/cotizaciones/${f.cot.id}` : "#";
  const d = f.dias;
  const referencia =
    d == null
      ? f.tipo === "lead"
        ? "sin contacto registrado"
        : ""
      : f.tipo === "lead"
        ? `ultimo contacto hace ${antiguedad(d)}`
        : `cotizada hace ${antiguedad(d)}`;
  // Pasados quince dias sin tocar, o sin ningun contacto, el hilo se enfria.
  const alerta = d == null ? f.tipo === "lead" : d > 14;

  return (
    <li className="px-3 py-1.5 text-[11px] flex items-start gap-1.5">
      <BanderaDe idPais={f.id_pais} />
      <span className={`shrink-0 text-[9px] font-semibold border rounded px-1 mt-0.5 ${t.clase}`}>{t.texto}</span>
      {f.tipo === "lead" && <PildoraLinea linea={f.linea} />}
      <div className="min-w-0 flex-1">
        <Link href={href} className="font-semibold text-verde underline break-words">
          {f.nombre}
        </Link>
        <p className="text-[10px] text-gray-500">
          {f.tipo === "lead" ? etiquetaDe(cat.lead, f.estado) : etiquetaDe(cat.cotizacion, f.estado)}
          {verResponsable && <span className="text-gray-600"> · {f.responsable}</span>}
        </p>
        {f.cot && f.tipo === "lead" && (
          <p className="text-[10px] mt-0.5">
            <Link href={`/cotizaciones/${f.cot.id}`} className="text-dorado-osc underline font-semibold">
              {f.cot.folio ?? f.cot.id}
            </Link>
            <span className="text-gray-600">
              {" "}
              · {etiquetaDe(cat.cotizacion, f.cot.estado)} · {importe(f.cot.total, f.cot.moneda)}
              {verResponsable && f.cot.ejecutivo && <> · {f.cot.ejecutivo}</>}
            </span>
          </p>
        )}
        {f.cot && f.tipo === "cotizacion" && (
          <p className="text-[10px] text-gray-600 mt-0.5">
            <span className="text-dorado-osc font-semibold">{f.cot.folio ?? f.cot.id}</span> ·{" "}
            {importe(f.cot.total, f.cot.moneda)}
          </p>
        )}
      </div>
      <span className={`shrink-0 text-[10px] text-right ${alerta ? "text-red-700 font-semibold" : "text-gray-600"}`}>
        {referencia}
      </span>
    </li>
  );
}
