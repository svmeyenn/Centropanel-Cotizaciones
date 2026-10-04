import BandaDivisas from "@/components/BandaDivisas";
import Bandera from "@/components/Bandera";
import Cabecera from "@/components/Cabecera";
import PanelDesempeno, { type Desempeno } from "@/components/PanelDesempeno";
import PestanasInicio from "@/components/inicio/PestanasInicio";
import SelectorAlcance from "@/components/inicio/SelectorAlcance";
import ResumenGestion from "@/components/inicio/ResumenGestion";
import Agenda from "@/components/inicio/Agenda";
import BandejaLeads from "@/components/inicio/BandejaLeads";
import CotizacionesEnJuego from "@/components/inicio/CotizacionesEnJuego";
import PanelLeads from "@/components/inicio/PanelLeads";
import Cumplimiento from "@/components/inicio/Cumplimiento";
import type { CumplimientoFila, Gestion, PanelLeadsDatos } from "@/components/inicio/tipos";
import { cargarParidades } from "@/lib/divisas";
import { SIN_PROPIETARIO } from "@/lib/filtrosLeads";
import { contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { VERSION } from "@/lib/version";
import { ES_SANDBOX } from "@/lib/supabase/esquema";

// El inicio tiene dos caras que no se mezclan:
//  - Mi gestion: lo que hay que hacer. La agenda de esta semana y la proxima
//    (compromisos con leads, acciones de cotizaciones y entregas), los leads
//    que esperan y las cotizaciones en juego. Un vendedor ve lo suyo; quien
//    dirige o consulta elige ver el equipo, lo propio o a una persona.
//  - Desempeno: como va el negocio en el mes. Ventas, leads y cumplimiento,
//    un bloque por mercado porque pesos y soles no se suman.
// Los numeros los arma la base (inicio_gestion, panel_desempeno, panel_leads,
// panel_seguimiento), que tambien decide que puede ver cada perfil.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; vista?: string; quien?: string }>;
}) {
  const v = await requerirVendedor();
  const { mes, vista: vistaPedida, quien: quienPedido } = await searchParams;
  const vista = vistaPedida === "desempeno" ? "desempeno" : "gestion";

  const { idPaisActivo, activo, accesibles } = await contextoMercado(v);
  const supabase = await createClient();

  // Las paridades del mercado en que se trabaja: desde Chile el dolar y la UF;
  // desde Peru, el sol. Con los dos mercados a la vista, una banda por pais.
  const mercados = activo ? [activo] : accesibles;
  const bandas = await Promise.all(
    mercados.map(async (p) => ({ codigo: p.codigo, nombre: p.nombre, paridades: await cargarParidades(p.codigo) }))
  );

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="INICIO"
        subtitulo={vista === "gestion" ? "Lo que hay que hacer hoy y lo que viene" : "Como va el negocio este mes"}
      />
      <div className="max-w-screen-2xl mx-auto p-4 space-y-3">
        <BandaDivisas bandas={bandas} />
        {vista === "gestion" ? (
          <VistaGestion v={v} idPaisActivo={idPaisActivo} quienPedido={quienPedido} supabase={supabase} mercado={activo?.codigo ?? null} />
        ) : (
          <VistaDesempeno mercados={mercados} mes={mes} supabase={supabase} />
        )}

        {/* Version vigente: sube con cada entrega a produccion (VERSIONES.md).
            En pruebas se aclara que hay cambios que aun no estan en ella. */}
        <p className="text-[10px] text-gray-500">
          Sesion: {v.nombre} ({v.rol}) · Version {VERSION}
          {ES_SANDBOX ? " · con cambios en prueba aun no publicados" : ""}
        </p>
      </div>
    </div>
  );
}

type Supa = Awaited<ReturnType<typeof createClient>>;
type Vend = Awaited<ReturnType<typeof requerirVendedor>>;

