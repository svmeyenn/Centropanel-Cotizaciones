import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonSincronizarClientify from "@/components/BotonSincronizarClientify";
import CargarContactosClientify from "@/components/CargarContactosClientify";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { hayClaveClientify } from "@/lib/clientify";

export const dynamic = "force-dynamic";
// La sincronizacion corre dentro de esta pantalla y lee unas 65 paginas de la
// API de Clientify una tras otra.
export const maxDuration = 300;

const POR_PAGINA = 50;

// Los estados llegan de Clientify en su propio idioma. Los conocidos se dicen
// en castellano; un estado nuevo se muestra tal cual llega.
const ESTADOS: Record<string, string> = {
  "cold-lead": "Lead frio",
  "warm-lead": "Lead tibio",
  "hot-lead": "Lead caliente",
  client: "Cliente",
  "lost-client": "Cliente perdido",
  "lost-lead": "Lead perdido",
};
const estadoLegible = (e: string | null) => (e ? (ESTADOS[e] ?? e) : "");

const dia = (f: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("-") : "");

interface Fila {
  id_clientify: number;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  cargo: string | null;
  estado: string | null;
  propietario: string | null;
  propietario_email: string | null;
  etiquetas: string[];
  creado_clientify: string | null;
  ultimo_contacto: string | null;
  id_entidad: number | null;
  observaciones: string | null;
  campos_personalizados: { field?: string; value?: string }[];
  origen: string | null;
}

interface Filtros {
  estados: string[];
  propietarios: { email: string; nombre: string }[];
  total: number;
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; dueno?: string; pagina?: string }>;
}) {
  const { q = "", estado = "", dueno = "", pagina = "1" } = await searchParams;
  const v = await requerirVendedor();
  const supabase = await createClient();
  const puedeSincronizar = tienePerfilAdmin(v);
  const hayClave = hayClaveClientify();

  const actual = Math.max(1, Number.parseInt(pagina, 10) || 1);
  const desde = (actual - 1) * POR_PAGINA;

  let consulta = supabase
    .from("clientify_contactos")
    .select(
      "id_clientify, nombre_completo, email, telefono, empresa, cargo, estado, propietario, propietario_email, etiquetas, creado_clientify, ultimo_contacto, id_entidad, observaciones, campos_personalizados, origen",
      { count: "exact" }
    );

  // Los caracteres que usa el filtro para separar condiciones se sacan del
  // texto buscado: si no, "Perez, Juan" rompe la consulta.
  const busqueda = q.replace(/[,()%*]/g, " ").trim();
  if (busqueda) {
    const patron = `%${busqueda}%`;
    consulta = consulta.or(
      `nombre_completo.ilike.${patron},email.ilike.${patron},telefono.ilike.${patron},empresa.ilike.${patron}`
    );
  }
  if (estado) consulta = consulta.eq("estado", estado);
  if (dueno) consulta = consulta.eq("propietario_email", dueno);

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
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (p: number) => {
    const s = new URLSearchParams();
    if (busqueda) s.set("q", busqueda);
    if (estado) s.set("estado", estado);
    if (dueno) s.set("dueno", dueno);
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
        titulo="Contactos de Clientify"
        subtitulo="La copia de los contactos del CRM dentro del sistema"
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />

        {/* Estado de la copia: de cuando es y si la ultima vuelta salio bien. */}
        <div className="bg-white border border-gray-200 rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold">{filtros.total.toLocaleString("es-CL")}</span>{" "}
              contactos en el sistema
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
              {/* La API de Clientify es de pago aparte: el boton solo aparece si
                  la cuenta cargo la clave. */}
              {hayClave && (
                <BotonSincronizarClientify deshabilitado={false} />
              )}
            </div>
          ) : (
            <p className="text-gray-500">Los carga el Administrador o el Supervisor.</p>
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
          <button className="bg-verde text-white font-semibold px-3 py-1 rounded">Filtrar</button>
          {(busqueda || estado || dueno) && (
            <Link href="/clientify" className="text-verde underline py-1">
              Quitar filtros
            </Link>
          )}
          <span className="ml-auto text-gray-500 py-1">
            {total.toLocaleString("es-CL")} resultados
          </span>
        </form>

        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-1.5">Contacto</th>
                <th className="text-left px-3 py-1.5">Empresa</th>
                <th className="text-left px-3 py-1.5">Correo</th>
                <th className="text-left px-3 py-1.5">Telefono</th>
                <th className="text-left px-3 py-1.5">Estado</th>
                <th className="text-left px-3 py-1.5">Responsable</th>
                <th className="text-left px-3 py-1.5">Interes</th>
                <th className="text-left px-3 py-1.5">Observaciones</th>
                <th className="text-left px-3 py-1.5">Origen</th>
                <th className="text-left px-3 py-1.5">Etiquetas</th>
                <th className="text-left px-3 py-1.5 w-24">Creado</th>
                <th className="text-left px-3 py-1.5 w-28">Ultimo contacto</th>
              </tr>
            </thead>
            <tbody>
              {contactos.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                    {filtros.total === 0
                      ? "Todavia no hay contactos. Cargue el archivo con la lista de Clientify."
                      : "Ningun contacto coincide con la busqueda."}
                  </td>
                </tr>
              ) : (
                contactos.map((c) => (
                  <tr key={c.id_clientify} className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-1">
                      <span className="font-semibold">{c.nombre_completo || "(sin nombre)"}</span>
                      {c.cargo && <span className="block text-gray-500">{c.cargo}</span>}
                    </td>
                    <td className="px-3 py-1">{c.empresa}</td>
                    <td className="px-3 py-1">{c.email}</td>
                    <td className="px-3 py-1 whitespace-nowrap">{c.telefono}</td>
                    <td className="px-3 py-1 whitespace-nowrap">{estadoLegible(c.estado)}</td>
                    <td className="px-3 py-1 whitespace-nowrap">{c.propietario}</td>
                    <td className="px-3 py-1 text-gray-600">
                      {(c.campos_personalizados ?? [])
                        .filter((x) => x.value)
                        .map((x) => x.value)
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-1 max-w-64">
                      <span className="block truncate text-gray-600" title={c.observaciones ?? ""}>
                        {c.observaciones}
                      </span>
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap">{c.origen}</td>
                    <td className="px-3 py-1">
                      <div className="flex flex-wrap gap-1">
                        {c.etiquetas.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="bg-crema text-dorado-osc rounded px-1.5 py-0.5 max-w-40 truncate"
                            title={t}
                          >
                            {t}
                          </span>
                        ))}
                        {c.etiquetas.length > 3 && (
                          <span className="text-gray-500">+{c.etiquetas.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1">{dia(c.creado_clientify)}</td>
                    <td className="px-3 py-1">{dia(c.ultimo_contacto)}</td>
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
