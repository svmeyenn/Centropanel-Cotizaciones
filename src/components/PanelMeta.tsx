"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  agregarMetaComoLead,
  aplicarMasivoMeta,
  aplicarMeta,
  cargarLoteMeta,
  ignorarMeta,
  type TipoMasivo,
} from "@/app/leads/meta/acciones";
import {
  comparar,
  filasDeArchivoMeta,
  grupoDe,
  traeContacto,
  type CampoMeta,
  type FilaMeta,
  type Grupo,
  type ModoMeta,
} from "@/lib/meta";

const POR_PAGINA = 25;

const GRUPOS: { clave: Grupo; titulo: string; ayuda: string }[] = [
  { clave: "diferencias", titulo: "Con diferencias", ayuda: "El lead existe pero un dato no coincide con Meta: corrijalo o sume el de Meta." },
  { clave: "faltantes", titulo: "Con datos por agregar", ayuda: "El lead existe y le faltan datos que Meta si tiene." },
  { clave: "nuevo", titulo: "Nuevos", ayuda: "No hay ningun lead con ese email, telefono o nombre." },
  { clave: "al_dia", titulo: "Al dia", ayuda: "El lead ya tiene todo lo que trae Meta." },
  { clave: "ignorado", titulo: "Ignorados", ayuda: "Los que se dejaron de lado." },
];

const BOTON =
  "border border-gray-300 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";
const BOTON_VERDE =
  "bg-verde text-white text-[11px] font-semibold px-2.5 py-0.5 rounded disabled:opacity-50";

const ESTADO_TONO = {
  igual: "text-green-700",
  falta: "text-amber-700",
  distinto: "text-red-700",
} as const;
const ESTADO_TEXTO = { igual: "Igual", falta: "Falta en el lead", distinto: "Distinto" } as const;

const VIA = { email: "el email", telefono: "el telefono", nombre: "el nombre" } as const;

const cuando = (f: string | null) =>
  f
    ? new Intl.DateTimeFormat("es-CL", {
        timeZone: "America/Santiago",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(f))
    : "";

// --- Subir el archivo -------------------------------------------------------

function SubirArchivo() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  async function cargar(archivo: File) {
    setMensaje(null);
    const filas = filasDeArchivoMeta(await archivo.text());
    if (!filas || filas.length === 0) {
      setMensaje({ texto: "El archivo no parece una descarga de leads de Meta (falta la columna Nombre).", error: true });
      return;
    }
    setAvance({ hechos: 0, total: filas.length });
    let guardados = 0;
    for (let i = 0; i < filas.length; i += 100) {
      const r = await cargarLoteMeta(filas.slice(i, i + 100));
      if (r.error) {
        setAvance(null);
        setMensaje({ texto: r.error, error: true });
        return;
      }
      guardados += r.guardados ?? 0;
      setAvance({ hechos: Math.min(i + 100, filas.length), total: filas.length });
    }
    setAvance(null);
    setMensaje({
      texto: `${guardados} filas leidas. Las que ya estaban cargadas no se repiten.`,
      error: false,
    });
    if (entrada.current) entrada.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={BOTON_VERDE}
        disabled={avance !== null}
        onClick={() => entrada.current?.click()}
      >
        {avance ? `Cargando ${avance.hechos} de ${avance.total}...` : "Subir archivo de Meta (.csv)"}
      </button>
      <input
        ref={entrada}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Archivo CSV de leads de Meta"
        onChange={(e) => {
          const a = e.target.files?.[0];
          if (a) cargar(a);
        }}
      />
      {mensaje && (
        <span className={mensaje.error ? "text-red-600" : "text-green-700"} role={mensaje.error ? "alert" : "status"}>
          {mensaje.texto}
        </span>
      )}
    </div>
  );
}

// --- Una fila de Meta -------------------------------------------------------

