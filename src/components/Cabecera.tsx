import CabeceraBase from "@/components/CabeceraBase";
import Bandera, { colorMercado } from "@/components/Bandera";
import SelectorMercado from "@/components/SelectorMercado";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

// Cabecera de las pantallas con sesion: la banda de siempre mas el mercado en
// que se esta trabajando, para que nunca haya duda de si se esta en Chile o en
// Peru. Quien trabaja un solo pais ve el suyo fijo; quien trabaja los dos lo
// elige aqui, y la franja de color cambia con la eleccion.
export default async function Cabecera({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  const v = await requerirVendedor();
  const { accesibles, esAdminGeneral, activo } = await contextoMercado(v);

  const derecha = esAdminGeneral ? (
    <SelectorMercado
      paises={accesibles.map((p) => ({ codigo: p.codigo, nombre: p.nombre }))}
      activo={activo?.codigo ?? null}
    />
  ) : activo ? (
    <div
      className="flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-2.5 py-1 rounded"
      title="Mercado en que trabaja su usuario"
    >
      <Bandera codigo={activo.codigo} />
      {activo.nombre}
    </div>
  ) : null;

  return (
    <CabeceraBase
      titulo={titulo}
      subtitulo={subtitulo}
      derecha={derecha}
      franja={colorMercado(activo?.codigo ?? null)}
    />
  );
}
