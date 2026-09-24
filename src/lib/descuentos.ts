// Cada descuento de la cotizacion tiene su propia base: el primero va sobre los
// productos y el segundo sobre el flete y la mano de obra. A que descuento
// pertenece cada linea lo decide la familia de su producto, configurada en el
// catalogo (tabla familias_descuento). Una linea escrita a mano, sin producto,
// va siempre al primero.
export const GRUPO_PRODUCTOS = "Productos";
export const GRUPO_FLETE = "Flete y mano de obra";
export type GrupoDescuento = typeof GRUPO_PRODUCTOS | typeof GRUPO_FLETE;

export function esFamiliaFlete(
  familiasFlete: string[],
  familia: string | null | undefined
): boolean {
  return familia != null && familiasFlete.includes(familia);
}

export const ROTULO_DESCUENTO_1 = "DESCUENTO PRODUCTOS";
export const ROTULO_DESCUENTO_2 = "DESCUENTO FLETE Y MANO DE OBRA";
