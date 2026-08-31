// Cliente de Supabase para Server Components, Route Handlers y Server Actions.
// La sesion viaja en cookies httpOnly, gestionadas por @supabase/ssr.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { ESQUEMA } from "@/lib/supabase/esquema";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Produccion o la copia de pruebas, segun la configuracion de este
      // despliegue.
      db: { schema: ESQUEMA },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura;
            // el middleware ya refresca la sesion, asi que no pasa nada.
          }
        },
      },
    }
  );
}
