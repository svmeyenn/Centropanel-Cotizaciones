import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonCotizarLead from "@/components/BotonCotizarLead";
import FichaLead, { type DatosFicha } from "@/components/FichaLead";
import ControlEspera from "@/components/ControlEspera";
import MensajeLead from "@/components/MensajeLead";
import FusionLead from "@/components/FusionLead";
import EnlacesInicio from "@/components/EnlacesInicio";
import type { Plantilla } from "@/lib/mensajes";
import { leerEspera } from "@/lib/espera";
import HistorialLead, { type EntradaHistorial } from "@/components/HistorialLead";
import RegistrosEstado from "@/components/RegistrosEstado";
import ProyectoCasa, { type DatosCasaGuardados } from "@/components/ProyectoCasa";
import ArchivosLead, { type ArchivoLead } from "@/components/ArchivosLead";
import { QuitarVinculo, VincularCotizacionALead } from "@/components/VincularLead";
import { administraUsuarios, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_OPORTUNIDAD, ETAPAS } from "@/lib/clientify";
import { dinero, fecha, hoyISO, primerNombre } from "@/lib/formato";
import { LINEAS, puedeEscribirLeads, type Linea } from "@/lib/leads";
import { etiquetaDe, type Estado } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";

export const dynamic = "force-dynamic";

const TIPOS: { patron: RegExp; texto: string }[] = [
  { patron: /^note/i, texto: "Nota" },
  { patron: /^call/i, texto: "Llamada" },
  { patron: /^meeting/i, texto: "Reunion" },
  { patron: /^(email|mail)/i, texto: "Email" },
  { patron: /^(sms|whatsapp)/i, texto: "Mensaje" },
];
const tipoLegible = (t: string) => TIPOS.find((x) => x.patron.test(t))?.texto ?? t;

interface Contacto extends DatosFicha {
  nombre_completo: string;
  observaciones: string | null;
}

interface CotizacionVinculada {
  id_cotizacion: number;
  folio: string;
  fecha: string;
  estado: string;
  total: number | null;
  via: "manual" | "oportunidad" | "ficha";
  oportunidad: string | null;
  monto_oportunidad: number | null;
  moneda: string | null;
}

interface Oportunidad {
  id_clientify: number;
  nombre: string | null;
  monto: number | null;
  moneda: string | null;
  estado: number | null;
  id_etapa: number | null;
  etapa: string | null;
  proceso: string | null;
  razon_perdida: string | null;
  razon_ganada: string | null;
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

interface Cambio {
  id: number;
  campo: string;
  antes: string | null;
  despues: string | null;
  en: string;
  vendedores: { nombre: string } | null;
}

// Como se llama cada campo en el historial de cambios.
const CAMPOS_CAMBIO: Record<string, string> = {
  nombre: "Nombre",
  apellido: "Apellido",
  empresa: "Empresa",
  cargo: "Cargo",
  emails: "Emails",
  telefonos: "Telefonos",
  direccion: "Direccion",
  comuna: "Comuna / distrito",
  ciudad: "Ciudad / provincia",
  region: "Region / departamento",
  origen: "Origen",
  campana: "Campana",
  propietario: "Propietario",
  estado: "Estado",
  linea: "Linea",
  pais: "Pais",
};

// Un dato corregido a mano se guarda tal como se anoto; las listas (emails,
// telefonos) vienen como texto JSON y se leen mejor sin llaves.
function legible(campo: string, v: string | null, estados: Estado[]) {
  if (v == null || v === "") return "(vacio)";
  if (campo === "estado") return etiquetaDe(estados, v);
  if (campo === "linea") return v === "casas" ? "Proyecto" : v === "paneles" ? "Paneles" : v;
  if (campo === "emails" || campo === "telefonos") {
    try {
      const lista = JSON.parse(v) as { email?: string; phone?: string }[];
      const texto = lista.map((x) => x.email ?? x.phone ?? "").filter(Boolean).join(", ");
      return texto || "(vacio)";
    } catch {
      return v;
    }
  }
  return v;
}

// Cada pais se lee en su hora.
const ZONAS = { CL: "America/Santiago", PE: "America/Lima" } as const;

// Letra chica para toda la ficha: es una pantalla de consulta con mucho dato.
const TITULO = "bg-verde text-white text-[10px] font-semibold px-3 py-0.5 flex justify-between";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idContacto = Number(id);
  if (!Number.isInteger(idContacto)) notFound();

