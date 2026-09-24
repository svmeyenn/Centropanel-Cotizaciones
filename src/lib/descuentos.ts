// La cotizacion tiene tres descuentos y cada uno va sobre su propia base:
// productos, flete e instalaciones. A que grupo pertenece una linea lo decide
// su producto: su excepcion si la tiene, si no el grupo de su familia. Una
// linea escrita a mano, sin producto del catalogo, cuenta como producto.
export const GRUPO_PRODUCTOS = "Productos";
export const GRUPO_FLETE = "Flete";
export const GRUPO_INSTALACIONES = "Instalaciones";

export const GRUPOS_DESCUENTO = [
  GRUPO_PRODUCTOS,
  GRUPO_FLETE,
  GRUPO_INSTALACIONES,
] as const;

export type GrupoDescuento = (typeof GRUPOS_DESCUENTO)[number];

// Se numeran porque asi se nombran en la cotizacion; entre parentesis va
// sobre que se aplica cada uno.
export const ROTULO_DESCUENTO: Record<GrupoDescuento, string> = {
  [GRUPO_PRODUCTOS]: "DESCUENTO 1 (PRODUCTOS)",
  [GRUPO_FLETE]: "DESCUENTO 2 (FLETE)",
  [GRUPO_INSTALACIONES]: "DESCUENTO 3 (INSTALACIONES)",
};

export const ROTULO_DESCUENTO_1 = ROTULO_DESCUENTO[GRUPO_PRODUCTOS];
export const ROTULO_DESCUENTO_2 = ROTULO_DESCUENTO[GRUPO_FLETE];
export const ROTULO_DESCUENTO_3 = ROTULO_DESCUENTO[GRUPO_INSTALACIONES];

export function grupoDe(
  grupoPorProducto: Record<number, string> | undefined,
  idProducto: number | null | undefined
): GrupoDescuento {
  if (idProducto == null) return GRUPO_PRODUCTOS;
  const g = grupoPorProducto?.[idProducto];
  return (GRUPOS_DESCUENTO as readonly string[]).includes(g ?? "")
    ? (g as GrupoDescuento)
    : GRUPO_PRODUCTOS;
}
