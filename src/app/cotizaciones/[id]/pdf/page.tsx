import { notFound } from "next/navigation";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerParametros, pTxt, pNum } from "@/lib/parametros";
import { pesos, unidades as fmtUnid, fecha as fmtFecha, sumarDias } from "@/lib/formato";
import BotonImprimir from "./BotonImprimir";

// Replica de rptCotizacion. Se imprime desde el navegador (Ctrl+P -> Guardar
// como PDF) en vez de generar el binario en el servidor: Vercel hobby no
// sostiene bien Puppeteer/Chromium, y asi el documento es ademas seleccionable.
export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();

  const [{ data: cot }, { data: items }, { data: tot }, p] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select(
        "*, clientes(razon_social, rut, contacto, email, telefono), vendedores(nombre, cargo, email, telefono), formas_pago(descripcion)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("cotizacion_detalle")
      .select("*")
      .eq("id_cotizacion", id)
      .order("orden"),
    supabase.from("v_cotizacion_totales").select("*").eq("id", id).single(),
    leerParametros(),
  ]);

  if (!cot) notFound();

  // PostgREST devuelve la relacion como objeto o como arreglo segun la
  // cardinalidad que infiera del esquema; se normaliza a un solo registro.
  type CliRel = {
    razon_social: string | null;
    rut: string | null;
    contacto: string | null;
    email: string | null;
    telefono: string | null;
  };
  type VenRel = {
    nombre: string | null;
    cargo: string | null;
    email: string | null;
    telefono: string | null;
  };
  type FpRel = { descripcion: string | null };

  function uno<T>(x: T | T[] | null | undefined): T | null {
    if (Array.isArray(x)) return x[0] ?? null;
    return x ?? null;
  }

  const cli = uno<CliRel>(cot.clientes as CliRel | CliRel[] | null);
  const ven = uno<VenRel>(cot.vendedores as VenRel | VenRel[] | null);
  const fp = uno<FpRel>(cot.formas_pago as FpRel | FpRel[] | null);

  const subtotal = Number(tot?.subtotal ?? 0);
  const descuento = Number(tot?.descuento_monto ?? 0);
  const totalNeto = Number(tot?.total_neto ?? 0);
  const iva = Number(tot?.iva ?? 0);
  const total = Number(tot?.total ?? 0);
  const vence = sumarDias(
    (cot.fecha as string).slice(0, 10),
    cot.validez_dias ?? 7
  );

  return (
    <div className="bg-white min-h-screen">
      <BotonImprimir idCotizacion={id} />

      <div className="mx-auto bg-white text-[#1A1A1A] p-10 max-w-[820px] print:p-0 print:max-w-none">
        {/* ---- cabecera: marca a la izquierda, folio en el bloque verde ---- */}
        <div className="flex justify-between items-start gap-6 mb-6">
          <div>
            <div className="text-2xl font-bold text-verde leading-tight">
              {pTxt(p, "EmpresaMarca")}
            </div>
            <div className="text-xs text-gray-600">{pTxt(p, "EmpresaGiro")}</div>
            <div className="text-xs text-gray-600">
              {pTxt(p, "EmpresaDireccion")}
            </div>
          </div>
          <div className="bg-verde text-white px-5 py-3 text-right min-w-[280px]">
            <div className="text-2xl font-bold leading-tight">
              {cot.num_cotizacion}
            </div>
            <div className="text-[11px] text-dorado">
              {pTxt(p, "EmpresaNombre")} &nbsp; RUT {pTxt(p, "EmpresaRUT")}
            </div>
            <div className="text-[11px]">
              Emitida {fmtFecha(cot.fecha as string)} &nbsp; Vence {fmtFecha(vence)}
            </div>
          </div>
        </div>

        {/* ---- cliente / ejecutivo ---- */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="bg-crema text-dorado-osc text-[11px] font-bold px-2 py-1 mb-1">
              CLIENTE
            </div>
            <div className="text-sm font-bold">{cli?.razon_social}</div>
            <div className="text-xs text-gray-600">
              {cli?.rut ? `RUT ${cli.rut}` : ""}
              {cli?.contacto ? ` - ${cli.contacto}` : ""}
            </div>
            <div className="text-xs text-gray-600">
              {[cli?.email, cli?.telefono].filter(Boolean).join(" - ")}
            </div>
          </div>
          <div>
            <div className="bg-crema text-dorado-osc text-[11px] font-bold px-2 py-1 mb-1">
              EJECUTIVO
            </div>
            <div className="text-sm font-bold">{ven?.nombre}</div>
            <div className="text-xs text-gray-600">{ven?.email}</div>
            <div className="text-xs text-gray-600">{ven?.telefono}</div>
          </div>
        </div>

        {/* ---- items ---- */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-verde text-white text-[11px]">
              <th className="text-left px-2 py-1.5">DESCRIPCION</th>
              <th className="text-right px-2 py-1.5 w-16">UNID.</th>
              <th className="text-right px-2 py-1.5 w-28">V. UNITARIO</th>
              <th className="text-right px-2 py-1.5 w-32">SUBTOTAL NETO</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it, i) => (
              <tr key={it.id as number} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="px-2 py-1.5">{it.descripcion}</td>
                <td className="px-2 py-1.5 text-right">{fmtUnid(it.unidades)}</td>
                <td className="px-2 py-1.5 text-right">{pesos(it.valor_unitario)}</td>
                <td className="px-2 py-1.5 text-right">
                  {pesos(Number(it.unidades) * Number(it.valor_unitario))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- totales ---- */}
        <div className="flex justify-end mb-6">
          <table className="text-sm">
            <tbody>
              <tr>
                <td className="text-right pr-6 py-0.5">SUBTOTAL</td>
                <td className="text-right py-0.5 w-32">{pesos(subtotal)}</td>
              </tr>
              {/* La linea de descuento no se imprime cuando es cero, igual que
                  el IIf(Nz([DescuentoMonto],0)=0,Null,...) del informe. */}
              {descuento > 0 && (
                <tr>
                  <td className="text-right pr-6 py-0.5">DESCUENTO</td>
                  <td className="text-right py-0.5">{pesos(descuento)}</td>
                </tr>
              )}
              <tr className="font-bold">
                <td className="text-right pr-6 py-0.5">TOTAL NETO</td>
                <td className="text-right py-0.5">{pesos(totalNeto)}</td>
              </tr>
              <tr>
                <td className="text-right pr-6 py-0.5">
                  IVA {Math.round(pNum(p, "IVA", 0.19) * 100)}%
                </td>
                <td className="text-right py-0.5">{pesos(iva)}</td>
              </tr>
              <tr className="bg-verde text-white font-bold">
                <td className="text-right pr-6 py-1.5">TOTAL</td>
                <td className="text-right py-1.5 pr-2">{pesos(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ---- pie: condiciones y datos bancarios ---- */}
        <div className="grid grid-cols-2 gap-6 text-[11px] leading-relaxed">
          <div>
            <div className="text-dorado-osc font-bold mb-1">
              CONDICIONES COMERCIALES
            </div>
            <p>
              Validez de la cotizacion: {cot.validez_dias} dias corridos (vence el{" "}
              {fmtFecha(vence)}).
            </p>
            <p>Medio de pago: {pTxt(p, "MedioPagoDefecto")}</p>
            {fp?.descripcion && <p>Forma de pago: {fp.descripcion}</p>}
            {cot.tiempo_entrega && <p>Tiempo de entrega: {cot.tiempo_entrega}</p>}
            <p>Tarifas: {pTxt(p, "NotaTarifas")}</p>
            <p>{pTxt(p, "NotaBodegaje")}</p>
            <p>{pTxt(p, "CondDescarga")}</p>
          </div>
          <div>
            <div className="text-dorado-osc font-bold mb-1">
              DATOS PARA EL DEPOSITO
            </div>
            <p>{pTxt(p, "EmpresaNombre")}</p>
            <p>RUT: {pTxt(p, "EmpresaRUT")}</p>
            <p>Banco: {pTxt(p, "Banco")}</p>
            <p>Tipo de cuenta: {pTxt(p, "TipoCuenta")}</p>
            <p>N de cuenta: {pTxt(p, "NumeroCuenta")}</p>
            <p>Correo: {pTxt(p, "CorreoConfirmacion")}</p>
          </div>
        </div>

        <div className="mt-6 text-[11px]">
          <span className="text-dorado-osc font-bold">DESPACHAR A:</span>{" "}
          {cot.direccion_despacho}
        </div>
      </div>
    </div>
  );
}
