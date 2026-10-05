"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { puedeEscribirLeads } from "@/lib/leads";
import { aplicarFiltrosLeads, type FiltroLeads } from "@/lib/filtrosLeads";
import { estadosParaFiltros } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import type { Resultado } from "@/app/leads/actividad-lead";

const LOTE = 500;
// Lo que se acepta cambiar de una vez; mas alla, se pide acotar con un filtro.
const TOPE = 10000;

// Los leads sobre los que se va a actuar: los marcados en la pagina, o todos los
// que coinciden con el filtro. Lo que el filtro alcanza lo decide la base, que
// ya recorta por pais y por perfil.
async function idsDelAlcance(
  alcance: { ids: number[] } | { filtro: FiltroLeads },
  v: Awaited<ReturnType<typeof requerirVendedor>>
): Promise<{ lista: number[] } | { error: string }> {
  if ("ids" in alcance)
    return { lista: [...new Set(alcance.ids.filter((n) => Number.isInteger(n)))] };

  const supabase = await createClient();
  const { idPaisActivo } = await contextoMercado(v);
  const estados = estadosParaFiltros(await catalogoEstados());
  const lista: number[] = [];
  for (let desde = 0; desde < TOPE + 1; desde += 1000) {
    const { data, error } = await aplicarFiltrosLeads(
      conPais(supabase.from("v_leads").select("id_clientify"), idPaisActivo),
      alcance.filtro,
      estados
    )
      .order("id_clientify")
      .range(desde, desde + 999);
    if (error) return { error: error.message };
    lista.push(...(data ?? []).map((r) => Number(r.id_clientify)));
    if ((data ?? []).length < 1000) break;
  }
  if (lista.length > TOPE)
    return { error: `Son mas de ${TOPE.toLocaleString("es-CL")} leads: acote el filtro.` };
  return { lista };
}

// Cambiar el propietario de varios leads: los elegidos en la pagina, o todos los
// que coinciden con el filtro que se esta mirando. Email vacio: sin propietario.
export async function asignarPropietarioMasivo(
  alcance: { ids: number[] } | { filtro: FiltroLeads },
  email: string
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite editar leads." };

  const ids = await idsDelAlcance(alcance, v);
  if ("error" in ids) return { ok: false, mensaje: ids.error };
  if (ids.lista.length === 0) return { ok: false, mensaje: "No hay leads elegidos." };

  const supabase = await createClient();
  let cambiados = 0;
  for (let i = 0; i < ids.lista.length; i += LOTE) {
    const { data, error } = await supabase.rpc("lead_asignar_propietario", {
      p_leads: ids.lista.slice(i, i + LOTE),
      p_email: email,
    });
    if (error)
      return {
        ok: false,
        mensaje: `${error.message}${cambiados ? ` (ya se habian cambiado ${cambiados})` : ""}`,
      };
    cambiados += Number((data as { cambiados?: number } | null)?.cambiados ?? 0);
  }

  revalidatePath("/leads");
  revalidatePath("/leads/depurar");
  const sin = ids.lista.length - cambiados;
  return {
    ok: true,
    mensaje: `${cambiados.toLocaleString("es-CL")} leads cambiados${
      sin > 0 ? `; ${sin.toLocaleString("es-CL")} ya tenian ese propietario` : ""
    }.`,
  };
}

// Cambiar el estado de varios leads de una vez. El alcance se elige igual que en
// el cambio de propietario: los marcados en la pagina, o todos los que coinciden
// con el filtro que se esta mirando --que es como se depura un grupo entero--.
export async function cambiarEstadoMasivo(
  alcance: { ids: number[] } | { filtro: FiltroLeads },
  estado: string
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite editar leads." };
  if (!estado) return { ok: false, mensaje: "Elija el estado al que pasan." };

  const ids = await idsDelAlcance(alcance, v);
  if ("error" in ids) return { ok: false, mensaje: ids.error };
  if (ids.lista.length === 0) return { ok: false, mensaje: "No hay leads elegidos." };

  const supabase = await createClient();
  let cambiados = 0;
  for (let i = 0; i < ids.lista.length; i += LOTE) {
    const { data, error } = await supabase.rpc("lead_fijar_estado_masivo", {
      p_leads: ids.lista.slice(i, i + LOTE),
      p_estado: estado,
    });
    if (error)
      return {
        ok: false,
        mensaje: `${error.message}${cambiados ? ` (ya se habian cambiado ${cambiados})` : ""}`,
      };
    cambiados += Number((data as { cambiados?: number } | null)?.cambiados ?? 0);
  }

  revalidatePath("/leads");
  revalidatePath("/leads/depurar");
  revalidatePath("/");
  const sin = ids.lista.length - cambiados;
  return {
    ok: true,
    mensaje: `${cambiados.toLocaleString("es-CL")} leads cambiados${
      sin > 0 ? `; ${sin.toLocaleString("es-CL")} ya estaban en ese estado` : ""
    }.`,
  };
}
