import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Donde viven los archivos de respaldo. Un deposito por copia de datos: los
// identificadores del sandbox se copiaron de produccion, asi que compartir
// deposito significaria que borrar el respaldo de una prueba borrase el archivo
// real del movimiento que lleva ese mismo numero.
export const BUCKET_ADJUNTOS = ES_SANDBOX ? "adjuntos-sandbox" : "adjuntos";
export const BUCKET_BOLETAS = ES_SANDBOX ? "boletas-sandbox" : "boletas";

// Un nombre de archivo que no pueda romper la ruta ni salirse de su carpeta.
export function nombreSeguro(nombre: string) {
  return nombre.replace(/[^\w.\-]+/g, "_").slice(-120);
}
