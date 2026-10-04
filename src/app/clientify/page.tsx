import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonSincronizarClientify from "@/components/BotonSincronizarClientify";
import CargarContactosClientify from "@/components/CargarContactosClientify";
import BotonEnlazarClientes from "@/components/BotonEnlazarClientes";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { hayClaveClientify } from "@/lib/clientify";
import { ESTADOS_LEAD, LINEAS, estadoLegible, puedeCargarLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";
// La sincronizacion corre dentro de esta pantalla y lee unas 65 paginas de la
// API de Clientify una tras otra.
export const maxDuration = 300;

const POR_PAGINA = 50;

const dia = (f: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("-") : "");

interface Fila {
  id_clientify: number;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  cargo: string | null;
  estado: string | null;
  estado_efectivo: string | null;
  linea: "paneles" | "casas";
  campana: string | null;
  propietario: string | null;
  propietario_email: string | null;
  etiquetas: string[];
  creado_clientify: string | null;
  ultimo_contacto: string | null;
  id_entidad: number | null;
  observaciones: string | null;
  campos_personalizados: { field?: string; value?: string }[];
  origen: string | null;
  comuna: string | null;
  region: string | null;
}

interface Filtros {
  estados: string[];
  propietarios: { email: string; nombre: string }[];
  total: number;
  total_por_pais?: Record<string, number>;
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    dueno?: string;
    linea?: string;
    pagina?: string;
  }>;
}) {
  const { q = "", estado = "", dueno = "", linea = "", pagina = "1" } = await searchParams;
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { activo, idPaisActivo } = await contextoMercado(v);
  const esPeru = activo?.codigo === "PE";
  const puedeSincronizar = puedeCargarLeads(v);
  const hayClave = hayClaveClientify();

  const actual = Math.max(1, Number.parseInt(pagina, 10) || 1);
  const desde = (actual - 1) * POR_PAGINA;

  // Cada mercado ve sus leads: la base ya recorta por el pais de la persona, y
  // quien trabaja los dos elige el suyo en la cabecera.
  let consulta = conPais(
    supabase
      .from("v_leads")
      .select(
        "id_clientify, nombre_completo, email, telefono, empresa, cargo, estado, estado_efectivo, linea, campana, propietario, propietario_email, etiquetas, creado_clientify, ultimo_contacto, id_entidad, observaciones, campos_personalizados, origen, comuna, region",
        { count: "exact" }
      ),
    idPaisActivo
  );

  // Los caracteres que usa el filtro para separar condiciones se sacan del
  // texto buscado: si no, "Perez, Juan" rompe la consulta.
  const busqueda = q.replace(/[,()%*]/g, " ").trim();
  if (busqueda) {
    const patron = `%${busqueda}%`;
    consulta = consulta.or(
      `nombre_completo.ilike.${patron},email.ilike.${patron},telefono.ilike.${patron},empresa.ilike.${patron},campana.ilike.${patron}`
    );
  }
  // Un lead con una cotizacion enviada ya es una oportunidad, diga lo que diga
  // Clientify: se filtra y se muestra por el estado efectivo.
  if (estado) consulta = consulta.eq("estado_efectivo", estado);
  if (dueno) consulta = consulta.eq("propietario_email", dueno);
  if (linea === "paneles" || linea === "casas") consulta = consulta.eq("linea", linea);

  const [{ data: filas, count }, { data: filtrosData }, { data: ultima }] = await Promise.all([
    consulta
      .order("creado_clientify", { ascending: false, nullsFirst: false })
      .range(desde, desde + POR_PAGINA - 1),
    supabase.rpc("clientify_filtros"),
    supabase
      .from("clientify_sincronizaciones")
      .select("inicio, fin, estado, leidos, quitados, error")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const contactos = (filas ?? []) as Fila[];
  const filtros = (filtrosData ?? { estados: [], propietarios: [], total: 0 }) as Filtros;
  const total = count ?? 0;
  // Los que hay en el mercado que se esta mirando, sin filtros.
  const totalMercado = activo ? (filtros.total_por_pais?.[String(activo.id)] ?? 0) : filtros.total;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (p: number) => {
    const s = new URLSearchParams();
    if (busqueda) s.set("q", busqueda);
    if (estado) s.set("estado", estado);
    if (dueno) s.set("dueno", dueno);
    if (linea) s.set("linea", linea);
    if (p > 1) s.set("pagina", String(p));
    const t = s.toString();
    return `/clientify${t ? `?${t}` : ""}`;
  };

  const cuando = (f: string | null | undefined) =>
    f
      ? new Date(f).toLocaleString("es-CL", {
          timeZone: "America/Santiago",
          dateStyle: "short",
          timeStyle: "short",
        })
      : "";

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Leads"
        subtitulo="Los contactos del CRM de Clientify dentro del sistema"
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />

        {/* Estado de la copia: de cuando es y si la ultima vuelta salio bien. */}
        <div className="bg-white border border-gray-200 rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold">{totalMercado.toLocaleString("es-CL")}</span>{" "}
              contactos {activo ? `de ${activo.nombre}` : "en el sistema"}
            </p>
            {ultima ? (
              <p className={ultima.estado === "con error" ? "text-red-600" : "text-gray-500"}>
                {ultima.estado === "con error"
                  ? `La ultima sincronizacion (${cuando(ultima.inicio)}) fallo: ${ultima.error}`
                  : ultima.estado === "en curso"
                    ? `Sincronizando desde ${cuando(ultima.inicio)}...`
                    : `Ultima sincronizacion: ${cuando(ultima.fin)}`}
              </p>
            ) : (
              <p className="text-gray-500">Todavia no se ha sincronizado.</p>
            )}
          </div>
          {puedeSincronizar ? (
            <div className="flex flex-wrap items-center gap-4">
              <CargarContactosClientify />
              <Link href="/clientify/meta" className="text-verde underline font-semibold">
                Leads de Meta
              </Link>
              <BotonEnlazarClientes />
              {/* La API de Clientify es de pago aparte: el boton solo aparece si
                  la cuenta cargo la clave. */}
              {hayClave && (
                <BotonSincronizarClientify deshabilitado={false} />
              )}
            </div>
          ) : (
            <p className="text-gray-500">Los carga el Administrador.</p>
          )}
        </div>

        <form className="flex flex-wrap items-end gap-2 text-xs" action="/clientify">
          <div>
            <label htmlFor="q" className="block font-semibold text-dorado-osc mb-0.5">
              Buscar
            </label>
            <input
              id="q"
              name="q"
              defaultValue={busqueda}
              placeholder="Nombre, correo, telefono o empresa"
              className="border border-gray-300 rounded px-2 py-1 w-72"
            />
          </div>
          <div>
            <label htmlFor="estado" className="block font-semibold text-dorado-osc mb-0.5">
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={estado}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Todos</option>
              {filtros.estados.map((e) => (
                <option key={e} value={e}>
                  {estadoLegible(e)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dueno" className="block font-semibold text-dorado-osc mb-0.5">
              Responsable
            </label>
            <select
              id="dueno"
              name="dueno"
              defaultValue={dueno}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Todos</option>
              {filtros.propietarios.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="linea" className="block font-semibold text-dorado-osc mb-0.5">
              Linea
            </label>
            <select
              id="linea"
              name="linea"
              defaultValue={linea}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Todas</option>
              <option value="paneles">{LINEAS.paneles}</option>
              <option value="casas">{LINEAS.casas}</option>
            </select>
          </div>
          <button className="bg-verde text-white font-semibold px-3 py-1 rounded">Filtrar</button>
          {(busqueda || estado || dueno || linea) && (
            <Link href="/clientify" className="text-verde underline py-1">
              Quitar filtros
            </Link>
          )}
          <span className="ml-auto text-gray-500 py-1">
            {total.toLocaleString("es-CL")} resultados
          </span>
        </form>

        {/* Diez columnas que caben en el ancho de la pantalla: sin barra lateral.
            El ancho se reparte por porcentaje y el texto largo se corta con "..."
            --el completo se ve al dejar el cursor encima--. */}
        <div className="bg-white border border-gray-200 rounded">
          <table className="w-full table-fixed text-[11px]">
            <colgroup>
              <col className="w-[7%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-2 py-1.5">Fecha de creacion</th>
                <th className="text-left px-2 py-1.5">Nombre</th>
                <th className="text-left px-2 py-1.5">Telefono</th>
                <th className="text-left px-2 py-1.5">Email</th>
                <th className="text-left px-2 py-1.5">Campana</th>
                <th className="text-left px-2 py-1.5">Propietario</th>
                <th className="text-left px-2 py-1.5">{esPeru ? "Distrito" : "Comuna"}</th>
                <th className="text-left px-2 py-1.5">
                  {esPeru ? "Departamento" : "Region / Provincia"}
                </th>
                <th className="text-left px-2 py-1.5">Estado</th>
                <th className="text-left px-2 py-1.5">Origen</th>
              </tr>
            </thead>
            <tbody>
              {contactos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                    {totalMercado === 0
                      ? "Todavia no hay contactos. Cargue el archivo con la lista de Clientify."
                      : "Ningun contacto coincide con la busqueda."}
                  </td>
                </tr>
              ) : (
                contactos.map((c) => (
                  <tr key={c.id_clientify} className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-2 py-1 whitespace-nowrap">{dia(c.creado_clientify)}</td>
                    <td className="px-2 py-1 font-semibold">
                      <div className="flex items-center gap-1 min-w-0">
                        {c.linea === "casas" && (
                          <span
                            className="shrink-0 text-[9px] font-semibold text-dorado-osc border border-dorado-osc rounded px-1"
                            title="Lead de casas"
                          >
                            Casas
                          </span>
                        )}
                        <Link
                          href={`/clientify/${c.id_clientify}`}
                          className="block truncate text-verde underline"
                          title={c.nombre_completo}
                        >
                          {c.nombre_completo || "(sin nombre)"}
                        </Link>
                      </div>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{c.telefono}</td>
                    <td className="px-2 py-1">
                      <span className="block truncate" title={c.email ?? ""}>
                        {c.email}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="block truncate" title={c.campana ?? ""}>
                        {c.campana}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="block truncate" title={c.propietario ?? ""}>
                        {c.propietario}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="block truncate" title={c.comuna ?? ""}>
                        {c.comuna}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="block truncate" title={c.region ?? ""}>
                        {c.region}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="block truncate" title={estadoLegible(c.estado_efectivo)}>
                        {estadoLegible(c.estado_efectivo)}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="block truncate" title={c.origen ?? ""}>
                        {c.origen}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {paginas > 1 && (
          <div className="flex items-center justify-center gap-3 text-xs">
            {actual > 1 ? (
              <Link href={enlace(actual - 1)} className="text-verde underline">
                ← Anterior
              </Link>
            ) : (
              <span className="text-gray-300">← Anterior</span>
            )}
            <span>
              Pagina {actual} de {paginas}
            </span>
            {actual < paginas ? (
              <Link href={enlace(actual + 1)} className="text-verde underline">
                Siguiente →
              </Link>
            ) : (
              <span className="text-gray-300">Siguiente →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
