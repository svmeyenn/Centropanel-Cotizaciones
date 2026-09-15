import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

// Como se llama el identificador tributario en un pais: RUT en Chile, RUC en
// Peru. Sin pais indicado vale el mercado de quien opera, que es el que la base
// le pone al registro.
export async function etiquetaIdDe(idPais?: number | null): Promise<string> {
  const supabase = await createClient();
  let consulta = supabase.from("paises").select("etiqueta_id");
  if (idPais) {
    consulta = consulta.eq("id", idPais);
  } else {
    const v = await requerirVendedor();
    consulta = consulta.eq("codigo", v.mercado === "Peru" ? "PE" : "CL");
  }
  const { data } = await consulta.maybeSingle();
  return (data?.etiqueta_id as string | undefined) ?? "RUT";
}
