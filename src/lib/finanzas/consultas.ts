import { createClient } from "@/lib/supabase/server";
import { conPais } from "@/lib/sesion";
import { BUCKET_ADJUNTOS } from "@/lib/finanzas/almacen";
import {
  buscarInterlocutores,
  type Categoria,
  type Cuenta,
  type FilaCartola,
  type FilaResumenProyecto,
  type Interlocutor,
  type Movimiento,
  type Proyecto,
  type Tipo,
  type CuentaInterlocutor,
  type PoliticaGasto,
} from "@/lib/finanzas/tipos";

export type Filtro = {
  desde?: string;
  hasta?: string;
  cuenta?: string;
  proyecto?: string;
  estado?: string;
  // Uno solo, elegido de la lista.
  interlocutor?: string;
  // Todos los que coincidan con este texto.
  destino?: string;
};

// Las listas con que se clasifica un movimiento. Se traen tambien las filas
// marcadas como borradas: un movimiento antiguo que apunte a una de ellas
// tiene que seguir mostrando su nombre. El filtrado por `borrado` se hace
// donde se arman los selectores.
export async function cargarMaestros(idPais: number | null) {
  const supabase = await createClient();

  const [cuentas, proyectos, categorias, interlocutores] = await Promise.all([
    conPais(supabase.from("cuentas").select("*").order("alias"), idPais),
    conPais(supabase.from("proyectos").select("*").order("nombre"), idPais),
    conPais(supabase.from("categorias").select("*").order("nombre"), idPais),
    conPais(
      supabase.from("interlocutores").select("*").order("nombre_referencia"),
      idPais
    ),
  ]);

  return {
    cuentas: (cuentas.data ?? []) as Cuenta[],
    proyectos: (proyectos.data ?? []) as Proyecto[],
    categorias: (categorias.data ?? []) as Categoria[],
    interlocutores: (interlocutores.data ?? []) as Interlocutor[],
  };
}

export async function cargarMovimientos(
  tipo: Tipo,
  filtro: Filtro,
  idPais: number | null,
  // Solo hace falta para resolver `filtro.destino`: se busca sobre esta lista,
  // ya cargada por la pagina, en vez de volver a pedirla.
  interlocutores: Interlocutor[] = []
) {
  const supabase = await createClient();

  let q = conPais(
    supabase.from("movimientos").select("*").eq("tipo", tipo),
    idPais
  );

  if (filtro.desde) q = q.gte("fecha", filtro.desde);
  if (filtro.hasta) q = q.lte("fecha", filtro.hasta);
  if (filtro.cuenta) q = q.eq("id_cuenta", Number(filtro.cuenta));
  if (filtro.proyecto) q = q.eq("id_proyecto", Number(filtro.proyecto));
  if (filtro.interlocutor)
    q = q.eq("id_interlocutor", Number(filtro.interlocutor));

  // "termo" trae Termoaislante, Supertermo y cualquier otro que coincida. Se
  // resuelve a un conjunto de ids con la misma busqueda que usa el campo en
  // pantalla, de modo que lo que se ve sugerido es lo que se filtra.
  if (filtro.destino) {
    const ids = buscarInterlocutores(interlocutores, filtro.destino).map(
      (i) => i.id_interlocutor
    );
    // Sin coincidencias no hay resultados: `in` con lista vacia no filtra.
    if (ids.length === 0) return [];
    q = q.in("id_interlocutor", ids);
  }
  if (filtro.estado) q = q.eq("estado_pago", filtro.estado);

  // Los que estan pendientes no tienen fecha todavia: quedan primero.
  const { data } = await q
    .order("fecha", { ascending: false, nullsFirst: true })
    .order("id_mov", { ascending: false });

  return (data ?? []) as Movimiento[];
}

// La cartola se pide a la base entera, no se arma aqui: el saldo es un
// acumulado y tiene que salir de todas las filas del mercado, no de las que
// alcance a ver quien mira. La funcion ya exige el permiso de ver cartola.
export async function cargarCartola(filtro: Filtro, idPais: number | null) {
  const supabase = await createClient();

  const { data } = await supabase.rpc("fin_cartola", {
    p_desde: filtro.desde || null,
    p_hasta: filtro.hasta || null,
    p_cuenta: filtro.cuenta ? Number(filtro.cuenta) : null,
    p_proyecto: filtro.proyecto ? Number(filtro.proyecto) : null,
    p_pais: idPais,
  });

  return (data ?? []) as FilaCartola[];
}

// Lo que entro y salio en cada proyecto, en el periodo que se pida. La suma la
// hace la base por la misma razon que la cartola.
export async function cargarResumenProyecto(
  desde: string | null,
  hasta: string | null,
  idPais: number | null
) {
  const supabase = await createClient();

  const { data } = await supabase.rpc("fin_resumen_proyecto", {
    p_desde: desde || null,
    p_hasta: hasta || null,
    p_pais: idPais,
  });

  return (data ?? []) as FilaResumenProyecto[];
}

// Un enlace por movimiento --el primer respaldo cargado-- resuelto de una vez
// en el servidor, para que la tabla dibuje un enlace de verdad en vez de
// pedirlo al hacer clic: eso rompia el gesto y el navegador bloqueaba la
// ventana emergente.
export async function cargarEnlacesRespaldo(
  idsMov: number[]
): Promise<Record<number, string>> {
  if (idsMov.length === 0) return {};
  const supabase = await createClient();

  const { data } = await supabase
    .from("adjuntos")
    .select("id_mov, ruta, subido_en")
    .in("id_mov", idsMov)
    .order("subido_en", { ascending: true });

  const primeraRuta = new Map<number, string>();
  for (const fila of data ?? []) {
    if (!primeraRuta.has(fila.id_mov)) primeraRuta.set(fila.id_mov, fila.ruta);
  }

  const firmadas = await Promise.all(
    [...primeraRuta.entries()].map(async ([idMov, ruta]) => {
      const { data: firmada } = await supabase.storage
        .from(BUCKET_ADJUNTOS)
        .createSignedUrl(ruta, 60 * 10);
      return [idMov, firmada?.signedUrl ?? null] as const;
    })
  );

  const enlaces: Record<number, string> = {};
  for (const [idMov, url] of firmadas) if (url) enlaces[idMov] = url;
  return enlaces;
}

export async function cargarCuentasInterlocutores() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interlocutor_cuentas")
    .select("*")
    .order("id_int_cuenta");
  return (data ?? []) as CuentaInterlocutor[];
}

export async function cargarPoliticas(idPais: number | null) {
  const supabase = await createClient();
  const { data } = await conPais(
    supabase
      .from("politicas_gasto")
      .select("id_politica, id_pais, id_categoria, tope, bloquea, activa")
      .eq("activa", true)
      .order("id_categoria", { nullsFirst: true }),
    idPais
  );
  return (data ?? []) as PoliticaGasto[];
}