function TarjetaMeta({ f }: { f: FilaMeta }) {
  const router = useRouter();
  const [pendiente, comenzar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [confirmaNuevo, setConfirmaNuevo] = useState(false);
  const campos = comparar(f);
  const grupo = grupoDe(f);

  function correr(accion: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setAviso(null);
    comenzar(async () => {
      const r = await accion();
      setConfirmaNuevo(false);
      if (!r.ok) setAviso({ ok: false, texto: r.mensaje ?? "No se pudo." });
      else router.refresh();
    });
  }
  const aplicar = (campo: CampoMeta, modo: ModoMeta) => correr(() => aplicarMeta(f.id, [{ campo, modo }]));

  return (
    <article className="bg-white border border-gray-200 rounded overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-crema px-3 py-1 border-b border-gray-200">
        <span className="font-semibold text-[12px]">{f.nombre}</span>
        <span className="text-gray-500">{cuando(f.fecha_meta)}</span>
        {[f.origen_meta, f.canal, f.formulario, f.etapa].filter(Boolean).map((x, i) => (
          <span key={i} className="text-[10px] border border-gray-300 rounded px-1 text-gray-600 bg-white">
            {x}
          </span>
        ))}
        <span className="ml-auto text-gray-600">
          {f.id_lead ? (
            <>
              Coincide por {VIA[f.via ?? "nombre"]} con{" "}
              <Link
                href={`/leads/${f.id_lead}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-verde underline font-semibold"
              >
                {f.lead_nombre || "(sin nombre)"}
              </Link>
              {f.via === "nombre" && <span className="text-amber-700"> · solo por el nombre: confirme que es la misma persona</span>}
            </>
          ) : (
            <span className="text-gray-500">No existe en el sistema</span>
          )}
        </span>
      </header>

      {f.id_lead ? (
        <table className="w-full">
          <thead className="text-dorado-osc text-[10px] uppercase">
            <tr>
              <th className="text-left px-3 py-0.5 w-32">Campo</th>
              <th className="text-left px-3 py-0.5">En el lead</th>
              <th className="text-left px-3 py-0.5">En Meta</th>
              <th className="text-left px-3 py-0.5 w-32">Estado</th>
              <th className="px-3 py-0.5 w-52" />
            </tr>
          </thead>
          <tbody>
            {campos.map((c) => (
              <tr key={c.campo} className="border-t border-gray-100">
                <td className="px-3 py-0.5 font-semibold">{c.etiqueta}</td>
                <td className="px-3 py-0.5 break-all">{c.lead || <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-0.5 break-all">{c.meta}</td>
                <td className={`px-3 py-0.5 font-semibold ${ESTADO_TONO[c.estado]}`}>{ESTADO_TEXTO[c.estado]}</td>
                <td className="px-3 py-0.5 text-right whitespace-nowrap">
                  {c.estado !== "igual" && (
                    <span className="inline-flex gap-1">
                      {c.estado === "distinto" && c.puedeCorregir && (
                        <button className={BOTON_VERDE} disabled={pendiente} onClick={() => aplicar(c.campo, "corregir")}>
                          Corregir
                        </button>
                      )}
                      {c.puedeAgregar && (
                        <button
                          className={c.estado === "falta" ? BOTON_VERDE : BOTON}
                          disabled={pendiente}
                          onClick={() => aplicar(c.campo, "agregar")}
                        >
                          Agregar dato
                        </button>
                      )}
                      {c.estado === "falta" && !c.puedeAgregar && (
                        <button className={BOTON_VERDE} disabled={pendiente} onClick={() => aplicar(c.campo, "corregir")}>
                          Agregar dato
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <dl className="grid gap-x-4 gap-y-0.5 px-3 py-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Email", f.email],
            ["Telefono", f.telefono],
            ["Telefono secundario", f.telefono2],
            ["WhatsApp", f.whatsapp],
          ].map(([e, v]) => (
            <div key={e as string}>
              <dt className="text-[9px] font-semibold text-dorado-osc uppercase">{e}</dt>
              <dd>{v || <span className="text-gray-400">—</span>}</dd>
            </div>
          ))}
        </dl>
      )}

      <footer className="flex flex-wrap items-center gap-2 px-3 py-1 border-t border-gray-100 bg-gray-50">
        {grupo === "ignorado" ? (
          <button className={BOTON} disabled={pendiente} onClick={() => correr(() => ignorarMeta(f.id, false))}>
            Volver a la lista
          </button>
        ) : confirmaNuevo ? (
          <>
            <span className="text-gray-700">
              {f.id_lead
                ? "Ya hay un lead parecido: se creara otro, separado. ¿Seguro?"
                : "Se creara un lead nuevo con estos datos. ¿Seguro?"}
            </span>
            <button className={BOTON_VERDE} disabled={pendiente} onClick={() => correr(() => agregarMetaComoLead(f.id))}>
              {pendiente ? "Agregando..." : "Si, agregar"}
            </button>
            <button className={BOTON} disabled={pendiente} onClick={() => setConfirmaNuevo(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button
              className={f.id_lead ? BOTON : BOTON_VERDE}
              disabled={pendiente}
              onClick={() => setConfirmaNuevo(true)}
            >
              Agregar como lead nuevo
            </button>
            <button className={BOTON} disabled={pendiente} onClick={() => correr(() => ignorarMeta(f.id, true))}>
              Ignorar
            </button>
          </>
        )}
        {aviso && (
          <span className={aviso.ok ? "text-green-700" : "text-red-600"} role="alert">
            {aviso.texto}
          </span>
        )}
      </footer>
    </article>
  );
}

// --- La pantalla ------------------------------------------------------------

export default function PanelMeta({ filas }: { filas: FilaMeta[] }) {
  const router = useRouter();
  const porGrupo = useMemo(() => {
    const m: Record<Grupo, FilaMeta[]> = { nuevo: [], diferencias: [], faltantes: [], al_dia: [], ignorado: [] };
    for (const f of filas) m[grupoDe(f)].push(f);
    return m;
  }, [filas]);

  const inicial =
    GRUPOS.find((g) => g.clave !== "al_dia" && g.clave !== "ignorado" && porGrupo[g.clave].length > 0)?.clave ??
    "al_dia";
  const [grupo, setGrupo] = useState<Grupo>(inicial);
  const [pagina, setPagina] = useState(1);
  const [masivo, setMasivo] = useState<TipoMasivo | null>(null);
  const [trabajando, comenzar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const lista = porGrupo[grupo];
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const visibles = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const nuevosConContacto = porGrupo.nuevo.filter(traeContacto).length;
  const nuevosSinContacto = porGrupo.nuevo.length - nuevosConContacto;
  const faltantesSeguros = porGrupo.faltantes.filter((f) => f.via === "email" || f.via === "telefono").length;

  const MASIVOS: Record<TipoMasivo, { texto: string; n: number; aviso: string }> = {
    faltantes: {
      texto: "Agregar todos los datos que faltan",
      n: faltantesSeguros,
      aviso: "Se agregara a cada lead lo que le falta, solo en los que coinciden por email o telefono. Lo que difiere no se toca.",
    },
    nuevos_con_contacto: {
      texto: "Agregar todos los nuevos con email o telefono",
      n: nuevosConContacto,
      aviso: "Se creara un lead por cada uno.",
    },
    nuevos_sin_contacto: {
      texto: "Agregar los nuevos que solo traen nombre",
      n: nuevosSinContacto,
      aviso: "Son contactos de Instagram o Messenger sin email ni telefono: se creara un lead con solo el nombre.",
    },
  };
  const visiblesMasivos: TipoMasivo[] =
    grupo === "faltantes" ? ["faltantes"] : grupo === "nuevo" ? ["nuevos_con_contacto", "nuevos_sin_contacto"] : [];

  function aplicarMasivo(tipo: TipoMasivo) {
    setAviso(null);
    comenzar(async () => {
      const r = await aplicarMasivoMeta(tipo);
      setMasivo(null);
      setAviso({ ok: r.ok, texto: r.mensaje ?? "Listo." });
      router.refresh();
    });
  }

  return (
    <>
      <section className="bg-white border border-gray-200 rounded p-3 space-y-2">
        <SubirArchivo />
        <p className="text-gray-500">
          Descargue los leads desde Meta como CSV y subalos aqui. Cada fila se compara con los leads por email,
          despues por telefono y, solo como pista, por nombre. Lo que ya estaba cargado no se repite ni pierde lo
          que ya resolvio.
        </p>
      </section>

      {filas.length === 0 ? (
        <p className="bg-white border border-gray-200 rounded p-6 text-center text-gray-400">
          Todavia no se ha subido ningun archivo de Meta.
        </p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-1.5" aria-label="Grupos">
            {GRUPOS.map((g) => (
              <button
                key={g.clave}
                type="button"
                onClick={() => {
                  setGrupo(g.clave);
                  setPagina(1);
                  setMasivo(null);
                  setAviso(null);
                }}
                aria-pressed={grupo === g.clave}
                className={`rounded border px-2.5 py-1 font-semibold ${
                  grupo === g.clave ? "bg-verde text-white border-verde" : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {g.titulo} ({porGrupo[g.clave].length})
              </button>
            ))}
          </nav>
          <p className="text-gray-600">{GRUPOS.find((g) => g.clave === grupo)?.ayuda}</p>

          {visiblesMasivos.length > 0 && lista.length > 0 && (
            <div className="bg-crema border border-gray-200 rounded px-3 py-1.5 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {visiblesMasivos.map((t) => (
                  <button
                    key={t}
                    className={BOTON}
                    disabled={trabajando || MASIVOS[t].n === 0}
                    onClick={() => setMasivo(t)}
                  >
                    {MASIVOS[t].texto} ({MASIVOS[t].n})
                  </button>
                ))}
              </div>
              {masivo && (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    {MASIVOS[masivo].aviso} Son {MASIVOS[masivo].n}. ¿Seguro?
                  </span>
                  <button className={BOTON_VERDE} disabled={trabajando} onClick={() => aplicarMasivo(masivo)}>
                    {trabajando ? "Trabajando..." : "Si, aplicar"}
                  </button>
                  <button className={BOTON} disabled={trabajando} onClick={() => setMasivo(null)}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
          {aviso && (
            <p className={aviso.ok ? "text-green-700" : "text-red-600"} role="status">
              {aviso.texto}
            </p>
          )}

          {lista.length === 0 ? (
            <p className="bg-white border border-gray-200 rounded p-6 text-center text-gray-400">
              No hay leads en este grupo.
            </p>
          ) : (
            <div className="space-y-2">
              {visibles.map((f) => (
                <TarjetaMeta key={f.id} f={f} />
              ))}
            </div>
          )}

          {paginas > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button className={BOTON} disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
                ← Anterior
              </button>
              <span>
                Pagina {pagina} de {paginas}
              </span>
              <button className={BOTON} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
