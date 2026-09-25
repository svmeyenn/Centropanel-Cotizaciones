import type { Vendedor } from "@/types/database";
import { administraUsuarios, tienePerfilAdmin } from "@/lib/sesion";

// El menu del sistema, en un solo lugar: lo usan la barra lateral --siempre a
// la vista-- y la portada. Van por concepto, siguiendo el recorrido real de una
// venta: se cotiza, se produce, se cobra, se lleva la plata, y aparte estan las
// maestras y la configuracion.
export interface Opcion {
  texto: string;
  href: string;
  soloAdmin?: boolean;
  // Solo el Administrador: el Supervisor no administra usuarios ni claves.
  soloUsuarios?: boolean;
  // Permiso propio de la opcion. Las de finanzas no cuelgan del rol sino de
  // las casillas de la ficha: se puede ser Administrador del cotizador y no
  // tener nada que hacer en la plata.
  ve?: (v: Vendedor) => boolean;
}

export interface Grupo {
  titulo: string;
  nota: string;
  opciones: Opcion[];
}

// El menu ya resuelto para una persona. Va aparte de `Grupo` porque lo recibe
// la barra lateral, que es un componente de cliente: ahi solo pueden viajar
// datos, y `Opcion` trae la funcion que decide el permiso. Pasarla tal cual
// deja la aplicacion entera con error de servidor.
export interface OpcionVisible {
  texto: string;
  href: string;
}

export interface GrupoVisible {
  titulo: string;
  nota: string;
  opciones: OpcionVisible[];
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
    titulo: "Finanzas",
    nota: "La plata que entra, la que sale y lo que se rinde",
    opciones: [
      { texto: "Ingresos", href: "/ingresos", ve: (v) => v.fin_ver_ingresos },
      { texto: "Egresos", href: "/egresos", ve: (v) => v.fin_ver_egresos },
      {
        texto: "Rendiciones de gastos",
        href: "/rendiciones",
        ve: (v) => v.fin_rendir_gastos || v.fin_pagar_gastos,
      },
      { texto: "Cartola consolidada", href: "/cartola", ve: (v) => v.fin_ver_cartola },
      { texto: "Conciliacion bancaria", href: "/conciliacion", ve: (v) => v.fin_ver_cartola },
      {
        texto: "Resumen por proyecto",
        href: "/resumen-proyecto",
        ve: (v) => v.fin_ver_informes,
      },
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
      {
        texto: "Parametros de materias primas",
        href: "/parametros-materias",
        soloAdmin: true,
      },
    ],
  },
  {
    titulo: "Configuracion",
    nota: "Reglas del sistema y quien entra",
    opciones: [
      { texto: "Formas de pago", href: "/formas-pago" },
      { texto: "Vendedores y accesos", href: "/vendedores", soloUsuarios: true },
      { texto: "Parametros", href: "/parametros", soloAdmin: true },
      {
        texto: "Cuentas, proyectos y categorias",
        href: "/mantenedores",
        ve: (v) => v.fin_mantenedores,
      },
      { texto: "Topes de gasto", href: "/topes", ve: (v) => v.fin_mantenedores },
    ],
  },
];

// Quien puede abrir una opcion. En un solo lugar, porque la usan dos: el menu
// --para no mostrar lo que no se puede abrir-- y cada pantalla, que vuelve a
// preguntarlo en el servidor. Asi nadie entra escribiendo la direccion a mano.
function alcanza(v: Vendedor, o: Opcion): boolean {
  if (o.soloAdmin && !tienePerfilAdmin(v)) return false;
  if (o.soloUsuarios && !administraUsuarios(v)) return false;
  return !o.ve || o.ve(v);
}

// Permiso de una ruta concreta. Una ruta que no esta en el menu --el detalle de
// una cotizacion, por ejemplo-- no la decide esta regla y se deja pasar.
export function puedeVerRuta(v: Vendedor, href: string): boolean {
  const o = GRUPOS.flatMap((g) => g.opciones).find((x) => x.href === href);
  return o ? alcanza(v, o) : true;
}

// Lo que ve cada perfil. Igual que MenuAbrirAdmin en Access: lo que no se
// puede abrir no se muestra, y un grupo sin opciones no aparece.
export function menuDe(v: Vendedor): GrupoVisible[] {
  return GRUPOS.map((g) => ({
    titulo: g.titulo,
    nota: g.nota,
    // Solo el texto y la direccion: lo que decide el permiso se queda en el
    // servidor.
    opciones: g.opciones
      .filter((o) => alcanza(v, o))
      .map(({ texto, href }) => ({ texto, href })),
  })).filter((g) => g.opciones.length > 0);
}
