import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorDocumentos, { type DocumentoFila } from "@/components/GestorDocumentos";
import { contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Biblioteca de documentos para clientes: fichas tecnicas, catalogos, certificados. Lo que se sube
// aqui queda a mano al escribirle a cualquier lead, para adjuntarlo sin buscarlo.
export default async function Pagina() {
  const v = await requerirVendedor();
  const esAdmin = tienePerfilAdmin(v);
  const { paises } = await contextoMercado(v);
  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos_comerciales")
    .select("id, nombre, nota, tamano, id_pais, activo, creado, vendedores(nombre)")
    .order("activo", { ascending: false })
    .order("nota");

  const filas: DocumentoFila[] = (data ?? []).map((d) => {
    const ven = (Array.isArray(d.vendedores) ? d.vendedores[0] : d.vendedores) as { nombre?: string } | null;
    return {
      id: Number(d.id),
      nombre: d.nombre as string,
      nota: d.nota as string,
      tamano: Number(d.tamano ?? 0),
      id_pais: (d.id_pais as number | null) ?? null,
      activo: Boolean(d.activo),
      creado: d.creado as string,
      subido_por: ven?.nombre ?? null,
    };
  });

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Documentos para clientes" subtitulo="Fichas tecnicas, catalogos y certificados listos para adjuntar desde un lead" />
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorDocumentos documentos={filas} esAdmin={esAdmin} paises={paises.map((p) => ({ id: p.id, nombre: p.nombre }))} />
      </div>
    </div>
  );
}
