// Orden y rangos de los cuadros del inicio, guardados en la direccion web.
//
// Van en la direccion y no en la memoria del navegador por dos razones: el
// enlace se puede compartir tal como se esta mirando, y las listas que muestran
// quince filas de miles necesitan que el orden viaje a la base --es el orden el
// que decide cuales quince llegan--. Las tablas que llegan completas se ordenan
// aqui mismo, en el servidor, antes de dibujarlas.

export type Dir = "asc" | "desc";
export type Orden = { campo: string; dir: Dir };

// "total:desc" -> { campo: "total", dir: "desc" }. Lo que no calza con la lista
// de campos permitidos vuelve al orden por defecto: una direccion escrita a
// mano en la barra no puede romper la pantalla ni colarse a la base.
export function leerOrden(valor: string | undefined, pordefecto: Orden, permitidos: string[]): Orden {
  const [campo, dir] = (valor ?? "").split(":");
  if (!permitidos.includes(campo)) return pordefecto;
  return { campo, dir: dir === "asc" ? "asc" : "desc" };
}

// Como queda el orden al pinchar una columna: si ya se ordena por ella se da
// vuelta; si no, empieza por donde sea mas util (los textos de la A a la Z, las
// fechas y los numeros de mayor a menor).
export function alternar(actual: Orden, campo: string, inicial: Dir): Orden {
  if (actual.campo !== campo) return { campo, dir: inicial };
  return { campo, dir: actual.dir === "asc" ? "desc" : "asc" };
}

export function conParametro(qs: string, param: string, valor: string | null): string {
  const s = new URLSearchParams(qs);
  if (valor) s.set(param, valor);
  else s.delete(param);
  const t = s.toString();
  return t ? `?${t}` : "?";
}

// Un rango viaja como "desde..hasta"; cualquiera de los dos lados puede faltar.
export type Rango = { desde: string; hasta: string };
export const SIN_RANGO: Rango = { desde: "", hasta: "" };

export function leerRango(valor: string | undefined): Rango {
  const [desde = "", hasta = ""] = (valor ?? "").split("..");
  return { desde: desde.trim(), hasta: hasta.trim() };
}

export function escribirRango(r: Rango): string | null {
  const d = r.desde.trim();
  const h = r.hasta.trim();
  return d || h ? `${d}..${h}` : null;
}

export const hayRango = (r: Rango) => Boolean(r.desde || r.hasta);

// Ordena las tablas que llegan completas. El valor de cada columna lo da quien
// llama, porque solo ella sabe como se lee cada campo de sus filas.
export function ordenar<T>(filas: T[], o: Orden, valor: (f: T, campo: string) => string | number | null): T[] {
  const signo = o.dir === "asc" ? 1 : -1;
  return [...filas].sort((a, b) => {
    const x = valor(a, o.campo);
    const y = valor(b, o.campo);
    // Lo vacio al final, sea cual sea la direccion: un dato que falta no es ni
    // el mayor ni el menor.
    if (x == null || x === "") return y == null || y === "" ? 0 : 1;
    if (y == null || y === "") return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * signo;
    return String(x).localeCompare(String(y), "es", { numeric: true }) * signo;
  });
}