  const v = await requerirVendedor();
  const supabase = await createClient();
  const cat = await catalogoEstados();

  // La base solo entrega los leads del mercado de quien mira: uno de otro pais
  // no existe para esta persona.
  const { data: contacto } = await supabase
    .from("v_leads")
    .select(
      "id_clientify, nombre, apellido, nombre_completo, telefonos, emails, direccion, comuna, ciudad, region, pais, id_pais, estado, estado_efectivo, estado_manual, con_cotizacion_enviada, origen, campana, linea, linea_manual, linea_auto, editado, propietario, propietario_email, creado_clientify, empresa, cargo, observaciones"
    )
    .eq("id_clientify", idContacto)
    .maybeSingle();
  if (!contacto) {
    // Un lead fusionado en otro ya no existe por su cuenta: se abre el que lo recibio.
    const { data: fusion } = await supabase.from("lead_fusiones").select("id_destino").eq("id_origen", idContacto).maybeSingle();
    if (fusion?.id_destino) redirect(`/leads/${fusion.id_destino}`);
    notFound();
  }
  const c = contacto as Contacto;

  const { accesibles, activo } = await contextoMercado(v);
  const paisLead = accesibles.find((p) => p.id === c.id_pais);
  const codigoPais: "CL" | "PE" = paisLead?.codigo === "PE" ? "PE" : "CL";
  const monedaBase = paisLead?.moneda_base ?? (codigoPais === "PE" ? "PEN" : "CLP");
  const zona = ZONAS[codigoPais];
  const esCasas = c.linea === "casas";

  const cuando = (f: string) =>
    new Date(f).toLocaleString("es-CL", { timeZone: zona, dateStyle: "short", timeStyle: "short" });

  const [
    { data: cots },
    { data: ops },
    { data: acts },
    { data: hist },
    { data: equipoDb },
    { data: cambiosDb },
    { data: casaDb },
    { data: archivosDb },
    { data: propietariosDb },
  ] = await Promise.all([
    // Las cotizaciones de paneles no se ven en un lead de casas.
    esCasas
      ? Promise.resolve({ data: [] })
      : supabase.rpc("clientify_cotizaciones_de", { p_contacto: idContacto }),
    supabase
      .from("clientify_oportunidades")
      .select("id_clientify, nombre, monto, moneda, estado, id_etapa, etapa, proceso, razon_perdida, razon_ganada, creado_clientify")
      .eq("id_contacto", idContacto)
      .order("creado_clientify", { ascending: false }),
    supabase
      .from("clientify_actividad")
      .select("id, tipo, fecha, autor, titulo, texto")
      .eq("id_contacto", idContacto)
      .order("fecha", { ascending: false })
      .limit(200),
    supabase.rpc("clientify_historial_de", { p_contacto: idContacto }),
    // A quien se le puede dejar un compromiso: quienes escriben y trabajan el
    // mercado del lead.
    supabase
      .from("vendedores")
      .select("id, nombre")
      .eq("activo", true)
      .neq("rol", "Consulta")
      .in("mercado", ["Ambos", codigoPais === "PE" ? "Peru" : "Chile"])
      .order("nombre"),
    supabase
      .from("lead_cambios")
      .select("id, campo, antes, despues, en, vendedores(nombre)")
      .eq("id_clientify", idContacto)
      .order("en", { ascending: false })
      .limit(100),
    esCasas
      ? supabase
          .from("lead_casa")
          .select("metros2, valor_uf, valor_clp, valor_usd, valor_pen")
          .eq("id_clientify", idContacto)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("lead_archivos")
      .select("id, nombre, tamano, creado_en, id_vendedor, vendedores(nombre)")
      .eq("id_clientify", idContacto)
      .order("creado_en", { ascending: false }),
    // A quien se le puede asignar el lead: solo se pide si se puede editar.
    puedeEscribirLeads(v) ? supabase.rpc("lead_propietarios") : Promise.resolve({ data: [] }),
  ]);
  const cotizaciones = (cots ?? []) as CotizacionVinculada[];
  const oportunidades = (ops ?? []) as Oportunidad[];
  const notasClientify = (acts ?? []) as Actividad[];
  const historial = (hist ?? []) as EntradaHistorial[];
  const equipo = (equipoDb ?? []) as { id: number; nombre: string }[];
  const cambios = (cambiosDb ?? []) as unknown as Cambio[];
  const casa = (casaDb ?? null) as DatosCasaGuardados | null;
  const archivos = ((archivosDb ?? []) as unknown as (Omit<ArchivoLead, "vendedor"> & {
    vendedores: { nombre: string } | null;
  })[]).map((a) => ({ ...a, vendedor: a.vendedores?.nombre ?? null })) as ArchivoLead[];

