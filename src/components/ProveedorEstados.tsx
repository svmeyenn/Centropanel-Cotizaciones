"use client";

import { createContext, useContext } from "react";
import { CATALOGO_POR_DEFECTO, etiquetaDe, type Catalogo, type TipoEstado } from "@/lib/catalogoEstados";

// Los estados vigentes, al alcance de los componentes de cliente. El servidor
// los lee una vez y los reparte aqui: asi un componente que muestra o elige un
// estado no necesita que cada pantalla se los pase uno por uno. Solo viajan
// datos: nada de funciones.
const Contexto = createContext<Catalogo>(CATALOGO_POR_DEFECTO);

export function ProveedorEstados({ catalogo, children }: { catalogo: Catalogo; children: React.ReactNode }) {
  return <Contexto.Provider value={catalogo}>{children}</Contexto.Provider>;
}

export const useCatalogoEstados = () => useContext(Contexto);

// El nombre de un estado, para dejarlo en el medio de un texto sin traer el
// catalogo a mano.
export function EtiquetaEstado({ tipo, codigo }: { tipo: TipoEstado; codigo: string | null | undefined }) {
  const catalogo = useCatalogoEstados();
  return <>{etiquetaDe(catalogo[tipo], codigo)}</>;
}
