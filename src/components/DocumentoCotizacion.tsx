import { pesos, unidades as fmtUnid, fecha as fmtFecha, sumarDias } from "@/lib/formato";
import { pTxt, pNum, type Parametros } from "@/lib/parametros";
import { LOGO_PDF } from "@/lib/logo";

// La cotizacion impresa, replica de rptCotizacion. Vive en un componente propio
// porque la usan dos rutas: /cotizaciones/[id]/pdf (interna, con sesion) y
// /c/[token] (publica, la que recibe el cliente). Tenerla dos veces garantizaba
// que tarde o temprano se separaran.

export interface PersonaDoc {
  nombre?: string | null;
  razon_social?: string | null;
  rut?: string | null;
  contacto?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefono?: string | null;
}

export interface ItemDoc {
  descripcion: string | null;
  unidades: number;
  valor_unitario: number;
}

export interface CotizacionDoc {
  num_cotizacion: string | null;
  fecha: string;
  validez_dias: number;
  tiempo_entrega: string | null;
  direccion_despacho: string | null;
  cliente: PersonaDoc | null;
  vendedor: PersonaDoc | null;
  forma_pago: string | null;
  items: ItemDoc[];
  subtotal: number;
  descuento: number;
  total_neto: number;
  iva: number;
  total: number;
}