  const puedeEscribir = puedeEscribirLeads(v);
  // Quien genero cada cotizacion del lead, para rotular sus anotaciones.
  const idsCot = cotizaciones.map((q) => q.id_cotizacion);
  const { data: autoresDb } = idsCot.length > 0 ? await supabase.from("cotizaciones").select("id, vendedores(nombre)").in("id", idsCot) : { data: [] };
  const autoresCotizacion: Record<number, string> = {};
  for (const a of (autoresDb ?? []) as unknown as { id: number; vendedores: { nombre: string } | { nombre: string }[] | null }[]) {
    const nombre = Array.isArray(a.vendedores) ? a.vendedores[0]?.nombre : a.vendedores?.nombre;
    if (nombre) autoresCotizacion[a.id] = nombre;
  }
  const espera = await leerEspera(supabase, c.id_clientify, null);
  // Los mensajes que se pueden escribir al contacto; si la base aun no los tiene, no se ofrece.
  const { data: plantillasDb, error: errPlantillas } = puedeEscribir
    ? await supabase.from("plantillas_mensaje").select("id, canal, linea, nombre, asunto, cuerpo, orden, activo").eq("activo", true).eq("linea", c.linea ?? "paneles").order("orden").order("nombre")
    : { data: null, error: null };
  const plantillas = (errPlantillas ? [] : (plantillasDb ?? [])) as Plantilla[];
  const puedeCotizar = v.puede_crear || tienePerfilAdmin(v);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo={c.nombre_completo || "(sin nombre)"}
        subtitulo={[c.empresa, c.cargo].filter(Boolean).join(" · ") || "Lead"}
      />
      <div className="max-w-screen-xl mx-auto p-4 space-y-3 text-[11px]">
        <BarraNavegacion volverA="/leads">
          <EnlacesInicio />
          <Link
            href="/leads"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Lista de leads
          </Link>
          {/* La cotizacion de paneles no corresponde a un proyecto de casa. */}
          {puedeCotizar && !esCasas && (!activo || activo.id === c.id_pais) && (
            <BotonCotizarLead idLead={c.id_clientify} />
          )}
          {puedeCotizar && !esCasas && activo && activo.id !== c.id_pais && (
            <span className="text-[11px] text-gray-600">
              Es un lead de {paisLead?.nombre ?? "otro pais"}: para cotizarle, cambie el mercado en
              la cabecera.
            </span>
          )}
        </BarraNavegacion>

        {tienePerfilAdmin(v) && <FusionLead idLead={c.id_clientify} estados={cat.lead} />}

