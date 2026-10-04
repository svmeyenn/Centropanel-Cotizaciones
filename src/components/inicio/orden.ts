import type { Dir, Orden } from "@/lib/ordenTabla";

// Por que dato se puede ordenar cada cuadro del inicio, en un solo lugar: la
// pagina lo necesita para leer la direccion web y armar lo que le pide a la
// base, y cada cuadro para dibujar sus titulos. Si estuviera en dos partes,
// tarde o temprano dirian cosas distintas.
//
// Los nombres de los campos de las tres primeras cajas son los mismos que
// acepta inicio_gestion: cualquier otro lo rechaza la base.

export type Columna = { campo: string; texto: string; inicial?: Dir };

export type CuadroOrden = {
  param: string;
  pordefecto: Orden;
  columnas: Columna[];
};

const spec = (param: string, campo: string, dir: Dir, columnas: Columna[]): CuadroOrden => ({
  param,
  pordefecto: { campo, dir },
  columnas,
});

// Mi gestion: el orden viaja a la base, porque decide cuales quince filas llegan.
export const NUEVOS = spec("ord_nuevos", "creado", "desc", [
  { campo: "creado", texto: "Fecha" },
  { campo: "nombre", texto: "Nombre", inicial: "asc" },
  { campo: "origen", texto: "Origen", inicial: "asc" },
  { campo: "propietario", texto: "Propietario", inicial: "asc" },
]);

export const FRIOS = spec("ord_frios", "toque", "desc", [
  { campo: "toque", texto: "Ultimo contacto" },
  { campo: "creado", texto: "Fecha de entrada" },
  { campo: "nombre", texto: "Nombre", inicial: "asc" },
  { campo: "estado", texto: "Estado", inicial: "asc" },
  { campo: "propietario", texto: "Propietario", inicial: "asc" },
]);

export const COTIZACIONES = spec("ord_cot", "fecha", "desc", [
  { campo: "folio", texto: "Folio", inicial: "asc" },
  { campo: "cliente", texto: "Cliente", inicial: "asc" },
  { campo: "estado", texto: "Estado", inicial: "asc" },
  { campo: "vendedor", texto: "Ejecutivo", inicial: "asc" },
  { campo: "fecha", texto: "Fecha" },
  { campo: "dias", texto: "Sin tocar" },
  { campo: "total", texto: "Total" },
]);

// Desempeno: estas tablas llegan completas, asi que el orden se aplica en el
// servidor antes de dibujarlas. Son pocas filas y no llevan filtro de rango.
export const PROPIETARIOS = spec("ord_prop", "asignados", "desc", [
  { campo: "propietario", texto: "Propietario", inicial: "asc" },
  { campo: "asignados", texto: "Asignados" },
  { campo: "nuevos_mes", texto: "Nuevos del mes" },
  { campo: "sin_contactar", texto: "Sin contactar" },
  { campo: "contactados", texto: "Contactados" },
  { campo: "oportunidades", texto: "Oportunidades" },
  { campo: "sin_seguimiento", texto: "Sin seguimiento" },
  { campo: "compromisos_vencidos", texto: "Compromisos vencidos" },
  { campo: "conversion", texto: "Conversion" },
]);

export const ORIGENES = spec("ord_origen", "n", "desc", [
  { campo: "origen", texto: "Origen", inicial: "asc" },
  { campo: "n", texto: "Leads" },
  { campo: "oportunidades", texto: "Oportunidades" },
  { campo: "conversion", texto: "Conversion" },
]);

export const EQUIPO = spec("ord_equipo", "cotizado", "desc", [
  { campo: "vendedor", texto: "Vendedor", inicial: "asc" },
  { campo: "cotizado", texto: "Cotizado" },
  { campo: "parte", texto: "Parte" },
  { campo: "vendido", texto: "Vendido" },
  { campo: "conversion", texto: "Conversion" },
]);

// No es una tabla: va con barra de orden, como las fichas de leads.
export const CLIENTES = spec("ord_clientes", "monto", "desc", [
  { campo: "monto", texto: "Monto" },
  { campo: "cotizaciones", texto: "N de cotizaciones" },
  { campo: "cliente", texto: "Nombre", inicial: "asc" },
]);

export const CUMPLIMIENTO = spec("ord_cumpl", "comprometidas", "desc", [
  { campo: "quien", texto: "Quien", inicial: "asc" },
  { campo: "comprometidas", texto: "Prometio" },
  { campo: "a_tiempo", texto: "A tiempo" },
  { campo: "tarde", texto: "Tarde" },
  { campo: "caducadas", texto: "Caducas" },
  { campo: "pendientes", texto: "Sin hacer" },
  { campo: "cumplimiento", texto: "% a tiempo" },
]);

export const campos = (c: CuadroOrden) => c.columnas.map((x) => x.campo);
