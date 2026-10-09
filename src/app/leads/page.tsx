import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import { BanderaDe } from "@/components/Bandera";
import AsignarPropietarioMasivo from "@/components/AsignarPropietarioMasivo";
import PildoraLinea from "@/components/PildoraLinea";
import { GESTIONES, SIN_PROPIETARIO, aplicarFiltrosLeads } from "@/lib/filtrosLeads";
import CargarContactosClientify from "@/components/CargarContactosClientify";
import BotonEnlazarClientes from "@/components/BotonEnlazarClientes";
import NuevoLead from "@/components/NuevoLead";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { LINEAS, puedeCargarLeads, puedeEscribirLeads } from "@/lib/leads";
import { etiquetaDe, estadosParaFiltros } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";

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
  id_pais: number;
  ultimo_toque: string | null;
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
    gestion?: string;
    campo?: string;
    dias?: string;
    pagina?: string;
  }>;
}) {
  const {
    q = "",
    estado = "",
    dueno = "",
    linea = "",
    gestion = "",
    campo = "",
    dias = "",
    pagina = "1",
  } = await searchParams;
  // Antiguedad: se mide contra cuando entro el lead o contra el ultimo
  // movimiento. Viene de la pantalla de depuracion, y se puede ajustar aqui.
  const campoEdad: "creado" | "toque" = campo === "creado" ? "creado" : "toque";
  const diasEdad = Math.max(0, Math.min(3650, Number.parseInt(dias, 10) || 0));
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { activo, idPaisActivo, paises } = await contextoMercado(v);
  const esPeru = activo?.codigo === "PE";
  const puedeSincronizar = puedeCargarLeads(v);
  const puedeAsignar = puedeEscribirLeads(v);

  const actual = Math.max(1, Number.parseInt(pagina, 10) || 1);
  const desde = (actual - 1) * POR_PAGINA;

  // Cada mercado ve sus leads: la base ya recorta por el pais de la persona, y
  // quien trabaja los dos elige el suyo en la cabecera.
  let consulta = conPais(
    supabase
      .from("v_leads")
      .select(
        "id_clientify, nombre_completo, email, telefono, empresa, cargo, estado, estado_efectivo, linea, campana, propietario, propietario_email, etiquetas, creado_clientify, ultimo_contacto, id_entidad, observaciones, campos_personalizados, origen, comuna, region, id_pais, ultimo_toque",
        { count: "exact" }
      ),
    idPaisActivo
  );

  const cat = await catalogoEstados();
  const nombreEstado = (e: string | null) => etiquetaDe(cat.lead, e);
  const busqueda = q.replace(/[,()%*]/g, " ").trim();
  // Los que esperan respuesta del cliente no cuentan en los atajos del inicio.
  const enEspera = gestion ? (((await supabase.rpc("espera_leads")).data ?? []) as number[]) : [];
  const filtroActual = { q, estado, dueno, linea, gestion, campo: campoEdad, dias: diasEdad, enEspera };
  consulta = aplicarFiltrosLeads(consulta, filtroActual, estadosParaFiltros(cat));

  const [{ data: filas, count }, { data: filtrosData }, { data: posibles }, { data: ultima }] = await Promise.all([
    consulta
      .order("creado_clientify", { ascending: false, nullsFirst: false })
      .range(desde, desde + POR_PAGINA - 1),
    supabase.rpc("clientify_filtros"),
    puedeAsignar ? supabase.rpc("lead_propietarios") : Promise.resolve({ data: [] }),
    supabase
      .from("clientify_sincronizaciones")
      .select("inicio, fin, estado, leidos, quitados, error")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const contactos = (filas ?? []) as Fila[];
  // Cuantas cotizaciones tiene vinculadas cada lead de esta pagina; el que no tiene ninguna no sale en la lista.
  const { data: cuentasCot } =
    contactos.length > 0
      ? await supabase.rpc("leads_n_cotizaciones", { p_ids: contactos.map((c) => c.id_clientify) })
      : { data: [] };
  const nCot = new Map(((cuentasCot ?? []) as { id_clientify: number; n: number }[]).map((x) => [Number(x.id_clientify), Number(x.n)]));
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
    if (gestion) s.set("gestion", gestion);
    if (diasEdad > 0) {
      s.set("campo", campoEdad);
      s.set("dias", String(diasEdad));
    }
    if (p > 1) s.set("pagina", String(p));
    const t = s.toString();
    return `/leads${t ? `?${t}` : ""}`;
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
        subtitulo="Contactos, conversaciones, compromisos y cotizaciones"
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
              <NuevoLead
                paises={paises.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre }))}
                idPaisInicial={idPaisActivo}
                propietarios={(posibles ?? []) as { email: string; nombre: string }[]}
                miEmail={v.email ?? ""}
              />
              <CargarContactosClientify />
              <Link href="/leads/meta" className="bg-verde text-white font-semibold px-3 py-1 rounded">
                Subir leads de Meta
              </Link>
              <BotonEnlazarClientes />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              {puedeAsignar && (
                <NuevoLead
                  paises={paises.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre }))}
                  idPaisInicial={idPaisActivo}
                  propietarios={(posibles ?? []) as { email: string; nombre: string }[]}
                  miEmail={v.email ?? ""}
                />
              )}
              <p className="text-gray-500">Los carga el Administrador.</p>
            </div>
          )}
        </div>

        <form className="flex flex-wrap items-end gap-2 text-xs" action="/leads">
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
                  {nombreEstado(e)}
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
              {dueno.includes(",") && <option value={dueno}>Mis leads (desde el inicio)</option>}
              <option value={SIN_PROPIETARIO}>Sin propietario</option>
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
          <div>
            <label htmlFor="dias" className="block font-semibold text-dorado-osc mb-0.5">
              Antiguedad
            </label>
            <span className="flex items-center gap-1">
              <select
                id="campo"
                name="campo"
                defaultValue={campoEdad}
                className="border border-gray-300 rounded px-2 py-1"
              >
                <option value="toque">Sin actividad hace</option>
                <option value="creado">Entro hace</option>
              </select>
              <input
                id="dias"
                name="dias"
                type="number"
                min={0}
                max={3650}
                defaultValue={diasEdad || ""}
                placeholder="dias"
                className="border border-gray-300 rounded px-2 py-1 w-20 text-right"
              />
              <span className="text-gray-500">dias</span>
            </span>
          </div>
          {gestion && GESTIONES[gestion] && (
            <span className="inline-flex items-center gap-1 bg-crema border border-dorado rounded px-2 py-1">
              <input type="hidden" name="gestion" value={gestion} />
              {GESTIONES[gestion]}
              <Link
                href={`/leads?${new URLSearchParams({ ...(busqueda ? { q: busqueda } : {}), ...(estado ? { estado } : {}), ...(dueno ? { dueno } : {}), ...(linea ? { linea } : {}) })}`}
                className="text-gray-500 hover:text-red-700 font-bold"
                aria-label="Quitar este filtro"
              >
                ×
              </Link>
            </span>
          )}
          <button className="bg-verde text-white font-semibold px-3 py-1 rounded">Filtrar</button>
          {(busqueda || estado || dueno || linea || gestion || diasEdad > 0) && (
            <Link href="/leads" className="text-verde underline py-1">
              Quitar filtros
            </Link>
          )}
          <span className="ml-auto flex items-center gap-3 py-1">
            <span className="text-gray-500">{total.toLocaleString("es-CL")} resultados</span>
            <BotonExportarFilas
              nombre="leads"
              titulos={[
                "Id",
                "Nombre",
                "Telefono",
                "Email",
                "Campana",
                "Cotizaciones",
                "Propietario",
                "Comuna",
                "Region",
                "Estado",
                "Origen",
                "Linea",
                "Creado",
                "Ultimo movimiento",
              ]}
              filas={contactos.map((c) => [
                c.id_clientify,
                c.nombre_completo,
                c.telefono,
                c.email,
                c.campana,
                nCot.get(c.id_clientify) ?? "",
                c.propietario,
                c.comuna,
                c.region,
                nombreEstado(c.estado_efectivo),
                c.origen,
                c.linea === "casas" ? LINEAS.casas : LINEAS.paneles,
                dia(c.creado_clientify),
                dia(c.ultimo_toque),
              ])}
            />
            {puedeAsignar && (
              <Link href="/leads/depurar" className="text-verde underline whitespace-nowrap">
                Depurar
              </Link>
            )}
          </span>
        </form>

        {puedeAsignar && (
          <AsignarPropietarioMasivo
            propietarios={(posibles ?? []) as { email: string; nombre: string }[]}
            total={total}
            filtro={filtroActual}
          />
        )}

        {/* Diez columnas que caben en el ancho de la pantalla: sin barra lateral.
            El nombre y los datos de control (fecha, telefono, propietario,
            estado) se ven completos; si falta espacio ceden la campana y el
            origen, que se cortan con "..." y se leen completos al dejar el
            cursor encima. */}
        <div className="bg-white border border-gray-200 rounded">
          <table className="w-full table-fixed text-[11px]">
            <colgroup>
              {puedeAsignar && <col className="w-[3%]" />}
              <col className="w-[6%]" />
              <col className="w-[21%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-verde text-white">
              <tr>
                {puedeAsignar && (
                  <th className="px-2 py-1.5">
                    <input type="checkbox" data-sel-todos aria-label="Marcar todos los de esta pagina" />
                  </th>
                )}
                <th className="text-left px-2 py-1.5">Fecha de creacion</th>
                <th className="text-left px-2 py-1.5">Nombre</th>
                <th className="text-left px-2 py-1.5">Telefono</th>
                <th className="text-left px-2 py-1.5">Email</th>
                <th className="text-left px-2 py-1.5">Propietario</th>
                <th className="text-left px-2 py-1.5">{esPeru ? "Distrito" : "Comuna"}</th>
                <th className="text-left px-2 py-1.5">
                  {esPeru ? "Departamento" : "Region / Provincia"}
                </th>
                <th className="text-left px-2 py-1.5">Estado</th>
                <th className="text-center px-2 py-1.5">Cotizaciones</th>
              </tr>
            </thead>
            <tbody>
              {contactos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                    {totalMercado === 0
                      ? "Todavia no hay leads. Importe el archivo de leads."
                      : "Ningun contacto coincide con la busqueda."}
                  </td>
                </tr>
              ) : (
                contactos.map((c) => (
                  <tr key={c.id_clientify} className="border-t border-gray-100 hover:bg-crema">
                    {puedeAsignar && (
                      <td className="px-2 py-1">
                        <input type="checkbox" data-sel-lead value={c.id_clientify} aria-label={`Marcar ${c.nombre_completo ?? "lead"}`} />
                      </td>
                    )}
                    <td className="px-2 py-1 whitespace-nowrap">{dia(c.creado_clientify)}</td>
                    <td className="px-2 py-1 font-semibold">
                      <div className="flex items-start gap-1 min-w-0">
                        <BanderaDe idPais={c.id_pais} />
                        <PildoraLinea linea={c.linea} />
                        <Link
                          href={`/leads/${c.id_clientify}`}
                          className="min-w-0 break-words text-verde underline"
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
                    <td className="px-2 py-1 break-words">
                      {c.propietario ?? <span className="text-gray-400">Sin propietario</span>}
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
                    <td className="px-2 py-1 break-words">{nombreEstado(c.estado_efectivo)}</td>
                    <td className="px-2 py-1 text-center tabular-nums">{nCot.get(c.id_clientify) || ""}</td>
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