        {espera !== undefined && (
          <ControlEspera idLead={c.id_clientify} idCot={null} vigente={espera} puedeEditar={puedeEscribir} zona={zona} />
        )}

        {puedeEscribir && !errPlantillas && (
          <MensajeLead
            lineaTexto={LINEAS[c.linea as Linea] ?? c.linea ?? "Paneles"}
            idLead={c.id_clientify}
            plantillas={plantillas}
            emails={(c.emails ?? []).map((e) => e.email ?? "").filter(Boolean)}
            telefonos={(c.telefonos ?? []).filter((t) => t.phone).map((t) => ({ phone: t.phone as string, whatsapp: t.whatsapp }))}
            prefijoTelefono={codigoPais === "PE" ? "51" : "56"}
            cotizaciones={cotizaciones.filter((q) => q.folio).map((q) => ({ id: q.id_cotizacion, folio: q.folio }))}
            datos={{
              nombre: primerNombre(c.nombre) || primerNombre(c.nombre_completo),
              nombreCompleto: c.nombre_completo ?? "",
              empresa: c.empresa ?? "",
              vendedor: v.nombre,
              cargoVendedor: v.cargo,
              emailVendedor: v.email,
              fonoVendedor: v.telefono,
            }}
          />
        )}

        {/* Datos personales */}
        <FichaLead
          lead={c}
          codigoPais={codigoPais}
          paises={accesibles.map((p) => ({ id: p.id, nombre: p.nombre }))}
          propietarios={(propietariosDb ?? []) as { email: string; nombre: string }[]}
          puedeEditar={puedeEscribir}
          puedeCambiarPais={tienePerfilAdmin(v)}
        />

