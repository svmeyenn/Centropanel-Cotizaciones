import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Centro Panel - Cotizador",
  description: "Costeo y cotizacion de paneles estructurales SIP",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
