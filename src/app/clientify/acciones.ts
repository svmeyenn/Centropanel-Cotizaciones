"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { contactosClientify, hayClaveClientify } from "@/lib/clientify";

export interface ResultadoSync {
  ok?: boolean;
  leidos?: number;
  quitados?: number;
  error?: string;
}

// Trae todos los contactos de Clientify y deja la copia igual a lo que hay
// alla: los nuevos se agregan, los cambiados se actualizan y los que ya no
// estan se quitan. Lo hace el sistema solo; no depende de nadie mas.
export async function sincronizarClientify(): Promise<ResultadoSync> {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v))
    return { error: "Solo el Administrador o el Supervisor puede sincronizar." };
  if (!hayClaveClientify())
    return { error: "Falta cargar la clave de Clientify (CLIENTIFY_API_KEY) en Vercel." };

  const supabase = await createClient();
  const inicio = new Date().toISOString();

  const { data: corrida, error: errCorrida } = await supabase
    .from("clientify_sincronizaciones")
    .insert({ inicio })
    .select("id")
    .single();
  if (errCorrida) return { error: errCorrida.message };

  let leidos = 0;
  try {
    for await (const pagina of contactosClientify()) {
      // El upsert solo pisa las columnas que se mandan: el enlace con la ficha
      // (id_entidad) sobrevive a cada sincronizacion.
      const { error } = await supabase
        .from("clientify_contactos")
        .upsert(
          pagina.map((c) => ({ ...c, sincronizado_en: inicio })),
          { onConflict: "id_clientify" }
        );
      if (error) throw new Error(error.message);
      leidos += pagina.length;
    }

    // Lo que no se vio en esta vuelta ya no existe en Clientify. Solo se quita
    // si se leyo algo: una respuesta vacia por error no debe vaciar la copia.
    let quitados = 0;
    if (leidos > 0) {
      const { data: borrados, error } = await supabase
        .from("clientify_contactos")
        .delete()
        .lt("sincronizado_en", inicio)
        .select("id_clientify");
      if (error) throw new Error(error.message);
      quitados = borrados?.length ?? 0;
    }

    await supabase
      .from("clientify_sincronizaciones")
      .update({ fin: new Date().toISOString(), estado: "ok", leidos, quitados })
      .eq("id", corrida.id);

    revalidatePath("/clientify");
    return { ok: true, leidos, quitados };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido.";
    await supabase
      .from("clientify_sincronizaciones")
      .update({ fin: new Date().toISOString(), estado: "con error", leidos, error: mensaje })
      .eq("id", corrida.id);
    revalidatePath("/clientify");
    return { error: mensaje };
  }
}
