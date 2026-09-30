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
// Los grupos van plegados y se abren al pasar el cursor por el titulo. Con
// seis grupos y veinte opciones, todo desplegado la barra pedia scroll y habia
// que recorrerla entera para encontrar una pantalla.
//
// El hover no puede ser la unica forma de abrirlos: en un telefono no existe,
// y con el teclado tampoco. Por eso el titulo es un boton --clic para fijar el
// grupo abierto-- y el foco del teclado tambien lo abre. El grupo de la
// pantalla en que se esta queda abierto siempre, para no perder de vista donde
// se esta parado.
//
// En el telefono la barra no cabe al lado: se pliega y se abre con el boton.
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
  // Grupo que el cursor o el teclado esta recorriendo, y los que quedaron
  // fijos por un clic.
  const [sobre, setSobre] = useState<string | null>(null);
  const [fijados, setFijados] = useState<Set<string>>(new Set());
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cierre.current) clearTimeout(cierre.current);
    };
  }, []);

  // La opcion vigente es la de ruta mas larga que calza: estando en
  // /cotizaciones/12 se marca Cotizaciones, no la portada.
  const activa = (href: string) =>
    ruta === href || (href !== "/" && ruta.startsWith(href + "/"));

  const tieneLaRuta = (g: GrupoVisible) => g.opciones.some((o) => activa(o.href));

  const estaAbierto = (g: GrupoVisible) =>
    tieneLaRuta(g) || fijados.has(g.titulo) || sobre === g.titulo;

  // Al salir el cursor no se cierra en el acto: bajando en diagonal hacia las
  // opciones se sale un instante del grupo, y cerrar ahi deja el menu
  // parpadeando y la opcion fuera de alcance.
  function entrar(titulo: string) {
    if (cierre.current) clearTimeout(cierre.current);
    setSobre(titulo);
  }

  function salir() {
    if (cierre.current) clearTimeout(cierre.current);
    cierre.current = setTimeout(() => setSobre(null), 220);
  }

  function alternar(titulo: string) {
    setFijados((previos) => {
      const nuevos = new Set(previos);
      if (nuevos.has(titulo)) nuevos.delete(titulo);
      else nuevos.add(titulo);
      return nuevos;
    });
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
        } lg:block print:hidden fixed lg:sticky top-0 left-0 z-30 w-60 h-screen shrink-0 overflow-y-auto bg-verde text-white`}
      >
        <Link
          href="/"
          onClick={() => setAbierto(false)}
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
            const desplegado = estaAbierto(g);
            const conLaRuta = tieneLaRuta(g);
            const id = `grupo-${g.titulo.replace(/\s+/g, "-").toLowerCase()}`;

            return (
              <div
                key={g.titulo}
                className="px-2 py-0.5"
                onMouseEnter={() => entrar(g.titulo)}
                onMouseLeave={salir}
                // El foco del teclado abre el grupo igual que el cursor, y no
                // se cierra mientras siga dentro.
                onFocusCapture={() => entrar(g.titulo)}
                onBlurCapture={salir}
              >
                <button
                  type="button"
                  onClick={() => alternar(g.titulo)}
                  aria-expanded={desplegado}
                  aria-controls={id}
                  title={g.nota}
                  className={`w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] uppercase tracking-wide text-left ${
                    conLaRuta
                      ? "text-dorado font-bold"
                      : "text-dorado/85 hover:bg-white/10"
                  }`}
                >
                  {/* La flecha gira en vez de cambiar de simbolo: el mismo
                      elemento moviendose se sigue mejor que dos distintos. */}
                  <span
                    aria-hidden="true"
                    className={`inline-block text-[9px] transition-transform motion-reduce:transition-none ${
                      desplegado ? "rotate-90" : ""
                    }`}
                  >
                    &#9654;
                  </span>
                  <span className="flex-1">{g.titulo}</span>
                  {/* Cuantas pantallas hay dentro, para saber si vale la pena
                      abrirlo. Solo cuando esta plegado. */}
                  {!desplegado && (
                    <span className="text-white/40 text-[10px] font-normal tabular-nums">
                      {g.opciones.length}
                    </span>
                  )}
                </button>

                <div id={id} hidden={!desplegado}>
                  {g.opciones.map((o) => (
                    <Link
                      key={o.href}
                      href={o.href}
                      onClick={() => setAbierto(false)}
                      aria-current={activa(o.href) ? "page" : undefined}
                      className={`block rounded pl-5 pr-2 py-1.5 text-xs ${
                        activa(o.href)
                          ? "bg-white/15 font-semibold"
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
