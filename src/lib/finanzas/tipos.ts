// Tipos y ayudas del modulo de finanzas, portados del sistema de Ingresos y
// Egresos. Dos diferencias con el original, y las dos vienen de que aqui los
// dos mercados viven en la misma copia de datos:
//
//   - cada fila lleva `id_pais` (alla Chile y Peru eran esquemas distintos);
//   - quien cargo el movimiento se guarda como `id_vendedor` y no como el
//     texto del login, porque aqui las personas son la ficha de vendedor.

export type Tipo = "Ingreso" | "Egreso";
export type EstadoPago = "Pagado" | "Pendiente";

export type Cuenta = {
  id_cuenta: number;
  id_pais: number;
  banco: string;
  numero_cuenta: string | null;
  alias: string | null;
  titular: string | null;
  moneda: string | null;
  saldo_inicial: number;
  activa: boolean;
};

// `activo` saca la fila de los selectores; `borrado` la saca ademas del panel
// de mantenedores. Ninguno de los dos borra nada: los movimientos que ya
// apuntaban a esta fila siguen mostrando su nombre.
export type Proyecto = {
  id_proyecto: number;
  id_pais: number;
  nombre: string;
  cliente: string | null;
  activo: boolean;
  borrado: boolean;
};

export type Categoria = {
  id_categoria: number;
  id_pais: number;
  nombre: string;
  tipo: Tipo;
  borrado: boolean;
};

// Las personas u organizaciones que nos depositan o a las que pagamos.
export type Interlocutor = {
  id_interlocutor: number;
  id_pais: number;
  razon_social: string;
  nombre_referencia: string;
  rut: string | null;
  con_transferencia: boolean;
  borrado: boolean;
};

export type Movimiento = {
  id_mov: number;
  id_pais: number;
  tipo: Tipo;
  // Fecha de pago: nula mientras un egreso esta Pendiente o un ingreso
  // todavia es una proyeccion.
  fecha: string | null;
  origen_destino: string | null;
  monto: number;
  comentario: string | null;
  id_cuenta: number | null;
  id_proyecto: number | null;
  id_categoria: number | null;
  // Fuente de verdad del origen/destino. `origen_destino` queda como copia del
  // nombre de referencia, que es lo que leen la cartola y los avisos.
  id_interlocutor: number | null;
  // Plata adelantada a una persona para que gaste, no un pago a proveedor:
  // sale del resumen por proyecto, porque el gasto se reconoce al rendirlo.
  es_anticipo: boolean;
  documento: string | null;
  estado_pago: EstadoPago;
  fecha_pago: string | null;
  id_vendedor: number | null;
  fecha_registro: string;
};

// --- como se lee un movimiento en pantalla ---------------------------------

// "Razon Social - Nombre de Referencia", o uno solo cuando son iguales, que es
// como quedaron los de la carga inicial. Se compone al leer y nunca se guarda:
// asi renombrar a alguien se refleja de inmediato en todo su historial.
export const etiquetaInterlocutor = (
  razonSocial: string,
  nombreReferencia: string
) =>
  razonSocial.trim() === nombreReferencia.trim()
    ? nombreReferencia.trim()
    : `${razonSocial.trim()} - ${nombreReferencia.trim()}`;

export const fechaCorta = (f: string | null) => {
  if (!f) return "";
  const [a, m, d] = f.slice(0, 10).split("-");
  return `${d}-${m}-${a}`;
};

// Los ingresos no se "pagan", se proyectan: mismo valor en la base
// ('Pendiente'), otra palabra en pantalla.
export const etiquetaEstado = (tipo: Tipo, estado: EstadoPago) =>
  tipo === "Ingreso" && estado === "Pendiente" ? "Proyectado" : estado;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const mesLargo = (f: string) => {
  const [anio, mes] = f.slice(0, 10).split("-");
  const nombre = MESES[Number(mes) - 1];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
};

// Agrupa filas ya ordenadas por fecha en bloques contiguos por mes, sin
// reordenarlas: la cartola arrastra un saldo y no soporta que se le cambie el
// orden por debajo.
export function agruparPorMes<T extends { fecha: string | null }>(filas: T[]) {
  const grupos: { mes: string; filas: T[] }[] = [];
  for (const f of filas) {
    const mes = f.fecha ? mesLargo(f.fecha) : "";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.filas.push(f);
    else grupos.push({ mes, filas: [f] });
  }
  return grupos;
}

