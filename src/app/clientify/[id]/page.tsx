import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_OPORTUNIDAD, ETAPAS } from "@/lib/clientify";
import { fecha, pesos } from "@/lib/formato";

export const dynamic = "force-dynamic";

const ESTADOS: Record<string, string> = {
  "cold-lead": "Lead frio",
  "warm-lead": "Lead tibio",
  "hot-lead": "Lead caliente",
  "in-deal": "Oportunidad",
  "not-qualified-lead": "Lead no calificado",
  "lost-lead": "Lead perdido",
  client: "Cliente",
  "lost-client": "Cliente perdido",
  visitor: "Visitante",
  other: "Otro",
};

const TIPOS: { patron: RegExp; texto: string }[] = [
  { patron: /^note/i, texto: "Nota" },
  { patron: /^call/i, texto: "Llamada" },
  { patron: /^meeting/i, texto: "Reunion" },
  { patron: /^(email|mail)/i, texto: "Email" },
  { patron: /^(sms|whatsapp)/i, texto: "Mensaje" },
];
const tipoLegible = (t: string) => TIPOS.find((x) => x.patron.test(t))?.texto ?? t;

interface Contacto {
  id_clientify: number;
  nombre: string | null;
  apellido: string | null;
  nombre_completo: string;
  telefonos: { phone?: string; whatsapp?: boolean }[];
  emails: { email?: string }[];
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
  pais: string | null;
  estado: string | null;
  origen: string | null;
  propietario: string | null;
  creado_clientify: string | null;
  empresa: string | null;
  cargo: string | null;
  observaciones: string | null;
}

interface CotizacionVinculada {
  id_cotizacion: number;
  folio: string;
  fecha: string;
  estado: string;
  total: number | null;
  via: "oportunidad" | "ficha";
  oportunidad: string | null;
  monto_oportunidad: number | null;
}

interface Oportunidad {
  id_clientify: number;
  nombre: string | null;
  monto: number | null;
  estado: number | null;
  id_etapa: number | null;
  creado_clientify: string | null;
}

interface Actividad {
  id: number;
  tipo: string;
  fecha: string;
  autor: string | null;
  titulo: string | null;
  texto: string | null;
}

