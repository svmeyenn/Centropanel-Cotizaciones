import type { NextConfig } from "next";

// Contra que copia de los datos corre este despliegue.
//
// Se puede fijar a mano con NEXT_PUBLIC_DB_SCHEMA, pero por omision basta con
// la rama: lo que se despliega desde "sandbox" trabaja sobre la copia de
// pruebas y todo lo demas sobre produccion. Asi el ambiente de pruebas no
// depende de acordarse de configurar una variable, que es justo lo que se
// olvida y termina escribiendo en los datos de verdad.
const esquema =
  process.env.NEXT_PUBLIC_DB_SCHEMA ??
  (process.env.VERCEL_GIT_COMMIT_REF === "sandbox" ? "sandbox" : "public");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DB_SCHEMA: esquema,
  },
};

export default nextConfig;
