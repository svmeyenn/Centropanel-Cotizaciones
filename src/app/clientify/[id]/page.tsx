import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonCotizarLead from "@/components/BotonCotizarLead";
import HistorialLead, { type EntradaHistorial } from "@/components/HistorialLead";
import { administraUsuarios, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_OPORTUNIDAD, ETAPAS } from "@/lib/clientify";
import { fecha, hoyISO, pesos } from "@/lib/formato";

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

// Letra chica para toda la ficha: es una pantalla de consulta con mucho dato.
const TITULO = "bg-verde text-white text-[10px] font-semibold px-3 py-0.5 flex justify-between";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold text-dorado-osc uppercase tracking-wide">
        {etiqueta}
      </dt>
      <dd className="text-[11px] mt-0.5 break-words">
        {children || <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idContacto = Number(id);
  if (!Number.isInteger(idContacto)) notFound();

  const v = await requerirVendedor();
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

  const [{ data: cots }, { data: ops }, { data: acts }, { data: hist }, { data: equipoDb }] =
    await Promise.all([
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
      supabase.rpc("clientify_historial_de", { p_contacto: idContacto }),
      supabase.from("vendedores").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
  const cotizaciones = (cots ?? []) as CotizacionVinculada[];
  const oportunidades = (ops ?? []) as Oportunidad[];
  const notasClientify = (acts ?? []) as Actividad[];
  const historial = (hist ?? []) as EntradaHistorial[];
  const equipo = (equipoDb ?? []) as { id: number; nombre: string }[];

  const puedeCotizar = v.puede_crear || tienePerfilAdmin(v);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo={c.nombre_completo || "(sin nombre)"}
        subtitulo={[c.empresa, c.cargo].filter(Boolean).join(" · ") || "Lead de Clientify"}
      />
      <div className="max-w-screen-xl mx-auto p-4 space-y-3 text-[11px]">
        <BarraNavegacion volverA="/clientify">
          <Link
            href="/clientify"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Lista de leads
          </Link>
          {puedeCotizar && <BotonCotizarLead idLead={c.id_clientify} />}
        </BarraNavegacion>

        {/* Datos personales */}
        <section className="bg-white border border-gray-200 rounded overflow-hidden">
          <h2 className={TITULO}>DATOS PERSONALES</h2>
          <dl className="grid gap-x-5 gap-y-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dato etiqueta="Nombre">{c.nombre}</Dato>
            <Dato etiqueta="Apellido">{c.apellido}</Dato>
            <Dato etiqueta="Estado del lead">{c.estado ? (ESTADOS[c.estado] ?? c.estado) : ""}</Dato>
            <Dato etiqueta="Origen del lead">{c.origen}</Dato>
            <Dato etiqueta="Telefonos">
              {(c.telefonos ?? []).filter((t) => t.phone).length > 0 && (
                <ul className="space-y-0.5">
                  {c.telefonos
                    .filter((t) => t.phone)
                    .map((t, i) => (
                      <li key={i}>
                        {t.phone}
                        {t.whatsapp && (
                          <span className="ml-1.5 text-[9px] text-green-700 border border-green-300 rounded px-1">
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
            <Dato etiqueta="Propietario">{c.propietario}</Dato>
            <Dato etiqueta="Creado en Clientify">
              {c.creado_clientify ? fecha(c.creado_clientify.slice(0, 10)) : ""}
            </Dato>
            <Dato etiqueta="Direccion">{c.direccion}</Dato>
            <Dato etiqueta="Comuna">{c.comuna}</Dato>
            <Dato etiqueta="Ciudad">{c.ciudad}</Dato>
            <Dato etiqueta="Region / Provincia">{c.region}</Dato>
            <Dato etiqueta="Pais">{c.pais}</Dato>
          </dl>
        </section>

        {/* Cotizaciones vinculadas */}
        <section className="bg-white border border-gray-200 rounded overflow-hidden">
          <h2 className={TITULO}>
            <span>COTIZACIONES VINCULADAS</span>
            <span className="font-normal">{cotizaciones.length}</span>
          </h2>
          {cotizaciones.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-gray-400">
              Este lead no tiene cotizaciones vinculadas. Use &quot;Crear cotizacion&quot; para hacerle
              una, o ponga el folio en el nombre de su oportunidad en Clientify (por ejemplo
              &quot;Maria Perez - COT00118&quot;).
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-crema text-dorado-osc">
                <tr>
                  <th className="text-left px-3 py-0.5 w-24">Fecha</th>
                  <th className="text-left px-3 py-0.5 w-24">Folio</th>
                  <th className="text-left px-3 py-0.5 w-24">Estado</th>
                  <th className="text-right px-3 py-0.5 w-28">Total</th>
                  <th className="text-left px-3 py-0.5">Vinculada por</th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map((q) => (
                  <tr key={q.id_cotizacion} className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-0.5 whitespace-nowrap">{fecha(q.fecha)}</td>
                    <td className="px-3 py-0.5 font-semibold">
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
                    <td className="px-3 py-0.5">{q.estado}</td>
                    <td className="px-3 py-0.5 text-right tabular-nums">{pesos(q.total ?? 0)}</td>
                    <td className="px-3 py-0.5 text-gray-600">
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
            <h2 className={TITULO}>
              <span>OPORTUNIDADES EN CLIENTIFY</span>
              <span className="font-normal">{oportunidades.length}</span>
            </h2>
            <table className="w-full text-[11px]">
              <thead className="bg-crema text-dorado-osc">
                <tr>
                  <th className="text-left px-3 py-0.5 w-24">Creada</th>
                  <th className="text-left px-3 py-0.5">Oportunidad</th>
                  <th className="text-left px-3 py-0.5 w-44">Etapa</th>
                  <th className="text-left px-3 py-0.5 w-20">Estado</th>
                  <th className="text-right px-3 py-0.5 w-28">Monto</th>
                </tr>
              </thead>
              <tbody>
                {oportunidades.map((o) => (
                  <tr key={o.id_clientify} className="border-t border-gray-100">
                    <td className="px-3 py-0.5 whitespace-nowrap">
                      {o.creado_clientify ? fecha(o.creado_clientify.slice(0, 10)) : ""}
                    </td>
                    <td className="px-3 py-0.5">{o.nombre}</td>
                    <td className="px-3 py-0.5">{o.id_etapa ? (ETAPAS[o.id_etapa] ?? "") : ""}</td>
                    <td className="px-3 py-0.5">
                      {o.estado ? (ESTADOS_OPORTUNIDAD[o.estado] ?? "") : ""}
                    </td>
                    <td className="px-3 py-0.5 text-right tabular-nums">{pesos(o.monto ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Conversaciones y compromisos */}
        <section className="bg-white border border-gray-200 rounded overflow-hidden">
          <h2 className={TITULO}>
            <span>CONVERSACIONES Y COMPROMISOS</span>
          </h2>
          <HistorialLead
            idLead={c.id_clientify}
            entradas={historial}
            hoy={hoyISO()}
            puedeEscribir={v.puede_editar}
            puedeEditarCompromiso={administraUsuarios(v)}
            equipo={equipo}
            yo={v.id}
          />
        </section>

        {/* Lo que el equipo dejo anotado en Clientify */}
        {(c.observaciones || notasClientify.length > 0) && (
          <section className="bg-white border border-gray-200 rounded overflow-hidden">
            <h2 className={TITULO}>
              <span>ANOTADO EN CLIENTIFY</span>
              <span className="font-normal">{notasClientify.length + (c.observaciones ? 1 : 0)}</span>
            </h2>
            {c.observaciones && (
              <div className="px-3 py-2 border-b border-gray-100 bg-crema/40">
                <div className="text-[11px] font-semibold text-verde">Observaciones del contacto</div>
                <p className="mt-1 text-[11px] whitespace-pre-wrap break-words text-gray-800">
                  {c.observaciones}
                </p>
              </div>
            )}
            {notasClientify.length > 0 && (
              <ol className="divide-y divide-gray-100">
                {notasClientify.map((a) => (
                  <li key={a.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                      <span className="font-semibold text-verde">{tipoLegible(a.tipo)}</span>
                      <span className="text-gray-500">{cuando(a.fecha)}</span>
                      {a.autor && <span className="text-gray-500">{a.autor}</span>}
                      {a.titulo && <span className="font-semibold">{a.titulo}</span>}
                    </div>
                    {a.texto && (
                      <p className="mt-1 text-[11px] whitespace-pre-wrap break-words text-gray-800">
                        {a.texto}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="px-3 py-1.5 text-[10px] text-gray-500 border-t border-gray-100">
              Lo registrado en Clientify. Los textos largos llegan recortados; el historial completo,
              con los mensajes de WhatsApp, vive en Clientify.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
