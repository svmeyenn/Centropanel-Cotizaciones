import type { Vendedor } from "@/types/database";
import { administraUsuarios, tienePerfilAdmin } from "@/lib/sesion";
import { alcanzaArea, puedeEn, type Area, type Nivel } from "@/lib/permisos";

// El menu del sistema, en un solo lugar: lo usan la barra lateral --siempre a
// la vista-- y la portada.
//
// El orden sigue el recorrido del negocio: se vende, se ejecuta, se compra, y
// despues la plata y los numeros. La administracion queda ultima porque se
// toca una vez y no todos los dias.
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
  // Nivel que pide la opcion en el area de su modulo; sin esto, basta con ver.
  nivel?: Nivel;
}

export interface Grupo {
  titulo: string;
  nota: string;
  // Area de la empresa a la que pertenece el modulo: el nivel que la persona
  // tiene ahi decide si el modulo se le abre.
  area?: Area;
  // Sin panel desplegable: el titulo abre la primera pantalla y las demas quedan
  // como pestanas laterales a la izquierda del contenido.
  pestanas?: boolean;
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
  pestanas?: boolean;
  opciones: OpcionVisible[];
}

// Los grupos son modulos funcionales, como en un ERP: cada uno es un area de
// la empresa con su dueno y su perfil. Las pantallas no cambian, solo de lugar.
export const GRUPOS: Grupo[] = [
  {
    titulo: "Comercial",
    area: "comercial",
    nota: "Del lead al pedido",
    opciones: [
      // Los contactos del CRM, con sus cotizaciones, conversaciones y compromisos.
      // Los datos de Clientify se cargan por archivo; lo que se corrige aqui no se
      // pierde en la carga siguiente.
      { texto: "Leads", href: "/leads" },
      { texto: "Nueva cotizacion", href: "/cotizaciones/nueva", nivel: "operar" },
      { texto: "Cotizaciones", href: "/cotizaciones" },
      { texto: "Pedidos", href: "/pedidos" },
      // La misma pantalla que "Clientes y proveedores" de Administracion: la
      // ficha es una sola. Quien vende entra por aqui y la ve filtrada en los
      // clientes; quien maneja la plata entra por alla y ve todas.
      { texto: "Clientes", href: "/clientes" },
    ],
  },
  {
    titulo: "Operaciones y proyectos",
    area: "operaciones",
    nota: "Obras, presupuesto y cronograma",
    opciones: [{ texto: "Proyectos", href: "/proyectos" }],
  },
  {
    titulo: "Compras",
    area: "compras",
    nota: "Del requerimiento a la orden de compra",
    opciones: [
      // El paso previo a la orden de compra: lo que se necesita, cotizado y adjudicado por solicitud.
      { texto: "Necesidades de material", href: "/necesidades" },
      { texto: "Ordenes de compra", href: "/compras" },
      {
        texto: "Por aprobar",
        href: "/aprobaciones",
        ve: (v) => v.rol === "Administrador" || puedeEn(v, "compras", "aprobar"),
      },
      { texto: "Proveedores", href: "/proveedores", soloAdmin: true },
    ],
  },
  {
    titulo: "Catalogo",
    area: "catalogo",
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
    titulo: "Tesoreria",
    area: "tesoreria",
    nota: "La plata que entra y sale, y el banco",
    opciones: [
      { texto: "Egresos", href: "/egresos", ve: (v) => v.fin_ver_egresos },
      { texto: "Ingresos", href: "/ingresos", ve: (v) => v.fin_ver_ingresos },
      {
        texto: "Rendiciones de gastos",
        href: "/rendiciones",
        ve: (v) => v.fin_rendir_gastos || v.fin_pagar_gastos,
      },
      { texto: "Estado de pago", href: "/cobranza" },
      { texto: "Cartola consolidada", href: "/cartola", ve: (v) => v.fin_ver_cartola },
      {
        texto: "Conciliacion bancaria",
        href: "/conciliacion",
        ve: (v) => v.fin_ver_cartola,
      },
      { texto: "Topes de gasto", href: "/topes", ve: (v) => v.fin_mantenedores },
    ],
  },
  {
    titulo: "Contabilidad y control",
    area: "contabilidad",
    nota: "Documentos tributarios y resultado",
    opciones: [
      { texto: "Facturas y notas de credito", href: "/facturas" },
      {
        texto: "Resumen por proyecto",
        href: "/resumen-proyecto",
        ve: (v) => v.fin_ver_informes,
      },
    ],
  },
  {
    titulo: "Administracion",
    nota: "Reglas del sistema y quien entra",
    pestanas: true,
    opciones: [
      // Cada lista con su direccion: se entra derecho a la que se va a tocar
      // en vez de elegir una pestana al llegar.
      {
        texto: "Unidades y centros de costo",
        href: "/estructura",
        ve: (v) => v.fin_mantenedores,
      },
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
      { texto: "Formas de pago", href: "/formas-pago" },
      { texto: "Parametros", href: "/parametros", soloAdmin: true },
      // Los mismos en Chile y en Peru: los cambia solo quien administra ambos.
      {
        texto: "Estados de leads y cotizaciones",
        href: "/estados",
        ve: (v) => tienePerfilAdmin(v) && v.mercado === "Ambos",
      },
      // Los motivos que se eligen al cambiar un estado; tambien iguales en los dos mercados.
      {
        texto: "Motivos de estado",
        href: "/motivos",
        ve: (v) => tienePerfilAdmin(v) && v.mercado === "Ambos",
      },
      // Los correos y WhatsApp que se ofrecen al escribirle a un lead.
      { texto: "Mensajes a leads", href: "/mensajes", soloAdmin: true },
      // Las personas a las que se les asigna un lead, cada una con su unico correo.
      { texto: "Propietarios de leads", href: "/propietarios", soloAdmin: true },
      { texto: "Vendedores y accesos", href: "/vendedores", soloUsuarios: true },
      // Las diez plantillas de acceso, sus topes de aprobacion y las excepciones
      // de los socios. Solo quien administra usuarios.
      { texto: "Perfiles y permisos", href: "/perfiles", soloUsuarios: true },
    ],
  },
];

