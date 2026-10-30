import CabeceraBase from "@/components/CabeceraBase";
import RutaProceso from "@/components/RutaProceso";
import type { UbicacionProceso } from "@/lib/procesos";
import { colorMercado } from "@/components/Bandera";
import SelectorMercado from "@/components/SelectorMercado";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

// Cabecera de las pantallas con sesion: la franja con el titulo mas el pais en
// que se esta trabajando, para que nunca haya duda de si se esta en Chile o en
// Peru. El logo no va aqui: vive arriba del menu lateral.
export default async function Cabecera({
  titulo,
  subtitulo,
  proceso,
}: {
  titulo: string;
  subtitulo?: string;
  // La linea del proceso a la que pertenece la pantalla, con la etapa en que se esta.
  proceso?: UbicacionProceso;
}) {
  const v = await requerirVendedor();
  const { accesibles, esAdminGeneral, activo } = await contextoMercado(v);

  return (
    <>
    <CabeceraBase
      titulo={titulo}
      subtitulo={subtitulo}
      mostrarLogo={false}
      derecha={
        <SelectorMercado
          paises={accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
          activo={activo?.codigo ?? null}
          puedeElegir={esAdminGeneral}
        />
      }
      franja={colorMercado(activo?.codigo ?? null)}
    />
    {proceso && <RutaProceso proceso={proceso} />}
    </>
  );
}
