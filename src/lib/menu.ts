import type { Vendedor } from "@/types/database";
import { administraUsuarios, tienePerfilAdmin } from "@/lib/sesion";

// El menu del sistema, en un solo lugar: lo usan la barra lateral --siempre a
// la vista-- y la portada.
//
// El orden sigue el recorrido del negocio y lo que se usa a diario: se vende,
// se arma lo que se vende, se mueve la plata del dia, se cobra y se factura, y
// al final se mira la caja. La configuracion queda ultima porque se toca una
// vez y no todos los dias.
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
    nota: "Del presupuesto al pedido en produccion",
    opciones: [
      { texto: "Nueva cotizacion", href: "/cotizaciones/nueva" },
      { texto: "Cotizaciones", href: "/cotizaciones" },
      { texto: "Pedidos", href: "/pedidos" },
      // La misma pantalla que "Clientes y proveedores" de Configuracion: la
      // ficha es una sola. Quien vende entra por aqui y la ve filtrada en los
      // clientes; quien maneja la plata entra por alla y ve todas.
      { texto: "Clientes", href: "/clientes" },
      // Los contactos del CRM, con sus cotizaciones, conversaciones y compromisos.
      // Los datos de Clientify se cargan por archivo; lo que se corrige aqui no se
      // pierde en la carga siguiente.
      { texto: "Leads", href: "/clientify" },
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
    titulo: "Movimientos",
    nota: "La plata que sale, la que entra y con quien",
    opciones: [
      { texto: "Egresos", href: "/egresos", ve: (v) => v.fin_ver_egresos },
      { texto: "Ingresos", href: "/ingresos", ve: (v) => v.fin_ver_ingresos },
      {
        texto: "Rendiciones de gastos",
        href: "/rendiciones",
        ve: (v) => v.fin_rendir_gastos || v.fin_pagar_gastos,
      },
      { texto: "Proveedores", href: "/proveedores", soloAdmin: true },
      { texto: "Topes de gasto", href: "/topes", ve: (v) => v.fin_mantenedores },
    ],
  },
  {
    titulo: "Cobrar y facturar",
    nota: "Estado de la cuenta de cada pedido",
    opciones: [
      { texto: "Estado de pago", href: "/cobranza" },
      { texto: "Facturas y notas de credito", href: "/facturas" },
      { texto: "Formas de pago", href: "/formas-pago" },
    ],
  },
  {
    titulo: "Caja",
    nota: "Saldos, banco y resultado por obra",
    opciones: [
      { texto: "Cartola consolidada", href: "/cartola", ve: (v) => v.fin_ver_cartola },
      {
        texto: "Conciliacion bancaria",
        href: "/conciliacion",
        ve: (v) => v.fin_ver_cartola,
      },
      {
        texto: "Resumen por proyecto",
        href: "/resumen-proyecto",
        ve: (v) => v.fin_ver_informes,
      },
    ],
  },
  {
    titulo: "Configuracion",
    nota: "Reglas del sistema y quien entra",
    opciones: [
      // Las cuatro listas, cada una con su direccion: se entra derecho a la
      // que se va a tocar en vez de elegir una pestana al llegar.
      {
        texto: "Cuentas bancarias",
        href: "/mantenedores/cuentas",
        ve: (v) => v.fin_mantenedores,
      },
      {
        texto: "Proyectos y clientes",
        href: "/mantenedores/proyectos",
        ve: (v) => v.fin_mantenedores,
      },
      {
        texto: "Clientes y proveedores",
        href: "/clientes",
        ve: (v) => v.fin_mantenedores,
      },
      {
        texto: "Categorias",
        href: "/mantenedores/categorias",
        ve: (v) => v.fin_mantenedores,
      },
      { texto: "Parametros", href: "/parametros", soloAdmin: true },
      { texto: "Vendedores y accesos", href: "/vendedores", soloUsuarios: true },
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
