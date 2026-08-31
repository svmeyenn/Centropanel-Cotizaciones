// Cliente de Supabase para componentes de cliente ("use client").
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { ESQUEMA } from "@/lib/supabase/esquema";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: ESQUEMA } }
  );
}
