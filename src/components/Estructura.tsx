import MenuLateral from "@/components/MenuLateral";
import PestanasLaterales from "@/components/PestanasLaterales";
import { ProveedorEstados } from "@/components/ProveedorEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";
import RecordatorioDatos from "@/components/RecordatorioDatos";
import { menuDe } from "@/lib/menu";
import { clientesIncompletos } from "@/lib/recordatorio";
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
  // Independientes entre si: se piden a la vez.
  const [incompletos, catalogo] = await Promise.all([clientesIncompletos(v), catalogoEstados()]);
  const grupos = menuDe(v);
  const config = grupos.find((g) => g.pestanas);

  return (
    <div className="flex min-h-screen">
      {incompletos.length > 0 && (
        <RecordatorioDatos clientes={incompletos} idVendedor={v.id} />
      )}
      <MenuLateral
        grupos={grupos}
        nombre={v.nombre}
        rol={v.rol}
        version={VERSION}
        sandbox={ES_SANDBOX}
      />
      <div className="flex-1 min-w-0">
        <ProveedorEstados catalogo={catalogo}>
          <PestanasLaterales titulo={config?.titulo ?? ""} opciones={config?.opciones ?? []}>
            {children}
          </PestanasLaterales>
        </ProveedorEstados>
      </div>
    </div>
  );
}
