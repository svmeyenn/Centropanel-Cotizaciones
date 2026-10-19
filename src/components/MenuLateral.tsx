"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const barra = useRef<HTMLElement>(null);
  // Donde cae el panel abierto: se calcula para que quepa siempre entero en la
  // pantalla, por largo que sea.
  const [pos, setPos] = useState<{ top: number; left: number; alto: number } | null>(null);

  useEffect(() => {
    return () => {
      if (cierre.current) clearTimeout(cierre.current);
    };
  }, []);

  const idDe = (titulo: string) => `grupo-${titulo.replace(/\s+/g, "-").toLowerCase()}`;

  // El panel sale a la derecha del titulo, pero si por la altura de la pantalla
  // no cabe se sube lo necesario, y si aun asi es mas alto que la pantalla, se
  // le pone su propia barra de desplazamiento. Nunca queda una opcion fuera.
  useLayoutEffect(() => {
    if (!sobre) {
      setPos(null);
      return;
    }
    function medir() {
      const panel = document.getElementById(idDe(sobre as string));
      const grupo = panel?.parentElement;
      const nav = barra.current;
      if (!panel || !grupo || !nav || !window.matchMedia("(min-width: 1024px)").matches) {
        setPos(null);
        return;
      }
      const margen = 8;
      const disponible = window.innerHeight - 2 * margen;
      const natural = panel.scrollHeight + 2;
      const alto = Math.min(natural, disponible);
      const top = Math.min(
        Math.max(grupo.getBoundingClientRect().top, margen),
        window.innerHeight - margen - alto
      );
      setPos({ top, left: nav.getBoundingClientRect().right + 2, alto: disponible });
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sobre, grupos]);

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
        ref={barra}
        className={`${
          abierto ? "block" : "hidden"
        } lg:block print:hidden fixed lg:sticky top-0 left-0 z-30 w-56 h-screen shrink-0 bg-verde text-white overflow-y-auto`}
      >
        <div className="bg-white px-3 pt-2 pb-1.5">
          <Link href="/" title="Volver al menu principal" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Centro Panel" className="h-14 w-auto shrink-0" />
            {/* El nombre va entero en una linea, al lado del logo. Con "SISTEMA
                DE GESTION" --mas largo que el nombre anterior-- el cuerpo baja a
                10px para que siga cabiendo sin partirse. */}
            <span className="text-[10px] font-bold leading-tight text-verde whitespace-nowrap">
              SISTEMA DE GESTION
            </span>
          </Link>
          {/* Las dos caras del inicio, a un clic desde cualquier pantalla. */}
          <div className="mt-1.5 flex gap-1.5 text-[10px] font-semibold">
            <Link href="/?vista=gestion" className="flex-1 text-center rounded bg-verde text-white px-2 py-0.5 hover:opacity-90">
              Mi gestion
            </Link>
            <Link href="/" className="flex-1 text-center rounded bg-verde text-white px-2 py-0.5 hover:opacity-90">
              Desempeno
            </Link>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/15 text-[11px] text-white/80">
          <div className="font-semibold text-white">{nombre}</div>
          <div>{rol}</div>
        </div>

        <div className="py-2">
          {grupos.map((g) => {
            const desplegado = sobre === g.titulo;
            const conLaRuta = tieneLaRuta(g);
            const id = idDe(g.titulo);

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
                  style={
                    desplegado && pos
                      ? ({ "--pt": `${pos.top}px`, "--pl": `${pos.left}px`, "--pa": `${pos.alto}px` } as React.CSSProperties)
                      : undefined
                  }
                  className={`${
                    desplegado ? "lg:block" : "lg:hidden"
                  } block lg:fixed lg:top-[var(--pt)] lg:left-[var(--pl)] lg:max-h-[var(--pa)] lg:z-50 lg:w-60 lg:rounded lg:bg-verde lg:shadow-xl lg:border lg:border-white/15 lg:overflow-y-auto lg:overscroll-contain`}
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
