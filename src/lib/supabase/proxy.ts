// Refresca la sesion en cada request y protege las rutas que no sean /login.
// (Se llamaba middleware.ts; Next 16 renombro la convencion a "proxy".)
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  // La ruta viaja en una cabecera para que el layout sepa si toca mostrar el
  // menu lateral: un layout de Next no recibe la direccion pedida.
  request.headers.set("x-ruta", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esLogin = ruta.startsWith("/login");
  // Recuperar la clave se hace sin sesion: es justamente para quien no puede
  // entrar. /auth/callback canjea el enlace del correo por una sesion.
  const esRecuperacion = ruta.startsWith("/recuperar") || ruta.startsWith("/auth/");

  // Si Supabase no acepta la direccion de retorno pedida, manda el enlace del
  // correo a la raiz con el codigo. Se reencamina al canje en vez de perderlo.
  if (ruta === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (!url.searchParams.has("next")) url.searchParams.set("next", "/cambiar-clave");
    return NextResponse.redirect(url);
  }
  // /c/<token> es la cotizacion que se le manda al cliente: se abre sin cuenta.
  // La proteccion no es la sesion sino el token (uuid v4) y la funcion
  // cotizacion_publica, que solo devuelve lo que va impreso.
  const esPublica = request.nextUrl.pathname.startsWith("/c/");
  const esEstatico =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.includes(".");

  if (!user && !esLogin && !esRecuperacion && !esPublica && !esEstatico) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && esLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
