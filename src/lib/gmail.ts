import { createSign } from "crypto";

// Envio de correo desde la casilla del propio usuario (Google Workspace de
// centropanel.cl y centropanel.pe). Una cuenta de servicio con delegacion de
// dominio, limitada al permiso gmail.send, actua en nombre del vendedor: el
// correo sale de su direccion y queda en sus Enviados, sin que cada uno tenga
// que conectar su cuenta.
//
// Credenciales en variables de entorno de Vercel, nunca en el codigo:
//   GOOGLE_SA_EMAIL  correo de la cuenta de servicio
//   GOOGLE_SA_KEY    clave privada (private_key del JSON)
//
// Sin dependencias: se firma el JWT con crypto y se habla directo con las API.

const ALCANCE = "https://www.googleapis.com/auth/gmail.send";

export function correoConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_KEY);
}

function b64url(x: Buffer | string): string {
  return Buffer.from(x)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Token de acceso para actuar como `email`.
async function tokenPara(email: string): Promise<string> {
  const cuenta = process.env.GOOGLE_SA_EMAIL!;
  // Vercel guarda los saltos de linea de la clave como "\n" literales.
  const clave = process.env.GOOGLE_SA_KEY!.replace(/\\n/g, "\n");

  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(
    JSON.stringify({
      iss: cuenta,
      sub: email,
      scope: ALCANCE,
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 600,
    })
  );
  const firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(clave);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecera}.${cuerpo}.${b64url(firma)}`,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      j.error === "unauthorized_client"
        ? "Google no autoriza el envio: falta la delegacion de dominio para este correo."
        : (j.error_description ?? j.error ?? `Google respondio ${r.status}`)
    );
  }
  return j.access_token as string;
}

// Encabezado con tildes o enes: codificado segun RFC 2047.
function encabezado(s: string): string {
  return /^[\x20-\x7e]*$/.test(s)
    ? s
    : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`;
}

// Base64 en lineas de 76 caracteres, como exige MIME.
function enLineas(b: Buffer): string {
  return b.toString("base64").replace(/.{76}/g, "$&\r\n");
}

export async function enviarGmail(o: {
  de: string;
  nombreDe: string;
  para: string;
  asunto: string;
  texto: string;
  adjunto: { nombre: string; datos: Buffer };
}): Promise<void> {
  const limite = `cp-${Date.now().toString(36)}`;
  const mime = [
    `From: ${encabezado(o.nombreDe)} <${o.de}>`,
    `To: ${o.para}`,
    `Subject: ${encabezado(o.asunto)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    "",
    `--${limite}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    enLineas(Buffer.from(o.texto, "utf-8")),
    "",
    `--${limite}`,
    `Content-Type: application/pdf; name="${o.adjunto.nombre}"`,
    `Content-Disposition: attachment; filename="${o.adjunto.nombre}"`,
    "Content-Transfer-Encoding: base64",
    "",
    enLineas(o.adjunto.datos),
    "",
    `--${limite}--`,
    "",
  ].join("\r\n");

  const token = await tokenPara(o.de);
  const r = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: b64url(mime) }),
    }
  );
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error?.message ?? `Gmail respondio ${r.status}`);
  }
}
