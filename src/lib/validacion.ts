// Reglas de "esto no puede ir en blanco", compartidas por el formulario y por
// la accion del servidor. En un solo lugar para que la pantalla y el servidor
// no puedan discrepar sobre que es obligatorio.

export interface DatosObligatoriosCliente {
  razon_social: string;
  contacto: string;
  telefono: string;
  ciudad: string;
}

// La razon social y el contacto son con quien se trata; el telefono, como se
// le ubica; la ciudad, donde se despacha. El pais no se valida aqui porque lo
// pone la base con el mercado del usuario, y el RUT queda opcional: hay
// clientes que se cotizan antes de tenerlo.
export function faltantesCliente(d: DatosObligatoriosCliente): string[] {
  const faltan: string[] = [];
  if (!d.razon_social.trim()) faltan.push("Razon social");
  if (!d.contacto.trim()) faltan.push("Contacto");
  if (!d.telefono.trim()) faltan.push("Telefono");
  if (!d.ciudad.trim()) faltan.push("Ciudad");
  return faltan;
}

export interface DatosObligatoriosProveedor {
  razon_social: string;
  rut: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
}

// En el proveedor no sobra ninguno: la solicitud de cotizacion se le envia por
// correo, se le llama para apurarla y la factura llega a nombre de su RUT.
export function faltantesProveedor(d: DatosObligatoriosProveedor): string[] {
  const faltan: string[] = [];
  if (!d.razon_social.trim()) faltan.push("Razon social");
  if (!d.rut.trim()) faltan.push("RUT");
  if (!d.contacto.trim()) faltan.push("Contacto");
  if (!d.email.trim()) faltan.push("Correo");
  if (!d.telefono.trim()) faltan.push("Telefono");
  if (!d.direccion.trim()) faltan.push("Direccion");
  return faltan;
}
