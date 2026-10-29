import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import EnvioDocumento from "@/components/EnvioDocumento";
import BotonReversar from "@/components/BotonReversar";
import ExcluirItemsProveedor from "@/components/ExcluirItemsProveedor";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { fecha as fmtFecha } from "@/lib/formato";
import { COLOR_NM, etiquetaProyecto } from "@/lib/compras";
import { textosSolicitud } from "@/lib/textosCompra";
import { numerosSolicitud } from "@/lib/numerosSolicitud";
import { reversarEnvioSolicitud } from "@/app/necesidades/acciones";
import { enviarSolicitudPorCorreo, registrarEnvioSolicitud } from "@/app/necesidades/envios";

export const dynamic = "force-dynamic";

type Det = {
  nm: { id: number; folio: string; proyecto: string | null; proyecto_cliente?: string | null; id_pais: number; fecha_requerida: string | null; direccion_destino: string | null; modalidad_entrega?: "Despacho" | "Retiro"; contacto_destino: string | null; telefono_destino: string | null; email_destino: string | null; puede_comprar: boolean };
  items: { id: number; id_sc: number | null; sku: string | null; descripcion: string; unidad: string | null; cantidad: number; orden: number }[];
  precios: { p: number; i: number }[];
  excluidos?: { p: number; i: number }[];
  forzados?: { p: number; i: number }[];
  maestra: { p: number; i: number; c: number; m: string | null }[];
  proveedores: { id: number; nombre: string; direccion?: string | null; email: string | null; telefono: string | null; contacto: string | null; estado: string }[];
  solicitudes: { id: number; folio: string; estado: string; fecha_entrega: string | null; direccion_destino: string | null; id_participante: number | null }[];
};

const TH = "px-3 py-1.5 text-left font-semibold";