async function VistaGestion({
  v,
  idPaisActivo,
  quienPedido,
  supabase,
  mercado,
}: {
  v: Vend;
  idPaisActivo: number | null;
  quienPedido?: string;
  supabase: Supa;
  mercado: string | null;
}) {
  // Quien dirige o consulta puede mirar el equipo, lo suyo o a una persona; por
  // defecto el equipo. Un vendedor siempre ve lo suyo (la base lo fuerza).
  const esJefe = tienePerfilAdmin(v) || v.rol === "Consulta";
  const alcance = !esJefe
    ? "yo"
    : quienPedido === "yo"
      ? "yo"
      : quienPedido && /^\d+$/.test(quienPedido)
        ? quienPedido
        : "equipo";
  const pQuien = alcance === "equipo" ? null : alcance === "yo" ? v.id : Number(alcance);

  const [{ data, error }, { data: equipoDb }] = await Promise.all([
    supabase.rpc("inicio_gestion", { p_pais: idPaisActivo, p_quien: pQuien }),
    esJefe
      ? supabase
          .from("vendedores")
          .select("id, nombre, mercado")
          .eq("activo", true)
          .neq("rol", "Consulta")
          .in("mercado", mercado ? ["Ambos", mercado === "PE" ? "Peru" : "Chile"] : ["Ambos", "Chile", "Peru"])
          .order("nombre")
      : Promise.resolve({ data: [] }),
  ]);
  const g = data as Gestion | null;

  if (!g) {
    return (
      <>
        <PestanasInicio vista="gestion" />
        <p className="text-sm text-red-700">No se pudo cargar la gestion{error ? `: ${error.message}` : ""}.</p>
      </>
    );
  }

  const equipo = (equipoDb ?? []) as { id: number; nombre: string }[];
  const verEquipo = g.quien == null;
  const nombreDe = equipo.find((p) => p.id === g.quien)?.nombre;
  const dueno = g.mis_emails.length > 0 ? g.mis_emails.join(",") : "";
  const hrefLeads = (que: "sin_contactar" | "sin_seguimiento" | "sin_propietario") => {
    if (que === "sin_propietario") return `/leads?dueno=${SIN_PROPIETARIO}`;
    const s = new URLSearchParams({ gestion: que });
    if (!verEquipo && dueno) s.set("dueno", dueno);
    return `/leads?${s}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PestanasInicio vista="gestion" quien={esJefe && alcance !== "equipo" ? alcance : undefined} />
        <div className="flex flex-wrap items-center gap-3 pb-1">
          <span className="text-[11px] text-gray-600">
            {verEquipo
              ? "Gestion de todo el equipo"
              : g.quien === v.id
                ? "Su gestion"
                : `Gestion de ${nombreDe ?? "la persona elegida"}`}
          </span>
          {esJefe && <SelectorAlcance valor={alcance} yo={v.id} equipo={equipo} />}
        </div>
      </div>

      <ResumenGestion g={g} hrefLeads={hrefLeads} />

      <Agenda items={g.agenda} hoy={g.hoy} lunes={g.lunes} puedeEditar={v.puede_editar} verResponsable={verEquipo} />

      <BandejaLeads
        g={g}
        verPropietario={verEquipo}
        hrefSinContactar={hrefLeads("sin_contactar")}
        hrefSinSeguimiento={hrefLeads("sin_seguimiento")}
      />

      <CotizacionesEnJuego g={g} verEjecutivo={verEquipo} />
    </>
  );
}

async function VistaDesempeno({
  mercados,
  mes,
  supabase,
}: {
  mercados: { id: number; codigo: string; nombre: string; moneda_base: string }[];
  mes?: string;
  supabase: Supa;
}) {
  // Llega como AAAA-MM desde el selector; la base espera una fecha.
  const mesBase = /^\d{4}-\d{2}$/.test(mes ?? "") ? `${mes}-01` : null;

  // Un bloque por mercado: los montos de Chile son pesos y los de Peru soles, y
  // sumarlos no daria ninguna cifra.
  const tableros = await Promise.all(
    mercados.map(async (p) => {
      const [{ data: panel }, { data: seg }, { data: leads }] = await Promise.all([
        supabase.rpc("panel_desempeno", { p_pais: p.id, p_mes: mesBase }),
        supabase.rpc("panel_seguimiento", { p_pais: p.id, p_mes: mesBase }),
        supabase.rpc("panel_leads", { p_pais: p.id, p_mes: mesBase }),
      ]);
      return {
        pais: p,
        desempeno: panel as Desempeno | null,
        cumpleCot: ((seg as { cumplimiento?: CumplimientoFila[] } | null)?.cumplimiento ?? []) as CumplimientoFila[],
        leads: leads as PanelLeadsDatos | null,
      };
    })
  );

  return (
    <>
      <PestanasInicio vista="desempeno" mes={mes} />
      {tableros.map(({ pais, desempeno, cumpleCot, leads }) => (
        <section key={pais.codigo} aria-labelledby={`mercado-${pais.codigo}`} className="space-y-3">
          <h2
            id={`mercado-${pais.codigo}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-verde border-b border-verde pb-0.5"
          >
            <Bandera codigo={pais.codigo} />
            {pais.nombre.toUpperCase()} · montos en {pais.moneda_base === "PEN" ? "soles" : "pesos chilenos"}
          </h2>

          <Subtitulo>Ventas</Subtitulo>
          {desempeno ? (
            <PanelDesempeno d={desempeno} />
          ) : (
            <p className="text-sm text-gray-500">No se pudo cargar el desempeno de ventas.</p>
          )}

          <Subtitulo>Leads</Subtitulo>
          {leads ? <PanelLeads d={leads} /> : <p className="text-sm text-gray-500">No se pudo cargar el desempeno de leads.</p>}

          <Subtitulo>Seguimiento</Subtitulo>
          <Cumplimiento cotizaciones={cumpleCot} leads={leads?.cumplimiento ?? []} />
        </section>
      ))}
    </>
  );
}

function Subtitulo({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold text-dorado-osc uppercase tracking-wide pt-1">{children}</h3>;
}
