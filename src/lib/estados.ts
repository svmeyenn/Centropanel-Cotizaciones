// Estados de cada documento, en un solo lugar: los usan el editor --donde se
// cambian-- y el filtro de los listados --donde se buscan--. Separados, una
// lista terminaba ofreciendo estados que la otra no conocia.

export const ESTADOS_COTIZACION = [
  "Borrador",
  "Emitida",
  "Enviada",
  "Aceptada",
  "Rechazada",
];

export const ESTADOS_PEDIDO = [
  "Emitido",
  "En preparacion",
  "Despachado",
  "Facturado",
  "Anulado",
];
