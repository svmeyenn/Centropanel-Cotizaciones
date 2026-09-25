import type { Metadata } from "next";
import { headers } from "next/headers";
import Estructura from "@/components/Estructura";
import "./globals.css";

export const metadata: Metadata = {
  title: "Centro Panel - Sistema de Gestion",
  description: "Costeo y cotizacion de paneles estructurales SIP",
};

// Pantallas sin menu: las que se abren sin sesion --ingreso, recuperacion de
// clave y la cotizacion publica del cliente-- y el cambio de clave obligatorio,
// donde no hay que poder irse a otra parte sin elegir la nueva.
const SIN_MENU = ["/login", "/recuperar", "/auth", "/c/", "/cambiar-clave"];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // La ruta la pone el proxy en una cabecera: un layout no la recibe.
  const ruta = (await headers()).get("x-ruta") ?? "";
  const conMenu =
    ruta !== "" && !SIN_MENU.some((p) => ruta === p || ruta.startsWith(p));

  return (
    <html lang="es">
      <body className="font-sans antialiased">
        {conMenu ? <Estructura>{children}</Estructura> : children}
      </body>
    </html>
  );
}
