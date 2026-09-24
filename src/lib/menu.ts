import type { Vendedor } from "@/types/database";
import { administraUsuarios, tienePerfilAdmin } from "@/lib/sesion";

// El menu del sistema, en un solo lugar: lo usan la barra lateral --siempre a
// la vista-- y la portada. Van por concepto, siguiendo el recorrido real de una
// venta: se cotiza, se produce, se cobra, y aparte estan las maestras y la
// configuracion.
export interface Opcion {
  texto: string;
  href: string;
  soloAdmin?: boolean;
  // Solo el Administrador: el Supervisor no administra usuarios ni claves.
  soloUsuarios?: boolean;
}

export interface Grupo {
  titulo: string;
  nota: string;
  opciones: Opcion[];
}

export const GRUPOS: Grupo[] = [
  {
    titulo: "Vender",
    nota: "Del presupuesto al cierre con el cliente",
    opciones: [
      { texto: "Detalle de cotizacion", href: "/cotizaciones/nueva" },
      { texto: "Cotizaciones", href: "/cotizaciones" },
      { texto: "Clientes", href: "/clientes" },
    ],
  },
  {
    titulo: "Producir",
    nota: "Lo comprometido y lo que hay que comprar",
    opciones: [
      { texto: "Pedidos", href: "/pedidos" },
      { texto: "Proveedores", href: "/proveedores", soloAdmin: true },
    ],
  },
  {
    titulo: "Cobrar",
    nota: "Estado de la cuenta de cada pedido",
    opciones: [
      { texto: "Estado de pago", href: "/cobranza" },
      { texto: "Facturas emitidas", href: "/facturas" },
    ],
  },
  {
    titulo: "Catalogo",
    nota: "Que vendemos y con que esta hecho",
    opciones: [
      { texto: "Configurar panel SIP", href: "/configurador" },
      { texto: "Catalogo de productos", href: "/productos" },
      { texto: "Familias y subfamilias", href: "/familias", soloAdmin: true },
      { texto: "Materias primas", href: "/materias-primas", soloAdmin: true },
    ],
  },
  {
    titulo: "Configuracion",
    nota: "Reglas del sistema y quien entra",
    opciones: [
      { texto: "Formas de pago", href: "/formas-pago" },
      { texto: "Vendedores y accesos", href: "/vendedores", soloUsuarios: true },
      { texto: "Parametros", href: "/parametros", soloAdmin: true },
    ],
  },
];

// Lo que ve cada perfil. Igual que MenuAbrirAdmin en Access: lo que no se
// puede abrir no se muestra.
export function menuDe(v: Pick<Vendedor, "rol">): Grupo[] {
  const esAdmin = tienePerfilAdmin(v);
  const veUsuarios = administraUsuarios(v);
  return GRUPOS.map((g) => ({
    ...g,
    opciones: g.opciones.filter(
      (o) => (!o.soloAdmin || esAdmin) && (!o.soloUsuarios || veUsuarios)
    ),
  })).filter((g) => g.opciones.length > 0);
}
