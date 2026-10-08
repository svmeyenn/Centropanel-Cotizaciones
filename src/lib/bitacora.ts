// Como se lee el historial de cambios en pantalla.
//
// La base guarda los nombres de sus columnas --id_cliente, descuento_pct-- y
// eso no se le muestra a nadie. Aqui se traducen a como se llaman las cosas en
// la pantalla, y los valores se escriben como se leen: un monto con puntos, una
// fecha en dia/mes/año, un si o un no en vez de true y false.

export interface Anotacion {
  id: number;
  accion: "creado" | "modificado" | "borrado";
  hecho_en: string;
  quien: string;
  cambios: Record<string, unknown>;
}

const ETIQUETAS: Record<string, string> = {
  // documentos
  num_cotizacion: "Folio",
  num_pedido: "Folio del pedido",
  id_cliente: "Cliente",
  id_vendedor: "Vendedor",
  estado: "Estado",
  fecha: "Fecha",
  fecha_emision: "Fecha de emision",
  fecha_vencimiento: "Vence el",
  fecha_entrega_esperada: "Entrega esperada",
  fecha_entrega_efectiva: "Entrega efectiva",
  validez_dias: "Validez (dias)",
  observaciones: "Observaciones",
  condiciones_pago: "Condiciones de pago",
  id_forma_pago: "Forma de pago",
  // plata
  total: "Total",
  subtotal: "Subtotal",
  neto: "Neto",
  iva: "IVA",
  monto: "Monto",
  precio: "Precio",
  precio_unitario: "Precio unitario",
  cantidad: "Cantidad",
  unidades: "Unidades",
  descuento_tipo: "Tipo de descuento",
  descuento_pct: "Descuento %",
  descuento_monto: "Descuento",
  descuento2_tipo: "Segundo descuento (tipo)",
  descuento2_pct: "Segundo descuento %",
  descuento2_monto: "Segundo descuento",
  descuento3_tipo: "Tercer descuento (tipo)",
  descuento3_pct: "Tercer descuento %",
  descuento3_monto: "Tercer descuento",
  recargo_pct: "Recargo %",
  // movimientos
  tipo: "Tipo",
  origen_destino: "Origen / destino",
  comentario: "Comentario",
  documento: "Documento",
  estado_pago: "Estado de pago",
  fecha_pago: "Fecha de pago",
  es_anticipo: "Es anticipo",
  servicio_prestado: "Servicio prestado",
  fecha_pago_acordada: "Fecha de pago acordada",
  id_cuenta: "Cuenta",
  id_proyecto: "Proyecto",
  id_categoria: "Categoria",
  id_interlocutor: "Ficha",
  sin_banco: "Sin respaldo en el banco",
  sin_banco_motivo: "Motivo de la falta de respaldo",
  // fichas
  razon_social: "Razon social",
  nombre_referencia: "Nombre corto",
  rut: "RUT",
  contacto: "Contacto",
  email: "Correo",
  telefono: "Telefono",
  direccion: "Direccion",
  comuna: "Comuna",
  ciudad: "Ciudad",
  con_transferencia: "Datos de transferencia",
  activo: "Vigente",
  activa: "Vigente",
  borrado: "Borrado",
  id_pais: "Mercado",
  banco: "Banco",
  tipo_cuenta: "Tipo de cuenta",
  numero_cuenta: "Numero de cuenta",
  // otros
  nombre: "Nombre",
  cliente: "Cliente",
  alias: "Alias",
  titular: "Titular",
  moneda: "Moneda",
  saldo_inicial: "Saldo inicial",
  numero: "Numero",
  motivo: "Motivo",
};

export const etiquetaCampo = (campo: string) =>
  ETIQUETAS[campo] ??
  campo.replace(/^id_/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const MONTOS = new Set([
  "total", "subtotal", "neto", "iva", "monto", "precio", "precio_unitario",
  "descuento_monto", "descuento2_monto", "descuento3_monto", "saldo_inicial",
]);

export function valorLegible(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vacio)";
  if (typeof v === "boolean") return v ? "si" : "no";
  if (typeof v === "number" && MONTOS.has(campo))
    return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(v);
  const s = String(v);
  // Una fecha o una fecha con hora guardadas como texto.
  const f = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (f) return `${f[3]}-${f[2]}-${f[1]}`;
  if (MONTOS.has(campo) && /^-?\d+(\.\d+)?$/.test(s))
    return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Number(s));
  return s;
}

export function cuandoLegible(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
