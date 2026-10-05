import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Los estados de los leads --sus nombres, su orden y lo que significan-- se
// configuran en Configuracion > Estados; ver catalogoEstados.ts.

export type Linea = "paneles" | "casas";
export const LINEAS: Record<Linea, string> = { paneles: "Paneles", casas: "Proyecto" };

// Deposito de los archivos de los proyectos de casas: uno por copia de datos,
// por la misma razon que los de finanzas.
export const BUCKET_LEADS = ES_SANDBOX ? "leads-casas-sandbox" : "leads-casas";

// Lo que cabe en un archivo: el deposito admite hasta 25 MB.
export const TOPE_ARCHIVO_LEAD = 25 * 1024 * 1024;

// Extensiones que no se aceptan: son programas, no planos ni fotos.
export const EXTENSIONES_PROHIBIDAS = /\.(exe|bat|cmd|com|scr|msi|js|vbs|ps1|sh|jar|apk|dll)$/i;

// Quien puede escribir en un lead --editar sus datos, anotar conversaciones,
// subir archivos-- es quien puede editar, o administra. Es la misma regla que
// aplica la base de datos.
export const puedeEscribirLeads = (v: { rol: string; puede_editar: boolean }) =>
  v.puede_editar || v.rol === "Administrador" || v.rol === "Supervisor";

// Cargar contactos desde el archivo de Clientify: solo el Administrador que
// trabaja los dos mercados, porque el archivo trae los dos paises.
export const puedeCargarLeads = (v: { rol: string; mercado: string }) =>
  v.rol === "Administrador" && v.mercado === "Ambos";