// Quien puede abrir una opcion. En un solo lugar, porque la usan dos: el menu
// --para no mostrar lo que no se puede abrir-- y cada pantalla, que vuelve a
// preguntarlo en el servidor. Asi nadie entra escribiendo la direccion a mano.
function alcanza(v: Vendedor, o: Opcion, area?: Area): boolean {
  if (area && !alcanzaArea(v, area, o.nivel ?? "ver")) return false;
  if (o.soloAdmin && !tienePerfilAdmin(v)) return false;
  if (o.soloUsuarios && !administraUsuarios(v)) return false;
  return !o.ve || o.ve(v);
}

// Permiso de una ruta concreta. Una ruta que no esta en el menu --el detalle de
// una cotizacion, por ejemplo-- no la decide esta regla y se deja pasar.
export function puedeVerRuta(v: Vendedor, href: string): boolean {
  for (const g of GRUPOS) {
    const o = g.opciones.find((x) => x.href === href);
    if (o) return alcanza(v, o, g.area);
  }
  return true;
}

// Lo que ve cada perfil. Igual que MenuAbrirAdmin en Access: lo que no se
// puede abrir no se muestra, y un grupo sin opciones no aparece.
export function menuDe(v: Vendedor): GrupoVisible[] {
  return GRUPOS.map((g) => ({
    titulo: g.titulo,
    nota: g.nota,
    pestanas: g.pestanas,
    // Solo el texto y la direccion: lo que decide el permiso se queda en el
    // servidor.
    opciones: g.opciones
      .filter((o) => alcanza(v, o, g.area))
      .map(({ texto, href }) => ({ texto, href })),
  })).filter((g) => g.opciones.length > 0);
}