// Una solicitud y sus proveedores: el PDF de cada uno y su envio por correo o WhatsApp.
export default async function Pagina({ params }: { params: Promise<{ id: string; idSc: string }> }) {
  const v = await requerirVendedor();
  const { id, idSc: scTxt } = await params;
  const idNm = Number(id);
  const idSc = Number(scTxt);
  if (!Number.isFinite(idNm) || !Number.isFinite(idSc)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nm_detalle", { p_nm: idNm });
  if (error || !data) notFound();
  const det = data as Det;
  const sc = det.solicitudes.find((s) => s.id === idSc);
  if (!sc) notFound();
  const comprador = det.nm.puede_comprar;
  const items = det.items.filter((i) => i.id_sc === idSc).length;
  const itemsSc = new Set(det.items.filter((i) => i.id_sc === idSc).map((i) => i.id));
  const excluidosDe = new Set((det.excluidos ?? []).map((x) => `${x.p}:${x.i}`));
  const forzadosDe = new Set((det.forzados ?? []).map((x) => `${x.p}:${x.i}`));
  const cotizados = new Set((det.precios ?? []).map((x) => `${x.p}:${x.i}`));
  const editable = comprador && (sc.estado === "Borrador" || sc.estado === "En cotizacion");

  const [{ data: pais }, { data: envios }] = await Promise.all([
    supabase.from("paises").select("prefijo_telefono").eq("id", det.nm.id_pais).single(),
    supabase.from("nm_envios").select("id_participante, canal, creado, reversado_en").eq("id_necesidad", idNm).eq("id_sc", idSc).eq("tipo", "SC").order("creado", { ascending: false }),
  ]);
  const prefijo = (pais?.prefijo_telefono as string | null) ?? "56";
  const ultimo = new Map<number, { canal: string; creado: string; reversado: boolean }>();
  for (const e of envios ?? []) {
    const k = Number(e.id_participante);
    if (!ultimo.has(k)) ultimo.set(k, { canal: e.canal as string, creado: e.creado as string, reversado: Boolean(e.reversado_en) });
  }
  const emisor = { nombre: v.nombre, cargo: v.cargo, email: v.email, telefono: v.telefono };
  const fechaEntrega = sc.fecha_entrega ?? det.nm.fecha_requerida;
  const direccion = sc.direccion_destino ?? det.nm.direccion_destino;
  const proveedores = det.proveedores.filter((p) => p.estado !== "Declino");
  // Cada solicitud que sale a un proveedor lleva su propio numero.
  // Al proveedor que se saco de la solicitud no se le asigna numero.
  const sacado = (idPart: number) => [...itemsSc].some((i) => excluidosDe.has(`${idPart}:${i}`)) && !(det.maestra ?? []).some((x) => x.p === idPart && itemsSc.has(x.i));
  const numeros = await numerosSolicitud(proveedores.filter((p) => !sacado(p.id)).map((p) => ({ idSc, idPart: p.id })), comprador);
  const bloqueo = sc.estado === "Adjudicada" ? "La solicitud ya esta adjudicada." : sc.estado === "Anulada" ? "La solicitud esta anulada." : null;

  return (
    <div className="min-h-screen">
      <Cabecera titulo={[sc.folio, etiquetaProyecto(det.nm.proyecto, det.nm.proyecto_cliente)].filter(Boolean).join(" · ")} subtitulo={`Solicitud de cotizacion de ${det.nm.folio}`} />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4 text-xs">
        <BarraNavegacion volverA={`/necesidades/${idNm}`} />
        <section className="bg-white border border-gray-200 rounded p-3 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${COLOR_NM[sc.estado] ?? "bg-gray-100 text-gray-700"}`}>{sc.estado}</span>
          <span>{items} item{items === 1 ? "" : "s"}</span>
          <span>Entrega: {fechaEntrega ? fmtFecha(fechaEntrega) : "por coordinar"}</span>
          <span>Destino: {direccion ?? "por informar"}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <a href={`/necesidades/${idNm}/solicitud/${idSc}/0/pdf`} target="_blank" rel="noopener noreferrer" className="border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded">
              PDF sin destinatario
            </a>
            {comprador && sc.estado === "En cotizacion" && (
              <BotonReversar
                confirmacion={`Reversar el envio de ${sc.folio}? Vuelve a borrador. Lo que ya se envio a los proveedores no se puede retirar.`}
                accion={reversarEnvioSolicitud.bind(null, idNm, idSc)}
              />
            )}
          </span>
        </section>

        <section className="bg-white border border-gray-200 rounded overflow-x-auto">
          <h2 className="px-3 py-2 font-semibold text-verde border-b border-gray-200">Proveedores invitados</h2>
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className={TH}>N° de solicitud</th>
                <th className={TH}>Proveedor</th>
                <th className={TH}>Items que cubre</th>
                <th className={TH}>Correo</th>
                <th className={TH}>Telefono</th>
                <th className={TH}>Ultimo envio</th>
                <th className="w-64" />
              </tr>
            </thead>
            <tbody>
              {proveedores.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                    Invite proveedores en la <Link href={`/necesidades/${idNm}`} className="text-verde underline">necesidad</Link> para poder enviarles la solicitud.
                  </td>
                </tr>
              )}
              {proveedores.map((p) => {
                const u = ultimo.get(p.id);
                const out = sacado(p.id);
                const num = out ? "—" : numeros.get(`${idSc}:${p.id}`) ?? sc.folio;
                const nExcl = [...itemsSc].filter((i) => excluidosDe.has(`${p.id}:${i}`)).length;
                // Cada proveedor recibe solo los items que tiene asignados en su maestra.
                const cubre = (det.maestra ?? []).filter((x) => x.p === p.id && itemsSc.has(x.i)).length;
                const t = textosSolicitud({ folio: num, contacto: p.contacto, proveedor: p.nombre, fechaEntrega, direccion, modalidad: det.nm.modalidad_entrega, direccionProveedor: (p as { direccion?: string | null }).direccion ?? null, recibe: { nombre: det.nm.contacto_destino, telefono: det.nm.telefono_destino, email: det.nm.email_destino }, emisor });
                const base = `/necesidades/${idNm}/solicitud/${idSc}/${p.id}/pdf`;
                return (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 font-mono font-semibold">{num}</td>
                    <td className="px-3 py-1.5 font-semibold">{p.nombre}</td>
                    <td className={`px-3 py-1.5 ${cubre === 0 ? "text-red-700" : ""}`}>
                      {out ? "Fuera de esta solicitud" : `${cubre} de ${itemsSc.size}`}
                      {!out && nExcl > 0 && <span className="block text-[10px] text-gray-500">{nExcl} excluido{nExcl === 1 ? "" : "s"} a mano</span>}
                    </td>
                    <td className="px-3 py-1.5">{p.email ?? <span className="text-gray-400">sin correo</span>}</td>
                    <td className="px-3 py-1.5">{p.telefono ?? <span className="text-gray-400">sin telefono</span>}</td>
                    <td className="px-3 py-1.5">
                      {u ? `${u.canal === "email" ? "Correo" : "WhatsApp"} · ${new Date(u.creado).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" })}${u.reversado ? " (reversado)" : ""}` : <span className="text-gray-400">no enviada</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap space-x-1.5">
                      {!out && (
                        <a href={base} target="_blank" rel="noopener noreferrer" className="border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                          PDF
                        </a>
                      )}
                      {editable && (
                        <ExcluirItemsProveedor
                          idNm={idNm}
                          idPart={p.id}
                          proveedor={p.nombre}
                          folio={sc.folio}
                          items={det.items
                            .filter((i) => i.id_sc === idSc)
                            .sort((a, b) => a.orden - b.orden)
                            .map((i) => ({
                              id: i.id,
                              sku: i.sku,
                              descripcion: i.descripcion,
                              unidad: i.unidad,
                              cantidad: Number(i.cantidad),
                              asignado: ((det.maestra ?? []).some((x) => x.p === p.id && x.i === i.id) && !forzadosDe.has(`${p.id}:${i.id}`)) || excluidosDe.has(`${p.id}:${i.id}`),
                              excluido: excluidosDe.has(`${p.id}:${i.id}`),
                              forzado: forzadosDe.has(`${p.id}:${i.id}`),
                              cotizado: cotizados.has(`${p.id}:${i.id}`),
                            }))}
                        />
                      )}
                      {comprador && !out && (
                        <EnvioDocumento
                          etiqueta="Enviar"
                          titulo={`Enviar ${num}`}
                          proveedor={{ nombre: p.nombre, email: p.email, telefono: p.telefono }}
                          prefijoTelefono={prefijo}
                          pdfUrl={base}
                          nombreArchivo={`${num}.pdf`}
                          asunto={t.asunto}
                          cuerpo={t.cuerpo}
                          textoWhatsApp={t.whatsapp}
                          bloqueo={cubre === 0 ? "No tiene asignado ningun item de esta solicitud en su maestra." : bloqueo}
                          enviarCorreo={enviarSolicitudPorCorreo.bind(null, idNm, idSc, p.id)}
                          registrar={registrarEnvioSolicitud.bind(null, idNm, idSc, p.id, sc.estado)}
                          emailRemitente={v.email}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
