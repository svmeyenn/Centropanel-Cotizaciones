// La ficha unica de un tercero: cliente, proveedor, empleado, socio, empresa
// relacionada o institucion.
//
// Antes eran dos listas. El mismo transportista estaba cargado como cliente en
// el cotizador --con su telefono y su contacto-- y como interlocutor en
// finanzas --con su RUT y su cuenta bancaria--, y al cobrarle o al pagarle
// habia que mirar las dos. Ahora es una ficha con una marca por cada cosa que
// es: el que nos compra y nos transporta es cliente y proveedor a la vez.

export const TIPOS_FICHA = [
  { tipo: "cliente", texto: "Cliente", nota: "Le vendemos" },
  { tipo: "proveedor", texto: "Proveedor", nota: "Le compramos" },
  {
    tipo: "empleado",
    texto: "Empleado",
    nota: "Sueldos, anticipos y rendiciones de gastos",
  },
  { tipo: "socio", texto: "Socio", nota: "Aportes y retiros de capital" },
  {
    tipo: "relacionada",
    texto: "Empresa relacionada",
    nota: "Otra empresa nuestra",
  },
  {
    tipo: "institucion",
    texto: "Institucion",
    nota: "SII, Tesoreria, municipio: se les paga, nunca se les vende",
  },
] as const;

export type TipoFicha = (typeof TIPOS_FICHA)[number]["tipo"];

export const ETIQUETA_TIPO: Record<TipoFicha, string> = Object.fromEntries(
  TIPOS_FICHA.map((t) => [t.tipo, t.texto])
) as Record<TipoFicha, string>;

export interface Ficha {
  id_entidad: number;
  id_pais: number;
  razon_social: string;
  nombre_referencia: string;
  rut: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  con_transferencia: boolean;
  activo: boolean;
  tipos: TipoFicha[];
}

export interface DatosFicha {
  razon_social: string;
  nombre_referencia: string;
  rut: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  con_transferencia: boolean;
  tipos: TipoFicha[];
  id_pais?: number | null;
}

export interface CuentaBancaria {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  email: string;
}

export const TIPOS_CUENTA = [
  "Cuenta Corriente",
  "Cuenta Vista",
  "Cuenta de Ahorro",
  "Cuenta RUT",
] as const;

// Que exige la ficha depende de para que sirve, no de un unico formulario para
// todos. A un cliente hay que poder llamarlo y facturarle, asi que el contacto,
// el telefono y la ciudad son obligatorios. A un proveedor al que se le paga por
// transferencia hay que poder pagarle: sin RUT y sin una cuenta completa, media
// ficha bancaria no sirve. Y una ficha sin ninguna marca no se sabe para que es.
export function faltantesFicha(d: DatosFicha, cuentas: CuentaBancaria[]): string[] {
  const faltan: string[] = [];
  if (!d.razon_social.trim()) faltan.push("Razon social");
  if (!d.nombre_referencia.trim()) faltan.push("Nombre corto");
  if (d.tipos.length === 0) faltan.push("Al menos una marca (cliente, proveedor, ...)");

  if (d.tipos.includes("cliente")) {
    if (!d.contacto.trim()) faltan.push("Contacto (lo exige un cliente)");
    if (!d.telefono.trim()) faltan.push("Telefono (lo exige un cliente)");
    if (!d.ciudad.trim()) faltan.push("Ciudad (lo exige un cliente)");
  }

  if (d.con_transferencia) {
    if (!d.rut.trim()) faltan.push("RUT (lo exige pagar por transferencia)");
    const llenas = cuentas.filter(
      (c) =>
        c.banco.trim() || c.tipo_cuenta.trim() || c.numero_cuenta.trim() || c.email.trim()
    );
    if (llenas.length === 0) faltan.push("Una cuenta bancaria");
    else if (
      llenas.some(
        (c) =>
          !c.banco.trim() ||
          !c.tipo_cuenta.trim() ||
          !c.numero_cuenta.trim() ||
          !c.email.trim()
      )
    )
      faltan.push("Completar banco, tipo, numero y correo de cada cuenta");
  }

  return faltan;
}
