import { createClient } from "@/lib/supabase/server";

export type Parametros = Record<string, { num: number | null; texto: string | null }>;

// Los datos de empresa (razon social, RUT, banco, notas del pie) se leen de la
// base, igual que pTxt()/pNum() en Access: cambiarlos no exige un despliegue.
//
// Se lee v_parametros_publicos y no la tabla: parametros esta restringida a
// Administrador por RLS, y estos valores los necesita cualquier vendedor para
// armar el PDF. La vista expone solo la lista blanca, sin MargenObjetivo.
export async function leerParametros(): Promise<Parametros> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_parametros_publicos").select("*");
  const out: Parametros = {};
  for (const p of data ?? []) {
    out[p.clave] = { num: p.valor_num, texto: p.valor_texto };
  }
  return out;
}

export function pTxt(p: Parametros, clave: string, porDefecto = ""): string {
  return p[clave]?.texto ?? porDefecto;
}

export function pNum(p: Parametros, clave: string, porDefecto = 0): number {
  return p[clave]?.num ?? porDefecto;
}
