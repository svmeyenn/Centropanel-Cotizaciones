import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import EnvioDocumento from "@/components/EnvioDocumento";
import BotonReversar from "@/components/BotonReversar";
import { reversarEnvioSolicitud } from "@/app/necesidades/acciones";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { dinero, fecha as fmtFecha, monedaDelPais, unidades as fmtUnid } from "@/lib/formato";
import { COLOR_NM } from "@/lib/compras";
import { impuestoDelPais, porcentajeImpuesto, rotuloDescuento, subtotalLinea, totalesFactura } from "@/lib/factura";
import { textosOrden, textosSolicitud } from "@/lib/textosCompra";
import { enviarOcPorCorreo, enviarSolicitudPorCorreo, registrarEnvioOc, registrarEnvioSolicitud, reversarEnvioOc } from "@/app/necesidades/envios";

export const dynamic = "force-dynamic";

type Det = {
  nm: { id: number; folio: string; id_pais: number; proyecto: string | null; estado: string; fecha_requerida: string | null; direccion_destino: string | null; contacto_destino: string | null; telefono_destino: string | null; email_destino: string | null; puede_comprar: boolean; iva_pct: number };
  items: { id: number; orden: number; sku: string | null; descripcion: string; unidad: string | null; cantidad: number; id_sc: number | null }[];
  proveedores: {
    id: number;
    nombre: string;
    razon_social: string | null;
    rut: string | null;
    direccion: string | null;
    email: string | null;
    telefono: string | null;
    contacto: string | null;
    estado: string;
    moneda: string | null;
    plazo_dias: number | null;
    descuento_pct: number;
    condiciones_pago: string | null;
    validez: string | null;
    archivo_nombre: string | null;
    notas: string | null;
  }[];
  precios: { p: number; i: number; v: number }[];
  solicitudes: { id: number; folio: string; estado: string; fecha_entrega: string | null; direccion_destino: string | null; id_padre: number | null; id_participante: number | null; id_oc: number | null; num_oc: string | null }[];
};

const ESTADOS_OC_ENVIABLES = ["Aprobada", "Enviada", "Recibida parcial", "Recibida", "Facturada", "Pagada"];
const TH = "px-3 py-1.5 text-left font-semibold";

