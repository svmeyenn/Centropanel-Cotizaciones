// Contra que copia de los datos trabaja esta instalacion.
//
// "public" es produccion. "sandbox" es la copia de pruebas: mismas tablas,
// mismas reglas y los mismos datos del dia que se creo, pero en un esquema
// aparte de la misma base --gratis, sin un proyecto ni una rama de Supabase--.
// Lo que se hace en una no se ve en la otra.
//
// Se elige con la variable NEXT_PUBLIC_DB_SCHEMA. Si no esta, es produccion:
// un despliegue mal configurado no puede terminar escribiendo en el sandbox
// sin que nadie lo note, pero tampoco al reves.
export const ESQUEMA =
  process.env.NEXT_PUBLIC_DB_SCHEMA === "sandbox" ? "sandbox" : "public";

export const ES_SANDBOX = ESQUEMA === "sandbox";
