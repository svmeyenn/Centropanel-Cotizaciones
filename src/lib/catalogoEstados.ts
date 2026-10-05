// Los estados de leads y de cotizaciones como datos que se editan en el
// mantenedor, no como texto repartido por el sistema. Este archivo no toca la
// base: lo usan por igual el servidor y los componentes de cliente.
//
// El CODIGO de un estado es fijo --lo guardan los leads, las cotizaciones y el
// CRM-- y lo editable es la etiqueta, el orden y si se ofrece o no. Lo que el
// sistema calcula con un estado depende de lo que significa, no de su nombre, y
// eso se dice con MARCAS (varios estados pueden compartirla) y ROLES (uno solo).

export type TipoEstado = "lead" | "cotizacion";

export interface Estado {
  codigo: string;
  etiqueta: string;
  orden: number;
  activo: boolean;
  es_sistema: boolean;
  rol: string | null;
  marcas: string[];
  // El sistema lo necesita para funcionar: no se desactiva ni se elimina. El
  // motivo esta escrito para quien lo lea.
  protegido: boolean;
  motivo: string | null;
}

export interface Catalogo {
  lead: Estado[];
  cotizacion: Estado[];
}

// Lo que significa cada marca, en las palabras con que se le explica a quien
// administra. La base solo acepta estas.
export const MARCAS: Record<TipoEstado, { marca: string; texto: string; ayuda: string }[]> = {
  lead: [
    { marca: "en_seguimiento", texto: "Vivo, hay que moverlo", ayuda: "Sale en \"Sin seguimiento\" cuando nadie tiene nada comprometido con el lead." },
    { marca: "contactado", texto: "Ya se hablo con la persona", ayuda: "Cuenta en \"Contactados\" del tablero de leads." },
    { marca: "oportunidad", texto: "Hay una oportunidad de venta", ayuda: "Cuenta como oportunidad en la conversion y en los origenes que convierten." },
    { marca: "perdido", texto: "Se perdio o no califico", ayuda: "Cuenta como perdido." },
    { marca: "en_camino", texto: "Esta dentro del embudo", ayuda: "Si no la tiene, el tablero lo muestra en \"Fuera del camino\"." },
  ],
  cotizacion: [
    { marca: "en_juego", texto: "Todavia se puede ganar", ayuda: "Cuenta en \"Cotizaciones en juego\" y puede quedar sin seguimiento." },
    { marca: "espera_respuesta", texto: "Ya salio al cliente y se espera respuesta", ayuda: "Cuenta en las cotizaciones pendientes de cierre del tablero de ventas." },
    { marca: "cerrada", texto: "Ya termino, se gano o se perdio", ayuda: "El envio por correo o WhatsApp no la devuelve a \"Enviada\"." },
  ],
};

// Lo que hace el sistema con los estados que tienen rol: por eso no se pueden
// borrar ni cambiar lo que significan, solo renombrar y reordenar.
export const ROLES: Record<string, string> = {
  nuevo: "Aqui entran los leads nuevos, los que llegan de Meta.",
  al_enviar_cotizacion: "A este estado pasa un lead cuando se le envia una cotizacion.",
  borrador: "Asi nacen las cotizaciones duplicadas y mientras sea borrador el descuento en % se recalcula.",
  emitida: "Asi nace una cotizacion nueva.",
  enviada: "Aqui pasa al mandarla por correo o WhatsApp, y el lead pasa a oportunidad.",
  aceptada: "Aqui queda al generar el pedido.",
  rechazada: "Una cotizacion que el cliente no acepto.",
};

const DEPURACION = "Lo usan las reglas de depuracion de leads (Leads > Depurar).";

const e = (
  codigo: string,
  etiqueta: string,
  orden: number,
  rol: string | null,
  marcas: string[],
  motivo: string | null = null
): Estado => ({ codigo, etiqueta, orden, activo: true, es_sistema: true, rol, marcas, protegido: motivo !== null, motivo });

