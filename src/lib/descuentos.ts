// Cada descuento de la cotizacion tiene su propia base: el primero va sobre los
// productos y el segundo sobre el flete y la mano de obra. Una linea cae en la
// segunda por su descripcion, igual que sandbox.es_flete_o_mano en la base.
export function esFleteOMano(descripcion: string | null | undefined): boolean {
  const t = (descripcion ?? "").trim().toLowerCase();
  return t.startsWith("flete") || t.startsWith("mano de obra");
}

export const ROTULO_DESCUENTO_1 = "DESCUENTO PRODUCTOS";
export const ROTULO_DESCUENTO_2 = "DESCUENTO FLETE Y MANO DE OBRA";
