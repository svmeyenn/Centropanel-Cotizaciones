"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Grupo } from "@/lib/menu";
import LOGO from "@/lib/logo";

// Menu siempre a la vista, a la izquierda. Antes habia que volver a la portada
// para cambiar de pantalla; ahora se salta de cotizaciones a pedidos o al
// catalogo sin pasar por el inicio.
//
// En el telefono la barra no cabe al lado: se pliega y se abre con el boton.
export default function MenuLateral({
  grupos,
  nombre,
  rol,
  version,
  sandbox,
}: {
  grupos: Grupo[];
  nombre: string;
  rol: string;
  version: string;
  sandbox: boolean;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  // La opcion vigente es la de ruta mas larga que calza: estando en
  // /cotizaciones/12 se marca Cotizaciones, no la portada.
  const activa = (href: string) =>
    ruta === href || (href !== "/" && ruta.startsWith(href + "/"));

  return (
    <>
      <button
        onClick={() => setAbierto(!abierto)}
        className="lg:hidden fixed bottom-4 left-4 z-40 bg-verde text-white text-xs font-semibold px-3 py-2 rounded shadow-lg"
        aria-expanded={abierto}
      >
        {abierto ? "Cerrar menu" : "Menu"}
      </button>

      <nav
        className={`${
          abierto ? "block" : "hidden"
        } lg:block fixed lg:sticky top-0 left-0 z-30 w-60 h-screen shrink-0 overflow-y-auto bg-verde text-white`}
      >
        <Link
          href="/"
          onClick={() => setAbierto(false)}
          title="Volver al menu principal"
          className="flex items-center gap-2 bg-white px-3 py-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Centro Panel" className="h-9 w-auto shrink-0" />
          <span className="text-[11px] font-bold leading-tight text-verde">
            COTIZADOR
            <br />
            SIP
          </span>
        </Link>

        <div className="px-4 py-3 border-b border-white/15 text-[11px] text-white/80">
          <div className="font-semibold text-white">{nombre}</div>
          <div>{rol}</div>
        </div>

        <div className="py-2">
          {grupos.map((g) => (
            <div key={g.titulo} className="px-2 py-1.5">
              <div className="px-2 pb-1 text-[10px] uppercase tracking-wide text-dorado">
                {g.titulo}
              </div>
              {g.opciones.map((o) => (
                <Link
                  key={o.href}
                  href={o.href}
                  onClick={() => setAbierto(false)}
                  className={`block rounded px-2 py-1.5 text-xs ${
                    activa(o.href)
                      ? "bg-white/15 font-semibold"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  {o.texto}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-white/15 space-y-2">
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="w-full bg-white/15 text-white text-xs font-semibold px-2.5 py-1.5 rounded"
            >
              Cerrar sesion
            </button>
          </form>
          <p className="text-[10px] text-white/60">
            Version {version}
            {sandbox ? " · pruebas" : ""}
          </p>
        </div>
      </nav>
    </>
  );
}
