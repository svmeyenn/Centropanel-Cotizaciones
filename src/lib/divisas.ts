import "server-only";

// Las paridades que se miran todos los dias, para la portada.
//
// Dos fuentes publicas y sin clave:
//   - mindicador.cl, que publica lo del Banco Central de Chile: la UF, el
//     dolar observado y el euro, todos en pesos chilenos;
//   - open.er-api.com, para lo que tiene que ver con el sol peruano.
//
// Ninguna es critica: si una no responde, su parte de la banda no se muestra y
// el resto sigue. La portada no puede quedar en blanco porque un servicio de
// terceros se cayo.

export type Paridad = {
  // "Dolar", "UF", "Sol / Peso"...
  nombre: string;
  // Ya formateado, porque cada paridad se lee con su propia precision: el
  // dolar con dos decimales, el peso en soles con cuatro.
  valor: string;
  // De cuando es el dato. El dolar observado del Banco Central sale con un dia
  // de rezago, y conviene que eso se vea.
  fecha: string | null;
};

const HORA = 60 * 60;

const numero = (n: number, decimales: number) =>
  n.toLocaleString("es-CL", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

type Indicador = { valor: number; fecha: string };

async function indicadoresDeChile(): Promise<{
  uf?: Indicador;
  dolar?: Indicador;
  euro?: Indicador;
} | null> {
  try {
    const r = await fetch("https://mindicador.cl/api", {
      next: { revalidate: HORA },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return { uf: d.uf, dolar: d.dolar, euro: d.euro };
  } catch {
    return null;
  }
}

// Cuantos CLP, USD y EUR vale un sol.
async function paridadesDelSol(): Promise<{
  clp?: number;
  usd?: number;
  eur?: number;
  fecha?: string;
} | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/PEN", {
      next: { revalidate: HORA },
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.result !== "success") return null;
    return {
      clp: d.rates?.CLP,
      usd: d.rates?.USD,
      eur: d.rates?.EUR,
      // Esta fuente da la fecha como texto RFC y como marca de tiempo. La
      // marca no hay que interpretarla.
      fecha: d.time_last_update_unix
        ? new Date(d.time_last_update_unix * 1000).toISOString()
        : undefined,
    };
  } catch {
    return null;
  }
}

const dia = (f?: string) => (f ? f.slice(0, 10).split("-").reverse().join("-") : null);

export async function cargarParidades(codigoPais: string): Promise<Paridad[]> {
  const esPeru = codigoPais === "PE";
  const [chile, sol] = await Promise.all([
    esPeru ? Promise.resolve(null) : indicadoresDeChile(),
    paridadesDelSol(),
  ]);

  const lista: Paridad[] = [];

  // Desde Peru la moneda de casa es el sol, asi que todo se expresa en soles.
  if (esPeru) {
    if (sol?.clp)
      lista.push({
        nombre: "Sol en pesos",
        valor: `$${numero(sol.clp, 2)}`,
        fecha: dia(sol.fecha),
      });
    if (sol?.usd)
      lista.push({
        nombre: "Dolar en soles",
        valor: `S/ ${numero(1 / sol.usd, 4)}`,
        fecha: dia(sol.fecha),
      });
    if (sol?.eur)
      lista.push({
        nombre: "Euro en soles",
        valor: `S/ ${numero(1 / sol.eur, 4)}`,
        fecha: dia(sol.fecha),
      });
    return lista;
  }

  // Y desde Chile, todo en pesos.
  if (chile?.dolar)
    lista.push({
      nombre: "Dolar en pesos",
      valor: `$${numero(chile.dolar.valor, 2)}`,
      fecha: dia(chile.dolar.fecha),
    });

  if (chile?.euro)
    lista.push({
      nombre: "Euro en pesos",
      valor: `$${numero(chile.euro.valor, 2)}`,
      fecha: dia(chile.euro.fecha),
    });

  if (sol?.clp)
    lista.push({
      nombre: "Sol en pesos",
      valor: `$${numero(sol.clp, 2)}`,
      fecha: dia(sol.fecha),
    });

  if (chile?.uf)
    lista.push({
      nombre: "UF en pesos",
      valor: `$${numero(chile.uf.valor, 2)}`,
      fecha: dia(chile.uf.fecha),
    });

  return lista;
}
