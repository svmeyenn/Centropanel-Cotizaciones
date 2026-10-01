"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GrupoVisible } from "@/lib/menu";
import LOGO from "@/lib/logo";

// Menu siempre a la vista, a la izquierda. Antes habia que volver a la portada
// para cambiar de pantalla; ahora se salta de cotizaciones a pedidos o al
// catalogo sin pasar por el inicio.
//
// La barra muestra solo los seis titulos, y al pasar el cursor por uno sale a
// su derecha un panel con sus pantallas. Asi la barra no cambia de alto ni
// empuja lo que esta debajo --que es lo que pasaba al plegar y desplegar-- y
// las opciones aparecen al lado del titulo, donde ya esta el cursor.
//
// El cursor no puede ser la unica forma de abrirlo: en un telefono no existe y
// con el teclado tampoco. Por eso el titulo es un boton y el foco del teclado
// abre el mismo panel; y en pantalla chica, donde la barra se abre con el
// boton de abajo, todo va desplegado sin paneles.
export default function MenuLateral({
  grupos,
  nombre,
  rol,
  version,
  sandbox,
}: {
  grupos: GrupoVisible[];
  nombre: string;
  rol: string;
  version: string;
  sandbox: boolean;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [sobre, setSobre] = useState<string | null>(null);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cierre.current) clearTimeout(cierre.current);
    };
  }, []);

  // Al cambiar de pantalla se cierra todo: el panel que quedo abierto sobre la
  // pantalla nueva es basura visual.
  useEffect(() => {
    setSobre(null);
    setAbierto(false);
  }, [ruta]);

  // La opcion vigente es la de ruta mas larga que calza: estando en
  // /cotizaciones/12 se marca Cotizaciones, no la portada.
  const activa = (href: string) =>
    ruta === href || (href !== "/" && ruta.startsWith(href + "/"));

  const tieneLaRuta = (g: GrupoVisible) => g.opciones.some((o) => activa(o.href));

  // Saliendo del titulo hacia el panel el cursor pasa un instante por el
  // borde: cerrar ahi dejaria el panel inalcanzable.
  function entrar(titulo: string) {
    if (cierre.current) clearTimeout(cierre.current);
    setSobre(titulo);
  }

  function salir() {
    if (cierre.current) clearTimeout(cierre.current);
    cierre.current = setTimeout(() => setSobre(null), 220);
  }

  return (
    <>
      <button
        onClick={() => setAbierto(!abierto)}
        // print:hidden porque la hoja tiene el ancho de un telefono: sin esto
        // el boton se colaba en la esquina del PDF de la cotizacion.
        className="lg:hidden print:hidden fixed bottom-4 left-4 z-40 bg-verde text-white text-xs font-semibold px-3 py-2 rounded shadow-lg"
        aria-expanded={abierto}
      >
        {abierto ? "Cerrar menu" : "Menu"}
      </button>

      <nav
        className={`${
          abierto ? "block" : "hidden"
        } lg:block print:hidden fixed lg:sticky top-0 left-0 z-30 w-56 h-screen shrink-0 bg-verde text-white overflow-y-auto lg:overflow-visible`}
      >
        <Link
          href="/"
          title="Volver al menu principal"
          className="flex items-center gap-2 bg-white px-3 py-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Centro Panel" className="h-14 w-auto shrink-0" />
          {/* El nombre va entero en una linea, al lado del logo. Con "SISTEMA
              DE GESTION" --mas largo que el nombre anterior-- el cuerpo baja a
              10px para que siga cabiendo sin partirse. */}
          <span className="text-[10px] font-bold leading-tight text-verde whitespace-nowrap">
            SISTEMA DE GESTION
          </span>
        </Link>

        <div className="px-4 py-3 border-b border-white/15 text-[11px] text-white/80">
          <div className="font-semibold text-white">{nombre}</div>
          <div>{rol}</div>
        </div>

        <div className="py-2">
          {grupos.map((g) => {
            const desplegado = sobre === g.titulo;
            const conLaRuta = tieneLaRuta(g);
            const id = `grupo-${g.titulo.replace(/\s+/g, "-").toLowerCase()}`;

            return (
              <div
                key={g.titulo}
                className="relative px-2 py-0.5"
                onMouseEnter={() => entrar(g.titulo)}
                onMouseLeave={salir}
                onFocusCapture={() => entrar(g.titulo)}
                onBlurCapture={salir}
              >
                <button
                  type="button"
                  onClick={() => (desplegado ? setSobre(null) : entrar(g.titulo))}
                  aria-expanded={desplegado}
                  aria-controls={id}
                  title={g.nota}
                  className={`w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] uppercase tracking-wide text-left ${
                    conLaRuta
                      ? "bg-white/10 text-dorado font-bold"
                      : "text-dorado/85 hover:bg-white/10"
                  }`}
                >
                  <span className="flex-1">{g.titulo}</span>
                  <span aria-hidden="true" className="text-[9px] text-white/50">
                    &#9654;
                  </span>
                </button>

                {/* El panel sale a la derecha de la barra, a la altura del
                    titulo. En pantalla chica no hay cursor que lo abra, asi
                    que ahi las opciones van debajo, siempre a la vista. */}
                <div
                  id={id}
                  className={`${
                    desplegado ? "lg:block" : "lg:hidden"
                  } block lg:absolute lg:left-full lg:top-0 lg:z-50 lg:ml-0.5 lg:w-60 lg:rounded lg:bg-verde lg:shadow-xl lg:border lg:border-white/15 lg:max-h-[70vh] lg:overflow-y-auto`}
                >
                  <div className="hidden lg:block px-3 pt-2 pb-1 text-[10px] text-white/60">
                    {g.nota}
                  </div>
                  {g.opciones.map((o) => (
                    <Link
                      key={o.href}
                      href={o.href}
                      aria-current={activa(o.href) ? "page" : undefined}
                      className={`block rounded px-3 py-1.5 text-xs lg:mx-1 lg:mb-0.5 ${
                        activa(o.href)
                          ? "bg-white/20 font-semibold"
                          : "text-white/85 hover:bg-white/10"
                      }`}
                    >
                      {o.texto}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
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
