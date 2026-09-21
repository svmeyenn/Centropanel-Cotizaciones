import MenuLateral from "@/components/MenuLateral";
import { menuDe } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";
import { VERSION } from "@/lib/version";
import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Arma la pantalla de quien trabaja con sesion: el menu fijo a la izquierda y
// el contenido a la derecha. Las pantallas sin sesion --ingreso, recuperar
// clave y el enlace publico del cliente-- no pasan por aqui.
export default async function Estructura({
  children,
}: {
  children: React.ReactNode;
}) {
  const v = await requerirVendedor();

  return (
    <div className="flex min-h-screen">
      <MenuLateral
        grupos={menuDe(v)}
        nombre={v.nombre}
        rol={v.rol}
        version={VERSION}
        sandbox={ES_SANDBOX}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
