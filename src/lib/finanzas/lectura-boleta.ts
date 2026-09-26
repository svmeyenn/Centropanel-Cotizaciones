import "server-only";

// Lectura automatica de la boleta.
//
// La foto se manda a la API de Anthropic, que devuelve los campos ya
// separados: monto, fecha, comercio y numero de documento. Es lo que ahorra la
// mayor parte del tecleo en terreno.
//
// Nada de lo que devuelve se guarda solo: llena el formulario y la persona
// confirma antes de grabar. Un modelo puede leer mal un monto borroso, y una
// boleta mal cargada que nadie reviso es peor que una tecleada a mano.
//
// Sin `ANTHROPIC_API_KEY` la funcion queda apagada y el boton no aparece. La
// clave se carga en Vercel y en .env.local, nunca en el repositorio.

const CLAVE = process.env.ANTHROPIC_API_KEY?.trim();
export const LECTURA_CONFIGURADA = !!CLAVE;

// Haiku es el modelo barato de la familia y lee una boleta de sobra: se
// procesan cientos de fotos por unos pocos dolares.
const MODELO = "claude-haiku-4-5-20251001";

// Los tipos que la API acepta como imagen. El PDF de una factura no pasa por
// aqui: se sube tal cual como respaldo.
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type BoletaLeida = {
  monto: number | null;
  fecha: string | null;
  comercio: string | null;
  documento: string | null;
};

const INSTRUCCION = `Eres un lector de boletas y facturas de Chile y Peru. Te doy la foto de un comprobante y devuelves SOLO un objeto JSON, sin explicaciones ni bloques de codigo, con estas claves:

{"monto": number|null, "fecha": "YYYY-MM-DD"|null, "comercio": string|null, "documento": string|null}

Reglas:
- "monto" es el TOTAL pagado, como numero sin separadores de miles y con punto decimal. En Chile normalmente no lleva decimales; en Peru lleva dos.
- "fecha" es la fecha de emision del comprobante.
- "comercio" es el nombre del local o la razon social de quien emite, corto y sin RUT ni direccion.
- "documento" es el numero de boleta, factura o ticket. Si el comprobante no trae numero, usa "S/N".
- Si un dato no se distingue con seguridad, pon null en vez de adivinar.`;

export async function leerBoleta(
  datos: string,
  tipo: string
): Promise<{ ok: true; boleta: BoletaLeida } | { ok: false; mensaje: string }> {
  if (!CLAVE)
    return { ok: false, mensaje: "La lectura automatica no esta configurada." };
  if (!TIPOS.includes(tipo))
    return { ok: false, mensaje: "Solo se pueden leer fotos (JPG, PNG o WEBP)." };

  try {
    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": CLAVE,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: tipo, data: datos },
              },
              { type: "text", text: INSTRUCCION },
            ],
          },
        ],
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error(
        "Lectura de boleta rechazada:",
        respuesta.status,
        detalle.slice(0, 300)
      );
      return {
        ok: false,
        mensaje:
          respuesta.status === 401
            ? "La clave de lectura automatica no es valida."
            : "No se pudo leer la boleta. Escriba los datos a mano.",
      };
    }

    const cuerpo = await respuesta.json();
    const texto: string = cuerpo?.content?.[0]?.text ?? "";

    // El modelo a veces envuelve el JSON en un bloque de codigo: se recorta
    // desde la primera llave hasta la ultima.
    const desde = texto.indexOf("{");
    const hasta = texto.lastIndexOf("}");
    if (desde < 0 || hasta < desde)
      return {
        ok: false,
        mensaje: "No se entendio la boleta. Escriba los datos a mano.",
      };

    const crudo = JSON.parse(texto.slice(desde, hasta + 1));

    const monto = Number(crudo.monto);
    const fecha = typeof crudo.fecha === "string" ? crudo.fecha.slice(0, 10) : null;

    return {
      ok: true,
      boleta: {
        monto: Number.isFinite(monto) && monto > 0 ? monto : null,
        fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
        comercio:
          typeof crudo.comercio === "string" ? crudo.comercio.slice(0, 120) : null,
        documento:
          typeof crudo.documento === "string" ? crudo.documento.slice(0, 50) : null,
      },
    };
  } catch (e) {
    console.error("Fallo la lectura de la boleta:", e);
    return {
      ok: false,
      mensaje: "No se pudo leer la boleta. Escriba los datos a mano.",
    };
  }
}