        {esCasas ? (
          <ProyectoCasa
            idLead={c.id_clientify}
            codigoPais={codigoPais}
            casa={casa}
            archivos={archivos}
            puedeEditar={puedeEscribir}
            esAdmin={tienePerfilAdmin(v)}
            yo={v.id}
          />
        ) : (
          <section className="bg-white border border-gray-200 rounded overflow-hidden">
            <h2 className={TITULO}>
              <span>COTIZACIONES VINCULADAS</span>
              <span className="font-normal">{cotizaciones.length}</span>
            </h2>
            {puedeEscribir && (
              <div className="px-3 py-1.5 border-b border-gray-100">
                <VincularCotizacionALead idLead={c.id_clientify} estadosCotizacion={cat.cotizacion} />
              </div>
            )}
            {cotizaciones.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-gray-400">
                Este lead no tiene cotizaciones vinculadas. Use &quot;Crear cotizacion&quot; para
                hacerle una, o ponga el folio en el nombre de su oportunidad (por
                ejemplo &quot;Maria Perez - COT00118&quot;).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-crema text-dorado-osc">
                    <tr>
                      <th className="text-left px-3 py-0.5 w-24">Fecha</th>
                      <th className="text-left px-3 py-0.5 w-24">Folio</th>
                      <th className="text-left px-3 py-0.5 w-24">Estado</th>
                      <th className="text-right px-3 py-0.5 w-32">Total</th>
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
                        <td className="px-3 py-0.5 text-right tabular-nums whitespace-nowrap">
                          {dinero(q.total ?? 0, q.moneda ?? monedaBase)}
                        </td>
                        <td className="px-3 py-0.5 text-gray-600">
                          {q.via === "manual" ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              Vinculada a mano
                              {puedeEscribir && <QuitarVinculo idCot={q.id_cotizacion} idLead={c.id_clientify} />}
                            </span>
                          ) : q.via === "oportunidad" ? (
                            `Oportunidad "${q.oportunidad ?? ""}"`
                          ) : (
                            "Ficha de cliente enlazada"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {!esCasas && (
          <ArchivosLead
            idLead={c.id_clientify}
            archivos={archivos}
            puedeEditar={puedeEscribir}
            esAdmin={tienePerfilAdmin(v)}
            yo={v.id}
          />
        )}

        {/* Oportunidades del contacto */}
        {oportunidades.length > 0 && (
          <section className="bg-white border border-gray-200 rounded overflow-hidden">
            <h2 className={TITULO}>
              <span>OPORTUNIDADES</span>
              <span className="font-normal">{oportunidades.length}</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-crema text-dorado-osc">
                  <tr>
                    <th className="text-left px-3 py-0.5 w-24">Creada</th>
                    <th className="text-left px-3 py-0.5">Oportunidad</th>
                    <th className="text-left px-3 py-0.5 w-44">Etapa</th>
                    <th className="text-left px-3 py-0.5 w-20">Estado</th>
                    <th className="text-left px-3 py-0.5 w-36">Por que</th>
                    <th className="text-right px-3 py-0.5 w-32">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {oportunidades.map((o) => (
                    <tr key={o.id_clientify} className="border-t border-gray-100">
                      <td className="px-3 py-0.5 whitespace-nowrap">
                        {o.creado_clientify ? fecha(o.creado_clientify.slice(0, 10)) : ""}
                      </td>
                      <td className="px-3 py-0.5">{o.nombre}</td>
                      {/* El nombre de la etapa viene de la planilla; de la API
                          solo llega su numero. */}
                      <td className="px-3 py-0.5">
                        {o.etapa ?? (o.id_etapa ? (ETAPAS[o.id_etapa] ?? "") : "")}
                        {o.proceso && (
                          <span className="block text-[9px] text-gray-500">{o.proceso}</span>
                        )}
                      </td>
                      <td className="px-3 py-0.5">
                        {o.estado ? (ESTADOS_OPORTUNIDAD[o.estado] ?? "") : ""}
                      </td>
                      <td className="px-3 py-0.5 text-gray-600">
                        {o.razon_perdida ?? o.razon_ganada ?? ""}
                      </td>
                      <td className="px-3 py-0.5 text-right tabular-nums whitespace-nowrap">
                        {dinero(o.monto ?? 0, o.moneda ?? monedaBase)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            puedeEscribir={puedeEscribir}
            puedeEditarCompromiso={administraUsuarios(v)}
            puedeAsignarCotizacion={tienePerfilAdmin(v)}
            equipo={equipo}
            yo={v.id}
            zona={zona}
            autoresCotizacion={autoresCotizacion}
          />
        </section>

        <RegistrosEstado tipo="lead" idRef={c.id_clientify} />

        {/* Lo que el equipo dejo anotado antes */}
        {(c.observaciones || notasClientify.length > 0) && (
          <section className="bg-white border border-gray-200 rounded overflow-hidden">
            <h2 className={TITULO}>
              <span>NOTAS ANTERIORES</span>
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
              Lo registrado antes de pasar al sistema. Los textos largos llegan recortados y los
              mensajes de WhatsApp no se importan.
            </p>
          </section>
        )}

        {/* Quien cambio que en esta ficha */}
        {cambios.length > 0 && (
          <details className="bg-white border border-gray-200 rounded overflow-hidden">
            <summary className="bg-verde text-white text-[10px] font-semibold px-3 py-0.5 cursor-pointer flex justify-between">
              <span>CAMBIOS EN ESTA FICHA</span>
              <span className="font-normal">{cambios.length}</span>
            </summary>
            <ol className="divide-y divide-gray-100">
              {cambios.map((x) => (
                <li key={x.id} className="px-3 py-1.5 text-[11px]">
                  <span className="text-gray-500">{cuando(x.en)}</span>
                  {x.vendedores?.nombre && <span className="text-gray-500"> · {x.vendedores.nombre}</span>}
                  <div>
                    <span className="font-semibold text-verde">
                      {CAMPOS_CAMBIO[x.campo] ?? x.campo}
                    </span>
                    : {legible(x.campo, x.antes, cat.lead)} → {legible(x.campo, x.despues, cat.lead)}
                  </div>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}
