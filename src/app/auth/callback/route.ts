import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino del enlace que llega por correo al pedir "olvide mi contrasena".
// Supabase devuelve un codigo de un solo uso; aqui se canjea por una sesion y
// se manda a la persona a elegir su clave nueva.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/cambiar-clave";
  // Solo rutas internas: un "next" armado a mano no debe sacar a nadie del sitio.
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }

  // Enlace vencido, ya usado o abierto en otro navegador.
  return NextResponse.redirect(new URL("/recuperar?error=enlace", url.origin));
}
