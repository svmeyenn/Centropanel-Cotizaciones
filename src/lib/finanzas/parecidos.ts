// Detectar que un interlocutor ya existe antes de crearlo de nuevo.
//
// La ficha se crea desde tres pantallas distintas y por gente distinta, asi
// que el mismo proveedor termina cargado dos veces con el nombre escrito de
// otra forma: "Maderas del Sur", "MADERAS DEL SUR SPA", "maderas  del sur". Al
// pagar, cada copia tiene sus propios datos bancarios y nadie sabe cual es la
// buena.
//
// No se bloquea el alta: se avisa y la persona decide. Un homonimo real existe
// --dos Juan Perez-- y bloquear obligaria a inventarle un nombre al segundo.

export type Parecido = {
  id: number;
  nombre: string;
  rut: string | null;
  // Por que se parece, para que el aviso diga algo mas que "ya existe".
  motivo: string;
};

// Sin tildes, sin puntuacion, en minusculas y con un solo espacio: asi
// "MADERAS DEL SUR S.A." y "maderas del sur sa" son el mismo texto.
export function normalizar(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// El RUT sin puntos, sin guion y sin ceros a la izquierda.
export function rutComparable(v: string | null | undefined): string {
  return (v ?? "")
    .replace(/[^0-9kK]/g, "")
    .toUpperCase()
    .replace(/^0+/, "");
}

// Palabras que no distinguen a nadie: casi todas las razones sociales las
// llevan, y dejarlas dentro hace que dos empresas distintas se parezcan.
const VACIAS = new Set([
  "spa",
  "sa",
  "ltda",
  "limitada",
  "eirl",
  "sac",
  "srl",
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "e",
  "comercial",
  "sociedad",
  "empresa",
]);

function palabras(v: string): Set<string> {
  return new Set(
    normalizar(v)
      .split(" ")
      .filter((x) => x.length > 1 && !VACIAS.has(x))
  );
}

// Cuanto comparten dos nombres, de 0 a 1: las palabras que tienen en comun
// sobre el total de palabras distintas.
function parecido(a: string, b: string): number {
  const A = palabras(a);
  const B = palabras(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comunes = 0;
  for (const x of A) if (B.has(x)) comunes++;
  return comunes / (A.size + B.size - comunes);
}

const CASI_IGUAL = 0.6;

export function buscarParecidos(
  nuevo: { razon_social: string; nombre_referencia: string; rut: string | null },
  existentes: {
    id_interlocutor: number;
    razon_social: string;
    nombre_referencia: string;
    rut: string | null;
    borrado: boolean;
  }[]
): Parecido[] {
  const rutNuevo = rutComparable(nuevo.rut);
  const salida: Parecido[] = [];

  for (const x of existentes) {
    if (x.borrado) continue;

    const mismoRut =
      rutNuevo.length > 2 && rutComparable(x.rut) === rutNuevo;

    const nombres = [x.razon_social, x.nombre_referencia];
    const propios = [nuevo.razon_social, nuevo.nombre_referencia];

    const mismoNombre = propios.some((p) =>
      nombres.some((n) => normalizar(n) === normalizar(p) && normalizar(p) !== "")
    );

    const sePareceA = propios.some((p) =>
      nombres.some((n) => parecido(n, p) >= CASI_IGUAL)
    );

    if (!mismoRut && !mismoNombre && !sePareceA) continue;

    salida.push({
      id: x.id_interlocutor,
      nombre:
        x.razon_social === x.nombre_referencia
          ? x.razon_social
          : `${x.razon_social} (${x.nombre_referencia})`,
      rut: x.rut,
      motivo: mismoRut
        ? "tiene el mismo RUT"
        : mismoNombre
          ? "se llama igual"
          : "tiene un nombre muy parecido",
    });
  }

  // El del mismo RUT primero: es el que casi seguro es la misma persona.
  return salida
    .sort((a, b) => (a.motivo === "tiene el mismo RUT" ? -1 : b.motivo === "tiene el mismo RUT" ? 1 : 0))
    .slice(0, 5);
}
