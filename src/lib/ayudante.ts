// El "ayudante" es un programa chico que corre en el computador de cada persona --ver
// /ayudante-- y hace lo que un sitio web no puede: dejar un correo en la bandeja de
// salida de Outlook con entrega programada, y abrir WhatsApp con el chat del contacto y
// los archivos listos.
//
// Solo atiende a las direcciones exactas del sistema y solo a quien lo emparejo con su
// clave --generada al instalarlo y pegada una vez en /ayudante--: por eso otra pagina web
// no puede darle ordenes. Todo lo de aqui corre en el navegador. Sin ayudante,
// `estadoAyudante` devuelve null y la pantalla sigue con lo de siempre.

const BASE = "http://127.0.0.1:47931";
const LLAVE = "ayudante-clave";

export type EstadoAyudante = {
  ok: boolean;
  version: string;
  // false: el ayudante esta, pero este navegador aun no tiene su clave.
  pareado: boolean;
  outlook?: boolean;
  whatsapp?: boolean;
  // Las cuentas de correo que tiene Outlook en este computador.
  cuentas?: string[];
};
export type AdjuntoB64 = { nombre: string; base64: string };
export type RespuestaAyudante = { ok: boolean; motivo?: string; [k: string]: unknown };

export function leerClave(): string {
  try {
    return localStorage.getItem(LLAVE) ?? "";
  } catch {
    return "";
  }
}

export function guardarClave(clave: string) {
  try {
    if (clave) localStorage.setItem(LLAVE, clave.trim());
    else localStorage.removeItem(LLAVE);
  } catch {
    /* sin almacenamiento: no se puede recordar */
  }
}

async function pedir<T>(ruta: string, init: RequestInit, ms: number): Promise<T | null> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ms);
  try {
    const r = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: { ...(init.headers ?? {}), "X-Clave": leerClave() },
      signal: control.signal,
    });
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

// ¿Esta el ayudante en este computador y emparejado? Responde rapido o no esta.
export function estadoAyudante(): Promise<EstadoAyudante | null> {
  return pedir<EstadoAyudante>("/estado", {}, 1500);
}

async function enviar(ruta: string, cuerpo: unknown): Promise<RespuestaAyudante> {
  const r = await pedir<RespuestaAyudante>(
    ruta,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) },
    120000
  );
  return r ?? { ok: false, motivo: "No se pudo hablar con el ayudante. Compruebe que este abierto." };
}

// Correo nuevo en Outlook, desde la cuenta `desde`. Con `enviar_en` --fecha ISO-- queda en la
// bandeja de salida esperando esa hora; sin ella, se abre la ventana del mensaje para revisarlo.
export function outlookCorreo(d: {
  desde: string;
  para: string;
  asunto: string;
  cuerpo: string;
  enviar_en: string | null;
  adjuntos: AdjuntoB64[];
}) {
  return enviar("/outlook/correo", d);
}

// Saca de la bandeja de salida un correo programado.
export function outlookCancelar(d: { para: string; asunto: string }) {
  return enviar("/outlook/cancelar", d);
}

// Abre el chat del contacto con el texto escrito; los archivos quedan en el portapapeles.
export function whatsappAbrir(d: { telefono: string; texto: string; adjuntos: AdjuntoB64[] }) {
  return enviar("/whatsapp/abrir", d);
}

export function aBase64(f: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onerror = () => mal(new Error("No se pudo leer el archivo."));
    lector.onload = () => ok(String(lector.result).split(",")[1] ?? "");
    lector.readAsDataURL(f);
  });
}
