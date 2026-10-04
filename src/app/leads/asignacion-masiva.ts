"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { puedeEscribirLeads } from "@/lib/leads";
import { aplicarFiltrosLeads, type FiltroLeads } from "@/lib/filtrosLeads";
import type { Resultado } from "@/app/leads/actividad-lead";

const LOTE = 500;
// Lo que se acepta cambiar de una vez; mas alla, se pide acotar con un filtro.
const TOPE = 10000;

// Cambiar el propietario de varios leads: los elegidos en la pagina, o todos los
// que coinciden con el filtro que se esta mirando. Email vacio: sin propietario.
export async function asignarPropietarioMasivo(
  alcance: { ids: number[] } | { filtro: FiltroLeads },
  email: string
): Promise<Resultado> {
  const v = await requerirVendedor();
  if (!puedeEscribirLeads(v)) return { ok: false, mensaje: "Su perfil no permite editar leads." };

  const supabase = await createClient();
  let ids: number[];

  if ("ids" in alcance) {
    ids = [...new Set(alcance.ids.filter((n) => Number.isInteger(n)))];
  } else {
    const { idPaisActivo } = await contextoMercado(v);
    ids = [];
    for (let desde = 0; desde < TOPE + 1; desde += 1000) {
      const { data, error } = await aplicarFiltrosLeads(
        conPais(supabase.from("v_leads").select("id_clientify"), idPaisActivo),
        alcance.filtro
      )
        .order("id_clientify")
        .range(desde, desde + 999);
      if (error) return { ok: false, mensaje: error.message };
      ids.push(...(data ?? []).map((r) => Number(r.id_clientify)));
      if ((data ?? []).length < 1000) break;
    }
    if (ids.length > TOPE)
      return { ok: false, mensaje: `Son mas de ${TOPE.toLocaleString("es-CL")} leads: acote el filtro.` };
  }
  if (ids.length === 0) return { ok: false, mensaje: "No hay leads elegidos." };

  let cambiados = 0;
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await supabase.rpc("lead_asignar_propietario", {
      p_leads: ids.slice(i, i + LOTE),
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
  const sin = ids.length - cambiados;
  return {
    ok: true,
    mensaje: `${cambiados.toLocaleString("es-CL")} leads cambiados${
      sin > 0 ? `; ${sin.toLocaleString("es-CL")} ya tenian ese propietario` : ""
    }.`,
  };
}
