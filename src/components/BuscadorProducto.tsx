"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductoVenta } from "@/components/EditorCotizacion";

// Un solo campo para elegir el producto. Antes eran dos --uno para filtrar y
// un desplegable para elegir-- y obligaba a escribir en uno y buscar en el
// otro. Aqui se escribe y la lista se va acotando con lo que coincida en
// cualquier parte de la descripcion; se elige con el mouse o con las flechas.
export default function BuscadorProducto({
  productos,
  valor,
  onElegir,
  deshabilitado,
  className,
}: {
  productos: ProductoVenta[];
  valor: number | null;
  onElegir: (p: ProductoVenta | null) => void;
  deshabilitado?: boolean;
  className?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const elegido = useMemo(
    () => productos.find((x) => x.id === valor) ?? null,
    [productos, valor]
  );

  // Con el campo cerrado se muestra lo elegido; al escribir manda lo tecleado.
  const mostrado = abierto ? texto : (elegido?.descripcion ?? "");

  // Se parte la busqueda en palabras: "panel 100" encuentra "Panel SIP 100,2"
  // sin obligar a escribirlo en el mismo orden ni seguido.
  const filtrados = useMemo(() => {
    const partes = texto.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!abierto || partes.length === 0) return productos;
    return productos.filter((x) => {
      const d = x.descripcion.toLowerCase();
      return partes.every((t) => d.includes(t));
    });
  }, [texto, productos, abierto]);

  // La lista va agrupada por familia y subfamilia: con decenas de tornillos y
  // maderas, una lista plana obliga a leerla entera.
  const grupos = useMemo(() => {
    const g = new Map<string, ProductoVenta[]>();
    for (const x of filtrados) {
      const f =
        (x.familia ?? "Otros") + (x.subfamilia ? ` · ${x.subfamilia}` : "");
      const l = g.get(f);
      if (l) l.push(x);
      else g.set(f, [x]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtrados]);

  // Orden plano de lo visible, que es sobre lo que se mueven las flechas.
  const planos = useMemo(() => grupos.flatMap(([, l]) => l), [grupos]);

  useEffect(() => setMarcado(0), [texto, abierto]);

  // Cerrar al pinchar fuera: si no, la lista queda flotando sobre el resto.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) {
        setAbierto(false);
        setTexto("");
      }
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // Mantener a la vista la opcion marcada cuando se navega con el teclado.
  useEffect(() => {
    if (!abierto || !lista.current) return;
    const el = lista.current.querySelector<HTMLElement>('[data-marcado="si"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [marcado, abierto]);

  function elegir(x: ProductoVenta) {
    onElegir(x);
    setTexto("");
    setAbierto(false);
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      setMarcado((m) => {
        const n = planos.length;
        if (n === 0) return 0;
        return e.key === "ArrowDown" ? (m + 1) % n : (m - 1 + n) % n;
      });
      return;
    }
    if (e.key === "Enter" && abierto && planos[marcado]) {
      e.preventDefault();
      elegir(planos[marcado]);
      return;
    }
    if (e.key === "Escape" && abierto) {
      e.preventDefault();
      setAbierto(false);
      setTexto("");
    }
  }

  const base =
    className ??
    "border border-gray-300 rounded px-2 py-1 text-sm w-full disabled:bg-gray-100 disabled:text-gray-500";

  return (
    <div className="relative" ref={caja}>
      <input
        className={base}
        placeholder="Escriba para buscar: panel, flete, mano de obra..."
        value={mostrado}
        disabled={deshabilitado}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          // Lo escrito reemplaza a lo elegido: si se borra, no queda un
          // producto seleccionado a espaldas de lo que se ve.
          if (elegido) onElegir(null);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
      />

      {elegido && !abierto && (
        <button
          type="button"
          onClick={() => {
            onElegir(null);
            setTexto("");
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-verde text-white text-[11px] font-semibold px-2 py-0.5 rounded"
          title="Quitar el producto elegido"
        >
          quitar
        </button>
      )}

      {abierto && (
        <div
          ref={lista}
          className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-dorado rounded shadow-lg"
        >
          {planos.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">
              Ningun producto coincide con &quot;{texto.trim()}&quot;.
            </div>
          ) : (
            grupos.map(([familia, items]) => (
              <div key={familia}>
                <div className="bg-crema border-t border-dorado px-3 py-1 text-[11px] font-semibold text-verde uppercase tracking-wide sticky top-0">
                  {familia}
                </div>
                {items.map((x) => {
                  const i = planos.indexOf(x);
                  const activo = i === marcado;
                  const sinPrecio = !x.precio_venta && !x.precio_manual;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      data-marcado={activo ? "si" : "no"}
                      onMouseEnter={() => setMarcado(i)}
                      onClick={() => elegir(x)}
                      className={`w-full text-left px-3 py-1.5 text-xs ${
                        activo ? "bg-verde text-white" : "hover:bg-crema"
                      }`}
                    >
                      {x.descripcion}
                      {sinPrecio && (
                        <span
                          className={activo ? "text-white/80" : "text-gray-500"}
                        >
                          {"  (sin precio)"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