export default async function VistaProveedorNm({ idNm, idPart, modo }: { idNm: number; idPart: number; modo: "detalle" | "enviar" }) {
  const v = await requerirVendedor();
  if (!Number.isFinite(idNm) || !Number.isFinite(idPart)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nm_detalle", { p_nm: idNm });
  if (error || !data) notFound();
  const det = data as Det;
  const prov = det.proveedores.find((p) => p.id === idPart);
  if (!prov) notFound();

  const moneda = prov.moneda || monedaDelPais(Number(det.nm.id_pais));
  const precio = new Map(det.precios.filter((x) => x.p === idPart).map((x) => [x.i, Number(x.v)]));
  const solicitudes = det.solicitudes.filter((s) => s.estado !== "Abierta" && s.estado !== "Anulada");
  const idsOc = solicitudes.filter((s) => s.id_participante === idPart && s.id_oc).map((s) => s.id_oc as number);

  const [{ data: pais }, { data: ocs }, { data: envios }] = await Promise.all([
    supabase.from("paises").select("prefijo_telefono").eq("id", det.nm.id_pais).single(),
    idsOc.length
      ? supabase.from("ordenes_compra").select("id, num_oc, estado, total, moneda, fecha_entrega").in("id", idsOc)
      : Promise.resolve({ data: [] as { id: number; num_oc: string; estado: string; total: number; moneda: string; fecha_entrega: string | null }[] }),
    supabase
      .from("nm_envios")
      .select("id, tipo, id_sc, id_oc, canal, destino, asunto, id_vendedor, creado, reversado_en")
      .eq("id_necesidad", idNm)
      .eq("id_participante", idPart)
      .order("creado", { ascending: false })
      .limit(100),
  ]);
  const ocPor = new Map((ocs ?? []).map((o) => [Number(o.id), o]));
  const idsVend = [...new Set((envios ?? []).map((e) => e.id_vendedor).filter(Boolean))] as number[];
  const { data: vends } = idsVend.length ? await supabase.from("vendedores").select("id, nombre").in("id", idsVend) : { data: [] };
  const vendPor = new Map((vends ?? []).map((x) => [Number(x.id), x.nombre as string]));
  const prefijo = (pais?.prefijo_telefono as string | null) ?? "56";
  const comprador = det.nm.puede_comprar;
  const emisor = { nombre: v.nombre, cargo: v.cargo, email: v.email, telefono: v.telefono };
  const folioSc = new Map(det.solicitudes.map((s) => [s.id, s.folio]));
  const contacto = { nombre: prov.nombre, email: prov.email, telefono: prov.telefono };

  return (
    <div className="min-h-screen">
      <Cabecera titulo={prov.nombre} subtitulo={`${modo === "enviar" ? "Enviar documentos" : "Detalle"} del proveedor en ${det.nm.folio}`} />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4 text-xs">
        <BarraNavegacion volverA={`/necesidades/${idNm}`} />
        <div className="flex gap-2">
          <Link href={`/necesidades/${idNm}/proveedor/${idPart}`} className={`px-3 py-1 rounded font-semibold ${modo === "detalle" ? "bg-verde text-white" : "border border-gray-300 bg-white text-gray-800"}`}>
            Detalle
          </Link>
          {comprador && (
            <Link href={`/necesidades/${idNm}/proveedor/${idPart}/enviar`} className={`px-3 py-1 rounded font-semibold ${modo === "enviar" ? "bg-verde text-white" : "border border-gray-300 bg-white text-gray-800"}`}>
              Enviar
            </Link>
          )}
        </div>

        <section className="bg-white border border-gray-200 rounded p-3 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          <Dato rotulo="Proveedor" valor={prov.razon_social || prov.nombre} extra={prov.rut} />
          <Dato rotulo="Contacto" valor={prov.contacto} extra={[prov.email, prov.telefono].filter(Boolean).join(" | ")} />
          <Dato rotulo="Entrega en destino" valor={det.nm.fecha_requerida ? fmtFecha(det.nm.fecha_requerida) : "Por coordinar"} extra={[det.nm.direccion_destino, det.nm.contacto_destino ? `Recibe: ${det.nm.contacto_destino}` : "", [det.nm.telefono_destino, det.nm.email_destino].filter(Boolean).join(" | ")].filter(Boolean).join(" · ")} />
          <Dato
            rotulo="Su cotizacion"
            valor={prov.estado === "Respondio" ? "Respondio" : prov.estado === "Declino" ? "Declino" : "Pendiente"}
            extra={[prov.plazo_dias != null ? `${prov.plazo_dias} dias de plazo` : "", prov.condiciones_pago ?? "", prov.validez ? `valida hasta ${fmtFecha(prov.validez)}` : ""].filter(Boolean).join(" | ")}
          />
        </section>

        {solicitudes.length === 0 && <p className="text-gray-500">La necesidad aun no tiene solicitudes.</p>}

        {solicitudes.map((s) => {
          const items = det.items.filter((i) => i.id_sc === s.id);
          const suyo = s.id_participante === idPart;
          const sub = items.reduce((a, i) => a + (precio.has(i.id) ? subtotalLinea(Number(i.cantidad), precio.get(i.id)!, moneda) : 0), 0);
          const fac = totalesFactura(sub, { tipo: "pct", valor: Number(prov.descuento_pct ?? 0) }, Number(det.nm.iva_pct ?? 0), moneda);
          const sinPrecio = items.filter((i) => !precio.has(i.id)).length;
          const oc = suyo && s.id_oc ? ocPor.get(s.id_oc) : undefined;
          const base = `/necesidades/${idNm}/solicitud/${s.id}/${idPart}/pdf`;
          const t = textosSolicitud({ folio: s.folio, contacto: prov.contacto, proveedor: prov.nombre, fechaEntrega: s.fecha_entrega ?? det.nm.fecha_requerida, direccion: s.direccion_destino ?? det.nm.direccion_destino, recibe: { nombre: det.nm.contacto_destino, telefono: det.nm.telefono_destino, email: det.nm.email_destino }, emisor });
          const bloqueoSc = s.estado === "Adjudicada" ? "La solicitud ya esta adjudicada." : prov.estado === "Declino" ? "El proveedor declino." : null;
          const to = oc
            ? textosOrden({ numero: oc.num_oc, contacto: prov.contacto, proveedor: prov.nombre, fechaEntrega: oc.fecha_entrega ?? det.nm.fecha_requerida, direccion: det.nm.direccion_destino, recibe: { nombre: det.nm.contacto_destino, telefono: det.nm.telefono_destino, email: det.nm.email_destino }, emisor })
            : null;
          return (
            <section key={s.id} className="bg-white border border-gray-200 rounded">
              <header className="flex flex-wrap items-center gap-2 px-3 py-2 bg-crema border-b border-gray-200">
                <span className="font-semibold text-verde">{s.folio}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${COLOR_NM[s.estado] ?? "bg-gray-100 text-gray-700"}`}>{s.estado}</span>
                {s.estado === "Adjudicada" && <span>{suyo ? "Adjudicada a este proveedor" : "Adjudicada a otro proveedor"}</span>}
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  <a href={base} target="_blank" rel="noopener noreferrer" className="border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                    PDF de la solicitud
                  </a>
                  {comprador && modo === "enviar" && s.estado === "En cotizacion" && (
                    <BotonReversar
                      confirmacion={`Reversar el envio de ${s.folio}? Vuelve a borrador. Lo que ya se envio al proveedor no se puede retirar.`}
                      accion={reversarEnvioSolicitud.bind(null, idNm, s.id)}
                    />
                  )}
                  {comprador && modo === "enviar" && (
                    <EnvioDocumento
                      etiqueta="Enviar solicitud"
                      titulo={`Enviar ${s.folio}`}
                      proveedor={contacto}
                      prefijoTelefono={prefijo}
                      pdfUrl={base}
                      nombreArchivo={`${s.folio}.pdf`}
                      asunto={t.asunto}
                      cuerpo={t.cuerpo}
                      textoWhatsApp={t.whatsapp}
                      bloqueo={bloqueoSc}
                      enviarCorreo={enviarSolicitudPorCorreo.bind(null, idNm, s.id, idPart)}
                      registrar={registrarEnvioSolicitud.bind(null, idNm, s.id, idPart, s.estado)}
                      emailRemitente={v.email}
                    />
                  )}
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className={TH}>Item</th>
                      <th className={`${TH} w-20`}>Unidad</th>
                      <th className={`${TH} w-24 text-right`}>Cantidad</th>
                      <th className={`${TH} w-40 text-right`}>Precio de este proveedor</th>
                      <th className={`${TH} w-32 text-right`}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => {
                      const pr = precio.get(i.id);
                      return (
                        <tr key={i.id} className="border-t border-gray-100">
                          <td className="px-3 py-1.5">{i.sku && <span className="font-mono text-[10px] text-gray-500 mr-1.5">{i.sku}</span>}{i.descripcion}</td>
                          <td className="px-3 py-1.5">{i.unidad}</td>
                          <td className="px-3 py-1.5 text-right">{fmtUnid(i.cantidad)}</td>
                          <td className="px-3 py-1.5 text-right">{pr != null ? dinero(pr, moneda) : <span className="text-gray-400">sin precio</span>}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pr != null ? dinero(subtotalLinea(Number(i.cantidad), pr, moneda), moneda) : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {[
                      ["Subtotal", dinero(fac.subtotal, moneda)],
                      [rotuloDescuento({ tipo: "pct", valor: Number(prov.descuento_pct ?? 0) }), fac.descuento > 0 ? `- ${dinero(fac.descuento, moneda)}` : dinero(0, moneda)],
                      ["Subtotal despues del descuento", dinero(fac.subtotalNeto, moneda)],
                      [`${impuestoDelPais(Number(det.nm.id_pais))} ${porcentajeImpuesto(Number(det.nm.iva_pct ?? 0))}`, dinero(fac.iva, moneda)],
                    ].map(([r, v], i) => (
                      <tr key={r} className={i === 0 ? "border-t-2 border-gray-300" : ""}>
                        <td colSpan={4} className="px-3 py-1 text-right text-gray-600">{r}</td>
                        <td className="px-3 py-1 text-right tabular-nums">{v}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td colSpan={4} className="px-3 py-1.5 text-right">
                        TOTAL A PAGAR {sinPrecio > 0 ? `(faltan ${sinPrecio} precios)` : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{dinero(fac.total, moneda)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {oc && to && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-gray-200">
                  <span className="font-semibold">Orden de compra</span>
                  <Link href={`/compras/${oc.id}`} className="text-verde underline">
                    {oc.num_oc}
                  </Link>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-semibold">{oc.estado}</span>
                  <span>{dinero(Number(oc.total), oc.moneda)}</span>
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    <a href={`/compras/${oc.id}/pdf/archivo`} target="_blank" rel="noopener noreferrer" className="border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                      PDF de la orden
                    </a>
                    {comprador && modo === "enviar" && oc.estado === "Enviada" && (
                      <BotonReversar
                        confirmacion={`Reversar el envio de ${oc.num_oc}? Vuelve a Aprobada. Lo que ya se envio al proveedor no se puede retirar.`}
                        accion={reversarEnvioOc.bind(null, oc.id)}
                      />
                    )}
                    {comprador && modo === "enviar" && (
                      <EnvioDocumento
                        etiqueta="Enviar orden"
                        titulo={`Enviar ${oc.num_oc}`}
                        proveedor={contacto}
                        prefijoTelefono={prefijo}
                        pdfUrl={`/compras/${oc.id}/pdf/archivo`}
                        nombreArchivo={`${oc.num_oc}.pdf`}
                        asunto={to.asunto}
                        cuerpo={to.cuerpo}
                        textoWhatsApp={to.whatsapp}
                        bloqueo={ESTADOS_OC_ENVIABLES.includes(oc.estado) ? null : `La orden esta ${oc.estado.toLowerCase()}: se envia una vez aprobada.`}
                        enviarCorreo={enviarOcPorCorreo.bind(null, oc.id)}
                        registrar={registrarEnvioOc.bind(null, oc.id)}
                        emailRemitente={v.email}
                      />
                    )}
                  </span>
                </div>
              )}
            </section>
          );
        })}

        {modo === "enviar" && (
        <section className="bg-white border border-gray-200 rounded">
          <h2 className="px-3 py-2 font-semibold text-verde border-b border-gray-200">Lo enviado a este proveedor</h2>
          {(envios ?? []).length === 0 ? (
            <p className="px-3 py-3 text-gray-500">Todavia no se le ha enviado nada.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className={TH}>Fecha</th>
                  <th className={TH}>Documento</th>
                  <th className={TH}>Canal</th>
                  <th className={TH}>Destino</th>
                  <th className={TH}>Enviado por</th>
                </tr>
              </thead>
              <tbody>
                {(envios ?? []).map((e) => (
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {new Date(e.creado as string).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-1.5">
                      {e.tipo === "OC" ? `Orden de compra ${e.id_oc ? (ocPor.get(Number(e.id_oc))?.num_oc ?? "") : ""}` : `Solicitud ${folioSc.get(Number(e.id_sc)) ?? ""}`}
                    </td>
                    <td className="px-3 py-1.5">{e.canal === "email" ? "Correo" : "WhatsApp"}{e.reversado_en ? <span className="ml-1.5 px-1.5 rounded bg-gray-200 text-gray-600 text-[10px] font-semibold">Reversado</span> : null}</td>
                    <td className="px-3 py-1.5">{e.destino}</td>
                    <td className="px-3 py-1.5">{vendPor.get(Number(e.id_vendedor)) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        )}
      </div>
    </div>
  );
}

function Dato({ rotulo, valor, extra }: { rotulo: string; valor?: string | null; extra?: string | null }) {
  return (
    <div>
      <span className="block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5">{rotulo}</span>
      <div className="font-semibold">{valor || "—"}</div>
      {extra ? <div className="text-gray-600">{extra}</div> : null}
    </div>
  );
}