const cuando = (f: string) =>
  new Date(f).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "short",
    timeStyle: "short",
  });

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-dorado-osc uppercase tracking-wide">
        {etiqueta}
      </dt>
      <dd className="text-sm mt-0.5 break-words">
        {children || <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idContacto = Number(id);
  if (!Number.isInteger(idContacto)) notFound();

  await requerirVendedor();
  const supabase = await createClient();

  const { data: contacto } = await supabase
    .from("clientify_contactos")
    .select(
      "id_clientify, nombre, apellido, nombre_completo, telefonos, emails, direccion, comuna, ciudad, region, pais, estado, origen, propietario, creado_clientify, empresa, cargo, observaciones"
    )
    .eq("id_clientify", idContacto)
    .maybeSingle();
  if (!contacto) notFound();
  const c = contacto as Contacto;

  const [{ data: cots }, { data: ops }, { data: acts }] = await Promise.all([
    supabase.rpc("clientify_cotizaciones_de", { p_contacto: idContacto }),
    supabase
      .from("clientify_oportunidades")
      .select("id_clientify, nombre, monto, estado, id_etapa, creado_clientify")
      .eq("id_contacto", idContacto)
      .order("creado_clientify", { ascending: false }),
    supabase
      .from("clientify_actividad")
      .select("id, tipo, fecha, autor, titulo, texto")
      .eq("id_contacto", idContacto)
      .order("fecha", { ascending: false })
      .limit(200),
  ]);
  const cotizaciones = (cots ?? []) as CotizacionVinculada[];
  const oportunidades = (ops ?? []) as Oportunidad[];
  const conversacion = (acts ?? []) as Actividad[];

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo={c.nombre_completo || "(sin nombre)"}
        subtitulo={[c.empresa, c.cargo].filter(Boolean).join(" · ") || "Lead de Clientify"}
      />
      <div className="max-w-screen-xl mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/clientify">
          <Link
            href="/clientify"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Lista de leads
          </Link>
        </BarraNavegacion>

        {/* Datos personales */}
        <section className="bg-white border border-gray-200 rounded overflow-hidden">
          <h2 className="bg-verde text-white text-[11px] font-semibold px-3 py-1">
            DATOS PERSONALES
          </h2>
          <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato etiqueta="Nombre">{c.nombre}</Dato>
            <Dato etiqueta="Apellido">{c.apellido}</Dato>
            <Dato etiqueta="Estado del lead">{c.estado ? (ESTADOS[c.estado] ?? c.estado) : ""}</Dato>
            <Dato etiqueta="Telefonos">
              {(c.telefonos ?? []).filter((t) => t.phone).length > 0 && (
                <ul className="space-y-0.5">
                  {c.telefonos
                    .filter((t) => t.phone)
                    .map((t, i) => (
                      <li key={i}>
                        {t.phone}
                        {t.whatsapp && (
                          <span className="ml-1.5 text-[10px] text-green-700 border border-green-300 rounded px-1">
                            WhatsApp
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </Dato>
            <Dato etiqueta="Emails">
              {(c.emails ?? []).filter((e) => e.email).length > 0 && (
                <ul className="space-y-0.5">
                  {c.emails
                    .filter((e) => e.email)
                    .map((e, i) => (
                      <li key={i}>{e.email}</li>
                    ))}
                </ul>
              )}
            </Dato>
            <Dato etiqueta="Origen del lead">{c.origen}</Dato>
            <Dato etiqueta="Direccion">{c.direccion}</Dato>
            <Dato etiqueta="Comuna">{c.comuna}</Dato>
            <Dato etiqueta="Ciudad">{c.ciudad}</Dato>
            <Dato etiqueta="Region / Provincia">{c.region}</Dato>
            <Dato etiqueta="Pais">{c.pais}</Dato>
            <Dato etiqueta="Creado en Clientify">
              {c.creado_clientify ? fecha(c.creado_clientify.slice(0, 10)) : ""}
            </Dato>
          </dl>
        </section>

        {/* Cotizaciones vinculadas */}
        <section className="bg-white border border-gray-200 rounded overflow-hidden">
          <h2 className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex justify-between">
            <span>COTIZACIONES VINCULADAS</span>
            <span className="font-normal">{cotizaciones.length}</span>
          </h2>
          {cotizaciones.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-400">
              Este contacto no tiene cotizaciones vinculadas. Se vinculan cuando el nombre de su
              oportunidad en Clientify lleva el folio (por ejemplo &quot;Maria Perez - COT00118&quot;).
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-crema text-dorado-osc">
                <tr>
                  <th className="text-left px-3 py-1 w-28">Fecha</th>
                  <th className="text-left px-3 py-1 w-28">Folio</th>
                  <th className="text-left px-3 py-1 w-28">Estado</th>
                  <th className="text-right px-3 py-1 w-32">Total</th>
                  <th className="text-left px-3 py-1">Vinculada por</th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map((q) => (
                  <tr key={q.id_cotizacion} className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-1 whitespace-nowrap">{fecha(q.fecha)}</td>
                    <td className="px-3 py-1 font-semibold">
                      {/* Se abre en otra pestana: la ficha del lead queda donde estaba. */}
                      <Link
                        href={`/cotizaciones/${q.id_cotizacion}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-verde underline"
                      >
                        {q.folio}
                      </Link>
                    </td>
                    <td className="px-3 py-1">{q.estado}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{pesos(q.total ?? 0)}</td>
                    <td className="px-3 py-1 text-gray-600">
                      {q.via === "oportunidad"
                        ? `Oportunidad "${q.oportunidad ?? ""}"`
                        : "Ficha de cliente enlazada"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Oportunidades del contacto en Clientify */}
        {oportunidades.length > 0 && (
          <section className="bg-white border border-gray-200 rounded overflow-hidden">
            <h2 className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex justify-between">
              <span>OPORTUNIDADES EN CLIENTIFY</span>
              <span className="font-normal">{oportunidades.length}</span>
            </h2>
            <table className="w-full text-xs">
              <thead className="bg-crema text-dorado-osc">
                <tr>
                  <th className="text-left px-3 py-1 w-28">Creada</th>
                  <th className="text-left px-3 py-1">Oportunidad</th>
                  <th className="text-left px-3 py-1 w-44">Etapa</th>
                  <th className="text-left px-3 py-1 w-24">Estado</th>
                  <th className="text-right px-3 py-1 w-32">Monto</th>
                </tr>
              </thead>
              <tbody>
                {oportunidades.map((o) => (
                  <tr key={o.id_clientify} className="border-t border-gray-100">
                    <td className="px-3 py-1 whitespace-nowrap">
                      {o.creado_clientify ? fecha(o.creado_clientify.slice(0, 10)) : ""}
                    </td>
                    <td className="px-3 py-1">{o.nombre}</td>
                    <td className="px-3 py-1">{o.id_etapa ? (ETAPAS[o.id_etapa] ?? "") : ""}</td>
                    <td className="px-3 py-1">
                      {o.estado ? (ESTADOS_OPORTUNIDAD[o.estado] ?? "") : ""}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">{pesos(o.monto ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Conversacion */}
        <section className="bg-white border border-gray-200 rounded overflow-hidden">
          <h2 className="bg-verde text-white text-[11px] font-semibold px-3 py-1 flex justify-between">
            <span>HISTORIAL DE CONVERSACION</span>
            <span className="font-normal">{conversacion.length + (c.observaciones ? 1 : 0)}</span>
          </h2>
          {c.observaciones && (
            <div className="px-4 py-3 border-b border-gray-100 bg-crema/40">
              <div className="text-xs font-semibold text-verde">Observaciones del contacto</div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap break-words text-gray-800">
                {c.observaciones}
              </p>
            </div>
          )}
          {conversacion.length === 0 ? (
            !c.observaciones && (
              <p className="px-4 py-6 text-center text-xs text-gray-400">
                No hay conversaciones cargadas para este contacto.
              </p>
            )
          ) : (
            <ol className="divide-y divide-gray-100">
              {conversacion.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                    <span className="font-semibold text-verde">{tipoLegible(a.tipo)}</span>
                    <span className="text-gray-500">{cuando(a.fecha)}</span>
                    {a.autor && <span className="text-gray-500">{a.autor}</span>}
                    {a.titulo && <span className="font-semibold">{a.titulo}</span>}
                  </div>
                  {a.texto && (
                    <p className="mt-1.5 text-sm whitespace-pre-wrap break-words text-gray-800">
                      {a.texto}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100">
            Notas, llamadas y correos registrados en Clientify. Los textos largos llegan recortados;
            el historial completo, incluidos los mensajes de WhatsApp del Team Inbox, vive en
            Clientify.
          </p>
        </section>
      </div>
    </div>
  );
}