export default function DocumentoCotizacion({
  d,
  p,
}: {
  d: CotizacionDoc;
  p: Parametros;
}) {
  const vence = sumarDias(d.fecha.slice(0, 10), d.validez_dias ?? 7);

  return (
    <div className="mx-auto bg-white text-[#1A1A1A] p-10 max-w-[820px] print:max-w-none print:p-[14mm]">
      {/* ---- cabecera: logo y marca a la izquierda, folio en el bloque verde ---- */}
      <div className="flex justify-between items-start gap-6 mb-5">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_PDF}
            alt="Centro Panel"
            className="h-[46px] w-auto shrink-0"
          />
          <div>
            <div className="text-xl font-bold text-verde leading-tight">
              {pTxt(p, "EmpresaMarca")}
            </div>
            <div className="text-[10px] text-gray-600">{pTxt(p, "EmpresaGiro")}</div>
            <div className="text-[10px] text-gray-600">
              {pTxt(p, "EmpresaDireccion")}
            </div>
          </div>
        </div>
        <div className="bg-verde text-white px-4 py-2.5 text-right min-w-[260px]">
          <div className="text-xl font-bold leading-tight">{d.num_cotizacion}</div>
          <div className="text-[10px] text-dorado">
            {pTxt(p, "EmpresaNombre")} &nbsp; RUT {pTxt(p, "EmpresaRUT")}
          </div>
          <div className="text-[10px]">
            Emitida {fmtFecha(d.fecha)} &nbsp; Vence {fmtFecha(vence)}
          </div>
        </div>
      </div>

      {/* ---- cliente / ejecutivo: un campo por linea, rotulo y valor ---- */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div>
          <div className="bg-crema text-dorado-osc text-[10px] font-bold px-2 py-1 mb-1">
            CLIENTE
          </div>
          <Campo rotulo="Razon social" valor={d.cliente?.razon_social} />
          <Campo rotulo="RUT" valor={d.cliente?.rut} />
          <Campo rotulo="Contacto" valor={d.cliente?.contacto} />
          <Campo rotulo="Correo" valor={d.cliente?.email} />
          <Campo rotulo="Telefono" valor={d.cliente?.telefono} />
        </div>
        <div>
          <div className="bg-crema text-dorado-osc text-[10px] font-bold px-2 py-1 mb-1">
            EJECUTIVO
          </div>
          <Campo rotulo="Nombre" valor={d.vendedor?.nombre} />
          <Campo rotulo="Cargo" valor={d.vendedor?.cargo} />
          <Campo rotulo="Correo" valor={d.vendedor?.email} />
          <Campo rotulo="Telefono" valor={d.vendedor?.telefono} />
        </div>
      </div>

      {/* ---- items ---- */}
      <table className="w-full text-[11px] mb-5">
        <thead>
          <tr className="bg-verde text-white text-[10px]">
            <th className="text-left px-2 py-1.5">DESCRIPCION</th>
            <th className="text-right px-2 py-1.5 w-16">UNID.</th>
            <th className="text-right px-2 py-1.5 w-28">V. UNITARIO</th>
            <th className="text-right px-2 py-1.5 w-32">SUBTOTAL NETO</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((it, i) => (
            <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
              <td className="px-2 py-1">{it.descripcion}</td>
              <td className="px-2 py-1 text-right">{fmtUnid(it.unidades)}</td>
              <td className="px-2 py-1 text-right">{pesos(it.valor_unitario)}</td>
              <td className="px-2 py-1 text-right">
                {pesos(Number(it.unidades) * Number(it.valor_unitario))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- totales ---- */}
      <div className="flex justify-end mb-5">
        <table className="text-[11px]">
          <tbody>
            <tr>
              <td className="text-right pr-6 py-0.5">SUBTOTAL</td>
              <td className="text-right py-0.5 w-32">{pesos(d.subtotal)}</td>
            </tr>
            {/* La linea de descuento no se imprime cuando es cero, igual que
                el IIf(Nz([DescuentoMonto],0)=0,Null,...) del informe. */}
            {d.descuento > 0 && (
              <tr>
                <td className="text-right pr-6 py-0.5">DESCUENTO</td>
                <td className="text-right py-0.5">{pesos(d.descuento)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td className="text-right pr-6 py-0.5">TOTAL NETO</td>
              <td className="text-right py-0.5">{pesos(d.total_neto)}</td>
            </tr>
            <tr>
              <td className="text-right pr-6 py-0.5">
                IVA {Math.round(pNum(p, "IVA", 0.19) * 100)}%
              </td>
              <td className="text-right py-0.5">{pesos(d.iva)}</td>
            </tr>
            <tr className="bg-verde text-white font-bold">
              <td className="text-right pr-6 py-1.5">TOTAL</td>
              <td className="text-right py-1.5 pr-2">{pesos(d.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- pie: condiciones y datos bancarios ---- */}
      <div className="grid grid-cols-2 gap-6 text-[10px] leading-relaxed">
        <div>
          <div className="text-dorado-osc font-bold mb-1">CONDICIONES COMERCIALES</div>
          <p>
            Validez de la cotizacion: {d.validez_dias} dias corridos (vence el{" "}
            {fmtFecha(vence)}).
          </p>
          <p>Medio de pago: {pTxt(p, "MedioPagoDefecto")}</p>
          {d.forma_pago && <p>Forma de pago: {d.forma_pago}</p>}
          {d.tiempo_entrega && <p>Tiempo de entrega: {d.tiempo_entrega}</p>}
          <p>Tarifas: {pTxt(p, "NotaTarifas")}</p>
          <p>{pTxt(p, "NotaBodegaje")}</p>
          <p>{pTxt(p, "CondDescarga")}</p>
        </div>
        <div>
          <div className="text-dorado-osc font-bold mb-1">DATOS PARA EL DEPOSITO</div>
          <p>{pTxt(p, "EmpresaNombre")}</p>
          <p>RUT: {pTxt(p, "EmpresaRUT")}</p>
          <p>Banco: {pTxt(p, "Banco")}</p>
          <p>Tipo de cuenta: {pTxt(p, "TipoCuenta")}</p>
          <p>N de cuenta: {pTxt(p, "NumeroCuenta")}</p>
          <p>Correo: {pTxt(p, "CorreoConfirmacion")}</p>
        </div>
      </div>

      <div className="mt-5 text-[10px]">
        <span className="text-dorado-osc font-bold">DESPACHAR A:</span>{" "}
        {d.direccion_despacho}
      </div>
    </div>
  );
}

// Rotulo y valor en lineas propias: asi no quedan dos datos distintos pegados
// en el mismo renglon y se sabe que es cada cual. Un campo vacio se omite.
function Campo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="text-[10px] leading-snug">
      <span className="text-gray-500">{rotulo}:</span>{" "}
      <span className="text-[#1A1A1A]">{valor}</span>
    </div>
  );
}
