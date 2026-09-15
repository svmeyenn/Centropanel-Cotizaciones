"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_MERCADO, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";

// Cambia el mercado en que trabaja el administrador general. Se guarda en una
// cookie para que se mantenga al pasar de una pantalla a otra y al volver al
// dia siguiente. "todos" la borra y muestra los dos paises juntos.
export async function elegirMercado(codigo: "CL" | "PE" | "todos") {
  const v = await requerirVendedor();
  if (!(tienePerfilAdmin(v) && v.mercado === "Ambos")) {
    return { error: "Su usuario trabaja un solo mercado." };
  }

  const jar = await cookies();
  if (codigo === "todos") {
    jar.delete(COOKIE_MERCADO);
  } else {
    jar.set(COOKIE_MERCADO, codigo, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Cambia lo que muestran todas las pantallas, no solo la actual.
  revalidatePath("/", "layout");
  return { ok: true };
}