// Lo que hay desde el origen. Se usa cuando la lista no se puede leer --antes de
// aplicar la migracion, o sin sesion-- para que ninguna pantalla se quede sin
// nombres.
export const CATALOGO_POR_DEFECTO: Catalogo = {
  lead: [
    e("cold-lead", "No contactado", 10, "nuevo", ["en_camino"], ROLES.nuevo),
    e("warm-lead", "Contactado", 20, null, ["en_seguimiento", "contactado", "en_camino"], DEPURACION),
    e("hot-lead", "Lead caliente", 30, null, ["en_seguimiento", "contactado", "en_camino"], DEPURACION),
    e("in-deal", "Oportunidad", 40, "al_enviar_cotizacion", ["en_seguimiento", "oportunidad", "en_camino"], ROLES.al_enviar_cotizacion),
    e("client", "Cliente", 50, null, ["oportunidad", "en_camino"]),
    e("lost-client", "Cliente perdido", 60, null, ["perdido"]),
    e("lost-lead", "Lead perdido", 70, null, ["perdido"], DEPURACION),
    e("not-qualified-lead", "Lead no calificado", 80, null, ["perdido"], DEPURACION),
    e("visitor", "Visitante", 90, null, []),
    e("other", "Otro", 100, null, []),
  ],
  cotizacion: [
    e("Borrador", "Borrador", 10, "borrador", ["en_juego"], ROLES.borrador),
    e("Emitida", "Emitida", 20, "emitida", ["en_juego", "espera_respuesta"], ROLES.emitida),
    e("Enviada", "Enviada", 30, "enviada", ["en_juego", "espera_respuesta"], ROLES.enviada),
    e("Aceptada", "Aceptada", 40, "aceptada", ["cerrada"], ROLES.aceptada),
    e("Rechazada", "Rechazada", 50, "rechazada", ["cerrada"]),
  ],
};

const porOrden = (a: Estado, b: Estado) => a.orden - b.orden || a.codigo.localeCompare(b.codigo);

// Todos, en su orden: para mostrar --un lead puede seguir en un estado que ya no
// se ofrece, y tiene que verse con su nombre--.
export const ordenados = (lista: Estado[]): Estado[] => [...lista].sort(porOrden);

// Los que se ofrecen al elegir un estado.
export const ofrecidos = (lista: Estado[]): Estado[] => ordenados(lista).filter((x) => x.activo);

// El nombre que se lee. Un codigo que la lista no conoce --el CRM puede mandar
// uno nuevo-- se muestra tal cual, como siempre.
export function etiquetaDe(lista: Estado[], codigo: string | null | undefined): string {
  if (!codigo) return "";
  return lista.find((x) => x.codigo === codigo)?.etiqueta ?? codigo;
}

// Los codigos que tienen una marca, en el orden de los estados.
export const conMarca = (lista: Estado[], marca: string): string[] =>
  ordenados(lista)
    .filter((x) => x.marcas.includes(marca))
    .map((x) => x.codigo);

export const tieneMarca = (lista: Estado[], codigo: string | null | undefined, marca: string): boolean =>
  !!codigo && !!lista.find((x) => x.codigo === codigo)?.marcas.includes(marca);

// El codigo del estado que cumple un rol. Si no se pudo leer la lista, el que
// siempre cumplio ese rol.
export const codigoDeRol = (lista: Estado[], rol: string): string | null =>
  lista.find((x) => x.rol === rol)?.codigo ?? null;

// El codigo que se guarda para un estado nuevo, a partir del nombre que se le
// pone. Un lead usa el estilo del CRM (en minusculas, con guiones); una
// cotizacion se guarda con las palabras tal cual, como "Borrador".
export function codigoParaNuevo(tipo: TipoEstado, etiqueta: string, existentes: string[]): string {
  const sinTildes = etiqueta.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const base =
    tipo === "lead"
      ? sinTildes
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 36)
      : sinTildes
          .replace(/[^A-Za-z0-9 ]+/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 36);
  if (!base) return "";
  const sep = tipo === "lead" ? "-" : " ";
  let codigo = base;
  for (let i = 2; existentes.some((x) => x.toLowerCase() === codigo.toLowerCase()); i++) codigo = `${base}${sep}${i}`;
  return codigo;
}

// Lo que la lista de leads necesita saber de los estados para filtrar: donde
// entra un lead nuevo y cuales cuentan como vivos.
export function estadosParaFiltros(cat: Catalogo): { nuevo: string; enSeguimiento: string[] } {
  return {
    nuevo: codigoDeRol(cat.lead, "nuevo") ?? "cold-lead",
    enSeguimiento: conMarca(cat.lead, "en_seguimiento"),
  };
}
