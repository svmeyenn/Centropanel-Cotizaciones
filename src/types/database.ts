// Tipos minimos del esquema (a mano por ahora). Se pueden regenerar con
// `supabase gen types typescript` cuando el CLI este conectado al proyecto.
export type Rol = "Administrador" | "Vendedor" | "Consulta";
export type EstadoCotizacion =
  | "Borrador"
  | "Emitida"
  | "Enviada"
  | "Aceptada"
  | "Rechazada";
export type TipoDescuento = "Monto" | "Porcentaje";

export interface Vendedor {
  id: number;
  user_id: string | null;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  rol: Rol;
  // Chile, Peru o Ambos. 'Ambos' con rol Administrador es el
  // administrador general: el unico que cruza mercados.
  mercado: "Chile" | "Peru" | "Ambos";
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_admin: boolean;
  debe_cambiar_password: boolean;
  activo: boolean;
}

export interface Pais {
  id: number;
  codigo: string;
  nombre: string;
  moneda_base: string;
  prefijo_telefono: string;
  // Como se llama el identificador tributario alli: RUT en Chile, RUC en Peru.
  etiqueta_id: string;
  activo: boolean;
}

export interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
  decimales: number;
  activo: boolean;
}

export interface TipoMateria {
  id: number;
  nombre: string;
  // El nucleo del panel (EPS) y las caras (Placa). El configurador los
  // necesita distinguidos; un tipo nuevo entra sin ninguna de las dos.
  es_nucleo: boolean;
  es_cara: boolean;
  orden: number;
  activo: boolean;
}

export interface Cliente {
  id: number;
  razon_social: string;
  rut: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna?: string | null;
  ciudad?: string | null;
  id_pais?: number | null;
  activo: boolean;
}

export interface MateriaPrima {
  id: number;
  // Codigo corto y estable para nombrarla en un documento o en el taller.
  sku?: string;
  id_pais?: number | null;
  nombre: string;
  tipo: "EPS" | "Placa" | "Adhesivo";
  familia: string | null;
  etiqueta: string | null;
  ancho_mm: number | null;
  largo_mm: number | null;
  espesor_mm: number | null;
  espesor_nominal: number | null;
  costo: number;
  unidad: string | null;
  activo: boolean;
}

export interface Producto {
  id: number;
  descripcion: string;
  tipo: "Panel SIP" | "Servicio";
  id_eps: number | null;
  id_placa_a: number | null;
  id_placa_b: number | null;
  espesor_total: number | string | null;
  costo_unitario: number;
  precio_venta: number;
  margen_aplicado: number | null;
  precio_manual: boolean;
  activo: boolean;
  fecha_creacion: string;
}

export interface FormaPago {
  id: number;
  descripcion: string;
  orden: number | null;
  // Pie que exige esta forma de pago, en % del total con IVA. Es lo que el
  // pedido tiene que tener abonado antes de comprar insumos.
  pie_pct?: number | null;
  // La que viene propuesta al abrir una cotizacion nueva. Solo una la lleva.
  por_defecto?: boolean;
  activo: boolean;
}

export interface Parametro {
  clave: string;
  valor_num: number | null;
  valor_texto: string | null;
  descripcion: string | null;
}

export interface Cotizacion {
  id: number;
  num_cotizacion: string | null;
  fecha: string;
  id_cliente: number | null;
  id_vendedor: number | null;
  id_forma_pago: number | null;
  descuento_tipo: TipoDescuento;
  descuento_pct: number;
  descuento_monto: number;
  direccion_despacho: string;
  estado: EstadoCotizacion;
  validez_dias: number;
  tiempo_entrega: string | null;
  notas: string | null;
  fecha_creacion: string;
}

export interface CotizacionDetalle {
  id: number;
  id_cotizacion: number;
  orden: number;
  id_producto: number | null;
  descripcion: string;
  unidades: number;
  valor_unitario: number;
  costo_unitario: number;
}

export interface CotizacionTotales {
  id: number;
  num_cotizacion: string | null;
  subtotal: number;
  descuento_monto: number;
  total_neto: number;
  iva: number;
  total: number;
  margen: number;
}

// Placeholder de tipado generico para que @supabase/ssr no exija el esquema
// completo generado por el CLI mientras no lo conectemos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
