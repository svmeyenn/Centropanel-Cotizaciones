// Mensajes a un lead por correo o WhatsApp: las plantillas se editan en un
// mantenedor y aqui se llenan con los datos del lead y de quien escribe. Nada se
// envia solo: el mensaje se arma, se revisa y lo manda la persona.

export type Canal = "email" | "whatsapp";

export type Plantilla = {
  id: number;
  canal: Canal;
  // La linea de la que son: Paneles, Proyecto y las que se creen. Cada una tiene su juego.
  linea: string;
  nombre: string;
  asunto: string | null;
  cuerpo: string;
  orden: number;
  activo: boolean;
};

// Los marcadores que entienden las plantillas. El enlace a la cotizacion no
// existe a proposito: lo que se manda es el PDF, no un enlace.
export const MARCADORES: { marca: string; ayuda: string }[] = [
  { marca: "{NOMBRE}", ayuda: "Primer nombre del contacto" },
  { marca: "{NOMBRE_COMPLETO}", ayuda: "Nombre y apellido del contacto" },
  { marca: "{EMPRESA}", ayuda: "Empresa del contacto" },
  { marca: "{FOLIOS}", ayuda: "Folios de las cotizaciones que se adjuntan" },
  { marca: "{VENDEDOR}", ayuda: "Quien escribe" },
  { marca: "{CARGOVENDEDOR}", ayuda: "Cargo de quien escribe" },
  { marca: "{EMAILVENDEDOR}", ayuda: "Correo de quien escribe" },
  { marca: "{FONOVENDEDOR}", ayuda: "Telefono de quien escribe" },
];

export type DatosMensaje = {
  nombre: string;
  nombreCompleto: string;
  empresa: string;
  folios: string[];
  vendedor: string;
  cargoVendedor: string | null;
  emailVendedor: string | null;
  fonoVendedor: string | null;
};

// "COT1 y COT2", "COT1, COT2 y COT3".
export function listarFolios(folios: string[]): string {
  if (folios.length <= 1) return folios.join("");
  return `${folios.slice(0, -1).join(", ")} y ${folios[folios.length - 1]}`;
}

export function aplicarPlantilla(texto: string, d: DatosMensaje): string {
  return texto
    .replace(/\{NOMBRE_COMPLETO\}/g, d.nombreCompleto)
    .replace(/\{NOMBRE\}/g, d.nombre)
    .replace(/\{EMPRESA\}/g, d.empresa)
    .replace(/\{FOLIOS\}/g, listarFolios(d.folios))
    .replace(/\{VENDEDOR\}/g, d.vendedor)
    .replace(/\{CARGOVENDEDOR\}/g, d.cargoVendedor ?? "Ejecutivo Comercial")
    .replace(/\{EMAILVENDEDOR\}/g, d.emailVendedor ?? "")
    .replace(/\{FONOVENDEDOR\}/g, d.fonoVendedor ?? "");
}

// Deja solo digitos y antepone el codigo del pais si el numero viene en formato
// local. wa.me exige el numero sin "+", sin espacios y con codigo de pais. Un
// celular de nueve digitos que empieza con 9 es igual en Chile y en Peru: solo el
// pais del lead dice cual es.
export function normalizarFono(fono: string | null, prefijo: string): string | null {
  if (!fono) return null;
  const n = fono.replace(/\D/g, "");
  if (!n) return null;
  if (/^\s*(\+|00)/.test(fono)) return n.replace(/^00/, "");
  if (n.startsWith(prefijo) && n.length >= prefijo.length + 8) return n;
  if (n.startsWith("9") && n.length === 9) return prefijo + n;
  if (n.length === 8 && prefijo === "56") return "569" + n;
  return n;
}