// --- busqueda de interlocutores --------------------------------------------

// Para buscar: "jose" tiene que encontrar a "Jose", y "SPA" a "Spa".
export const normalizarTexto = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Distancia de edicion: cuantas letras hay que cambiar, agregar o quitar para
// pasar de un texto al otro.
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(
        previa[j] + 1,
        actual[j - 1] + 1,
        previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previa = actual;
  }
  return previa[b.length];
}

// Cuanto se le perdona a una palabra segun su largo. En palabras cortas no se
// perdona nada: con dos letras de margen, "sur" coincidiria con medio mundo.
const tolerancia = (n: number) => (n <= 3 ? 0 : n <= 5 ? 1 : 2);

// Que tan bien calza lo tecleado con un texto. Menor es mejor; null es que no
// calza. Tolera variantes y errores de tecleo: "sodimak" encuentra "Sodimac",
// y "perez juan" encuentra "Juan Perez" porque las palabras se buscan sueltas
// y en cualquier orden.
export function puntajeCoincidencia(
  consulta: string,
  texto: string
): number | null {
  const q = normalizarTexto(consulta.trim());
  if (!q) return 0;

  const t = normalizarTexto(texto);
  if (t.includes(q)) return 0;

  const tokens = q.split(/\s+/).filter(Boolean);
  const palabras = t.split(/[^a-z0-9]+/).filter(Boolean);

  let total = 0;
  for (const token of tokens) {
    if (t.includes(token)) {
      total += 1;
      continue;
    }

    const margen = tolerancia(token.length);
    if (margen === 0) return null;

    let mejor = Infinity;
    for (const palabra of palabras) {
      // Contra la palabra entera y contra su comienzo, para que lo tecleado a
      // medias ("construct") siga alcanzando a "Constructora".
      const d = Math.min(
        distancia(token, palabra),
        distancia(token, palabra.slice(0, token.length))
      );
      if (d < mejor) mejor = d;
    }

    if (mejor > margen) return null;
    total += 2 + mejor;
  }

  return total;
}

// Filtra y ordena interlocutores por lo tecleado, de la mejor coincidencia a
// la peor. Lo usan el campo del formulario y el filtro del listado: los dos
// buscan lo mismo y buscan igual.
export function buscarInterlocutores<
  T extends { razon_social: string; nombre_referencia: string; rut?: string | null }
>(lista: T[], consulta: string): T[] {
  if (consulta.trim() === "") return lista;

  const puntuados: { fila: T; puntaje: number }[] = [];
  for (const fila of lista) {
    const candidatos = [
      puntajeCoincidencia(consulta, fila.razon_social),
      puntajeCoincidencia(consulta, fila.nombre_referencia),
      fila.rut ? puntajeCoincidencia(consulta, fila.rut) : null,
    ].filter((p): p is number => p !== null);

    if (candidatos.length > 0)
      puntuados.push({ fila, puntaje: Math.min(...candidatos) });
  }

  return puntuados
    .sort(
      (a, b) =>
        a.puntaje - b.puntaje ||
        a.fila.nombre_referencia.localeCompare(b.fila.nombre_referencia, "es")
    )
    .map((p) => p.fila);
}

// Respaldo de un egreso: la cotizacion o la factura que lo justifica. El
// archivo vive en el deposito privado; aqui solo queda su ruta.
export type Adjunto = {
  id_adjunto: number;
  id_mov: number;
  nombre: string;
  ruta: string;
  tipo_mime: string | null;
  tamano: number | null;
  id_vendedor: number | null;
  subido_en: string;
};

// Cuenta bancaria de un interlocutor: el RUT es de la persona, el correo es de
// cada cuenta. Solo hace falta para pagarle por transferencia.
export type CuentaInterlocutor = {
  id_int_cuenta: number;
  id_interlocutor: number;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  email: string;
};

// Tope de gasto por categoria. La de categoria nula es la regla general, que
// se aplica a las categorias que no tienen la suya. `bloquea` decide si el
// gasto no se puede cargar o si solo queda marcado para quien revisa.
export type PoliticaGasto = {
  id_politica: number;
  id_pais: number;
  id_categoria: number | null;
  tope: number;
  bloquea: boolean;
  activa: boolean;
};
